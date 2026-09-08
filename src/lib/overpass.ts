/**
 * Import obrysów zbiorników wodnych z OpenStreetMap przez Overpass API.
 *
 * Overpass bywa przeciążony i wtedy zwraca HTML z błędem zamiast JSON-a albo
 * pustą odpowiedź, więc lecimy po liście instancji aż któraś odpowie sensownie.
 * Nie ma tu żadnego klucza API - dane są na licencji ODbL, wymagają jedynie
 * podania źródła w interfejsie.
 */

const ENDPOINTS = [
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass-api.de/api/interpreter",
  "https://overpass.osm.jp/api/interpreter",
];

const REQUEST_TIMEOUT_MS = 45_000;

export type WaterBodyType = "lake" | "river" | "pond" | "reservoir";

export type GeoJsonPolygon = {
  type: "Polygon";
  coordinates: number[][][];
};

export type GeoJsonMultiPolygon = {
  type: "MultiPolygon";
  coordinates: number[][][][];
};

export type OsmWaterBody = {
  /** Relacje dostają ujemne id, żeby nie zderzały się z ways w jednej kolumnie. */
  osmId: number;
  name: string | null;
  type: WaterBodyType;
  geojson: GeoJsonPolygon | GeoJsonMultiPolygon;
};

type OsmNode = { lat: number; lon: number };

type OsmElement = {
  type: "way" | "relation" | "node";
  id: number;
  tags?: Record<string, string>;
  geometry?: OsmNode[];
  members?: { type: string; role: string; geometry?: OsmNode[] }[];
};

function buildQuery(lat: number, lng: number, radiusMeters: number): string {
  const around = `around:${radiusMeters},${lat},${lng}`;

  return `[out:json][timeout:60];
(
  way["natural"="water"](${around});
  relation["natural"="water"](${around});
  way["waterway"="riverbank"](${around});
);
out geom;`;
}

/** OSM opisuje rodzaj wody kilkoma tagami; sprowadzamy je do czterech typów z bazy. */
function mapType(tags: Record<string, string> = {}): WaterBodyType {
  const water = tags.water;

  if (tags.waterway === "riverbank" || water === "river" || water === "stream") {
    return "river";
  }
  if (water === "pond") {
    return "pond";
  }
  if (water === "reservoir" || water === "basin" || water === "wastewater") {
    return "reservoir";
  }

  return "lake";
}

/** Overpass zwraca pierścienie jako listy węzłów; GeoJSON chce [lng, lat] i domknięcia. */
function toRing(nodes: OsmNode[]): number[][] | null {
  if (nodes.length < 4) {
    return null;
  }

  const ring = nodes.map((node) => [node.lon, node.lat]);
  const first = ring[0];
  const last = ring[ring.length - 1];

  if (first[0] !== last[0] || first[1] !== last[1]) {
    ring.push([first[0], first[1]]);
  }

  return ring.length >= 4 ? ring : null;
}

function parseElement(element: OsmElement): OsmWaterBody | null {
  const name = element.tags?.name ?? null;
  const type = mapType(element.tags);

  if (element.type === "way" && element.geometry) {
    const ring = toRing(element.geometry);
    if (!ring) {
      return null;
    }

    return {
      osmId: element.id,
      name,
      type,
      geojson: { type: "Polygon", coordinates: [ring] },
    };
  }

  if (element.type === "relation" && element.members) {
    // Multipolygony w OSM potrafią mieć pierścień porozbijany na kilka członków.
    // Sklejania fragmentów nie robimy - bierzemy tylko te człony "outer", które
    // same w sobie są zamknięte. Dla jezior i zalewów to zwykle cały obrys.
    const rings = element.members
      .filter((member) => member.role === "outer" && member.geometry)
      .map((member) => toRing(member.geometry as OsmNode[]))
      .filter((ring): ring is number[][] => ring !== null);

    if (rings.length === 0) {
      return null;
    }

    return {
      osmId: -element.id,
      name,
      type,
      geojson: {
        type: "MultiPolygon",
        coordinates: rings.map((ring) => [ring]),
      },
    };
  }

  return null;
}

export async function fetchWaterBodiesNear(
  lat: number,
  lng: number,
  radiusMeters = 1500,
): Promise<OsmWaterBody[]> {
  const query = buildQuery(lat, lng, radiusMeters);

  // Zapytanie o pełną geometrię jest dla Overpass dużo droższe niż o same tagi,
  // więc pojedyncza instancja potrafi je odrzucić, choć przed chwilą działała.
  // Stąd dwa przebiegi po całej liście, a nie jeden.
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of ENDPOINTS) {
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          // Kanoniczna forma dla Overpass: zapytanie w polu `data` formularza.
          body: new URLSearchParams({ data: query }),
          signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
          next: { revalidate: 86_400 },
        });

        if (!res.ok) {
          continue;
        }

        // Przeciążony Overpass odpowiada stroną HTML ze statusem 200.
        const text = await res.text();
        if (!text.trimStart().startsWith("{")) {
          continue;
        }

        const data = JSON.parse(text) as { elements?: OsmElement[] };

        // Pusty, ale poprawny wynik też jest odpowiedzią - w okolicy po prostu
        // nie ma zmapowanej wody.
        return (data.elements ?? [])
          .map(parseElement)
          .filter((body): body is OsmWaterBody => body !== null);
      } catch {
        // Timeout albo instancja nie odpowiada - próbujemy następnej.
      }
    }
  }

  throw new Error(
    "Serwery OpenStreetMap (Overpass) są w tej chwili przeciążone i nie oddały obrysów. Spróbuj ponownie za kilka minut.",
  );
}
