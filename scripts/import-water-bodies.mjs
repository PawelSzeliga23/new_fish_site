/**
 * Import obrysów zbiorników wodnych ze zrzutów OpenStreetMap (Geofabrik).
 *
 * Powód istnienia: Overpass API bywa tygodniami przeciążony i odrzuca zapytania
 * o geometrię, przez co warstwa zbiorników w aplikacji zostawała pusta. Zrzuty
 * Geofabrika są dobowe, stabilne i nie mają limitów - jednorazowy import daje
 * komplet wód w kraju, a Overpass zostaje najwyżej do dociągania nowości.
 *
 * Nie pobieramy całych archiwów (~535 MB na województwo, w tym budynki i drogi),
 * tylko warstwę `gis_osm_water_a_free_1` przez zakresy bajtów - ok. 13 MB.
 *
 * Uruchomienie:
 *   node scripts/import-water-bodies.mjs --dry-run
 *   node scripts/import-water-bodies.mjs --region mazowieckie
 *   node scripts/import-water-bodies.mjs --min-area-ha 1
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { listRemoteZip, readRemoteZipEntry } from "./zip-remote.mjs";
import { parseShp, parseDbf, ringsAreaSqm, shapeToGeoJson } from "./shapefile.mjs";

const REGIONS = [
  "dolnoslaskie",
  "kujawsko-pomorskie",
  "lubelskie",
  "lubuskie",
  "lodzkie",
  "malopolskie",
  "mazowieckie",
  "opolskie",
  "podkarpackie",
  "podlaskie",
  "pomorskie",
  "slaskie",
  "swietokrzyskie",
  "warminsko-mazurskie",
  "wielkopolskie",
  "zachodniopomorskie",
];

/**
 * Domyślny odsiew. Zaczynaliśmy od 0,1 ha, ale przy takim progu w bazie lądowało
 * 204 tys. obiektów - w większości rowy i osadniki - i darmowa instancja
 * przestawała wyrabiać się z zapytaniem o kadr mapy (3,6 s na zimno, PostgREST
 * ucinał je limitem czasu). Przy 0,5 ha jest 103 tys. obiektów i 440 ms.
 *
 * Nazwane zbiorniki przepuszczamy niżej niezależnie od progu - nazwa świadczy,
 * że ktoś tę wodę zna, a reguła "50 m od wody" decyduje o tym, gdzie w ogóle
 * da się postawić miejscówkę.
 */
const DEFAULT_MIN_AREA_HA = 0.5;

/** Nazwany zbiornik przepuszczamy jeszcze niżej - nazwa świadczy, że ktoś go zna. */
const NAMED_MIN_AREA_HA = 0.02;

/**
 * Warstwy zrzutu Geofabrika, z których korzystamy.
 *
 * Sama warstwa poligonowa nie wystarcza: w OSM obrys ma tylko szeroka rzeka,
 * a węższe rzeki i kanały są liniami. Bez nich reguła "50 m od wody" blokowałaby
 * dodanie miejscówki na większości polskich rzek.
 */
const LAYERS = {
  polygons: "gis_osm_water_a_free_1",
  lines: "gis_osm_waterways_free_1",
};

/** Przesunięcie puli identyfikatorów dla cieków liniowych - patrz collectLines. */
const LINE_ID_OFFSET = 1_000_000_000_000;

/** Z linii bierzemy cieki, na których się łowi - bez rowów i melioracji. */
const LINE_CLASSES = new Set(["river", "canal"]);

/** Ile obiektów leci w jednym wywołaniu RPC. */
const BATCH_SIZE = 200;

/** Mokradeł i lodowców nie da się łowić - nie zaśmiecamy nimi bazy. */
const SKIPPED_CLASSES = new Set(["wetland", "glacier"]);

/** Powyżej tylu hektarów "water" z OSM to raczej jezioro niż staw. */
const LAKE_MIN_AREA_HA = 5;

function parseArgs(argv) {
  const args = { region: null, minAreaHa: DEFAULT_MIN_AREA_HA, dryRun: false };

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dry-run") args.dryRun = true;
    if (argv[i] === "--region") args.region = argv[++i];
    if (argv[i] === "--min-area-ha") args.minAreaHa = Number(argv[++i]);
  }

  return args;
}

/** .env.local zamiast process.env - skrypt uruchamiamy poza Next.js. */
function readEnv() {
  const raw = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
  const env = {};

  for (const line of raw.split("\n")) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, "");
    }
  }

  return env;
}

function mapType(fclass, areaHa) {
  if (fclass === "reservoir" || fclass === "dock") return "reservoir";
  if (fclass === "riverbank" || fclass === "river") return "river";
  // "water" to worek na wszystko - rozdzielamy po wielkości.
  return areaHa >= LAKE_MIN_AREA_HA ? "lake" : "pond";
}

async function loadLayer(url, entries, layerName) {
  const find = (ext) => entries.find((e) => e.name === `${layerName}.${ext}`);
  const shpEntry = find("shp");
  const dbfEntry = find("dbf");

  if (!shpEntry || !dbfEntry) {
    return { shapes: [], rows: [] };
  }

  const [shpBuffer, dbfBuffer] = await Promise.all([
    readRemoteZipEntry(url, shpEntry),
    readRemoteZipEntry(url, dbfEntry),
  ]);

  return { shapes: parseShp(shpBuffer), rows: parseDbf(dbfBuffer) };
}

async function loadRegion(region) {
  const url = `https://download.geofabrik.de/europe/poland/${region}-latest-free.shp.zip`;
  const { entries } = await listRemoteZip(url);

  const [polygons, lines] = await Promise.all([
    loadLayer(url, entries, LAYERS.polygons),
    loadLayer(url, entries, LAYERS.lines),
  ]);

  if (polygons.shapes.length === 0) {
    throw new Error(`Brak warstwy wodnej w archiwum ${region}`);
  }

  return { polygons, lines };
}

function collectPolygons({ shapes, rows }, minAreaHa) {
  // Mapa zamiast tablicy, bo w zrzucie ten sam osm_id potrafi wystąpić kilka
  // razy (relacja rozbita na części). Zostawiamy największy obrys - duplikat w
  // jednej paczce wywracał wcześniej cały upsert.
  const byOsmId = new Map();

  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const row = rows[i];
    if (!shape || shape.kind !== "polygon" || !row || SKIPPED_CLASSES.has(row.fclass)) {
      continue;
    }

    const areaHa = ringsAreaSqm(shape.parts) / 10_000;
    const name = row.name?.trim() ?? "";
    const floor = name === "" ? minAreaHa : Math.min(NAMED_MIN_AREA_HA, minAreaHa);

    if (areaHa < floor) {
      continue;
    }

    const osmId = Number(row.osm_id);
    const existing = byOsmId.get(osmId);
    if (existing && existing.area_ha >= areaHa) {
      continue;
    }

    byOsmId.set(osmId, {
      osm_id: osmId,
      name,
      type: mapType(row.fclass, areaHa),
      area_ha: Number(areaHa.toFixed(3)),
      geojson: JSON.stringify(shapeToGeoJson(shape)),
    });
  }

  return [...byOsmId.values()];
}

/**
 * Cieki liniowe. Nie mają powierzchni, więc `area_ha` zostaje puste - reguła
 * "50 m od wody" i tak liczy odległość od geometrii, a nie od jej pola.
 */
function collectLines({ shapes, rows }) {
  const byOsmId = new Map();

  for (let i = 0; i < shapes.length; i++) {
    const shape = shapes[i];
    const row = rows[i];
    if (!shape || shape.kind !== "line" || !row || !LINE_CLASSES.has(row.fclass)) {
      continue;
    }

    // Identyfikatory linii przesuwamy do własnej puli: kolumna osm_id ma unikat,
    // a id linii może zderzyć się z id poligonu (OSM numeruje ways i relations
    // niezależnie). Dzisiejsze id OSM nie przekraczają 1,5e10, więc 1e12 daje
    // rozdział z dużym zapasem.
    const osmId = LINE_ID_OFFSET + Number(row.osm_id);
    if (byOsmId.has(osmId)) {
      continue;
    }

    byOsmId.set(osmId, {
      osm_id: osmId,
      name: row.name?.trim() ?? "",
      type: "river",
      area_ha: null,
      geojson: JSON.stringify(shapeToGeoJson(shape)),
    });
  }

  return [...byOsmId.values()];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const regions = args.region ? [args.region] : REGIONS;

  const env = readEnv();
  const supabase = args.dryRun
    ? null
    : createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false },
      });

  if (!args.dryRun && !env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Brak SUPABASE_SERVICE_ROLE_KEY w .env.local");
  }

  console.log(
    `Import zbiorników: ${regions.length} region(ów), próg ${args.minAreaHa} ha` +
      `${args.dryRun ? " (próba na sucho, bez zapisu)" : ""}\n`,
  );

  let grandTotal = 0;

  for (const region of regions) {
    const started = Date.now();

    let data;
    try {
      data = await loadRegion(region);
    } catch (err) {
      console.error(`  ${region}: pominięty - ${err.message}`);
      continue;
    }

    const polygons = collectPolygons(data.polygons, args.minAreaHa);
    const lines = collectLines(data.lines);
    const items = [...polygons, ...lines];
    const seconds = ((Date.now() - started) / 1000).toFixed(1);
    const summary = `${String(polygons.length).padStart(6)} zbiorników + ${String(lines.length).padStart(5)} cieków`;

    if (args.dryRun) {
      console.log(`  ${region.padEnd(20)} ${summary} (${seconds} s)`);
      grandTotal += items.length;
      continue;
    }

    let saved = 0;
    for (let i = 0; i < items.length; i += BATCH_SIZE) {
      const batch = items.slice(i, i + BATCH_SIZE);
      const { error } = await supabase.rpc("bulk_upsert_osm_water_bodies", {
        p_items: batch,
      });

      // Jedna felerna geometria nie może przerwać importu całego kraju -
      // raportujemy paczkę i lecimy dalej.
      if (error) {
        console.error(`  ${region}: paczka ${i / BATCH_SIZE} odrzucona - ${error.message}`);
      } else {
        saved += batch.length;
      }
    }

    grandTotal += saved;
    console.log(`  ${region.padEnd(20)} zapisano ${summary} (${seconds} s)`);
  }

  console.log(`\nŁącznie: ${grandTotal} zbiorników.`);
}

await main();
