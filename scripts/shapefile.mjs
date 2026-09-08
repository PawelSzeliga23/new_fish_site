/**
 * Minimalny czytnik shapefile'a - tylko poligony i atrybuty tekstowe.
 *
 * Świadomie bez zależności: pełne biblioteki GIS ciągną za sobą GDAL-a albo
 * kilkanaście paczek npm, a formaty .shp i .dbf są na tyle proste, że
 * obsłużenie potrzebnego podzbioru mieści się w dwustu linijkach. Zrzuty
 * Geofabrika są w EPSG:4326, więc współrzędne to wprost długość i szerokość
 * geograficzna - nie trzeba nic reprojektować.
 */

const SHAPE_TYPE_POLYLINE = 3;
const SHAPE_TYPE_POLYGON = 5;

/** Promień równoleżnika i południka w metrach na stopień, w przybliżeniu. */
const METERS_PER_DEG_LAT = 110_540;
const METERS_PER_DEG_LON = 111_320;

/**
 * Geometrie z pliku .shp jako `{ kind, parts }`, gdzie `parts` to listy punktów
 * [lon, lat]. Obsługujemy poligony (jeziora, stawy, szerokie rzeki) i łamane
 * (wąskie rzeki i kanały, które w OSM nie mają obrysu). Rekordy innego typu
 * dają `null`, żeby indeksy zgadzały się z rekordami .dbf.
 */
export function parseShp(buffer) {
  const shapes = [];
  let cursor = 100; // nagłówek pliku

  while (cursor + 8 <= buffer.length) {
    // Nagłówek rekordu jest big-endian, a jego zawartość little-endian.
    const contentLength = buffer.readInt32BE(cursor + 4) * 2;
    const contentStart = cursor + 8;
    cursor = contentStart + contentLength;

    if (contentStart + 4 > buffer.length) {
      break;
    }

    const shapeType = buffer.readInt32LE(contentStart);
    if (shapeType !== SHAPE_TYPE_POLYGON && shapeType !== SHAPE_TYPE_POLYLINE) {
      shapes.push(null);
      continue;
    }

    const isPolygon = shapeType === SHAPE_TYPE_POLYGON;

    // 4 B typ + 32 B bounding box, potem liczba pierścieni i punktów.
    const numParts = buffer.readInt32LE(contentStart + 36);
    const numPoints = buffer.readInt32LE(contentStart + 40);

    const partsStart = contentStart + 44;
    const pointsStart = partsStart + numParts * 4;

    const partOffsets = [];
    for (let i = 0; i < numParts; i++) {
      partOffsets.push(buffer.readInt32LE(partsStart + i * 4));
    }

    // Pierścień poligonu musi być domknięty, więc ma co najmniej 4 punkty;
    // łamanej wystarczą dwa.
    const minPoints = isPolygon ? 4 : 2;
    const parts = [];

    for (let part = 0; part < numParts; part++) {
      const from = partOffsets[part];
      const to = part + 1 < numParts ? partOffsets[part + 1] : numPoints;

      const points = [];
      for (let p = from; p < to; p++) {
        const at = pointsStart + p * 16;
        points.push([buffer.readDoubleLE(at), buffer.readDoubleLE(at + 8)]);
      }

      if (points.length >= minPoints) {
        parts.push(points);
      }
    }

    shapes.push(
      parts.length > 0 ? { kind: isPolygon ? "polygon" : "line", parts } : null,
    );
  }

  return shapes;
}

/** Rekordy z pliku .dbf jako obiekty { nazwaPola: wartość }. */
export function parseDbf(buffer) {
  const recordCount = buffer.readInt32LE(4);
  const headerLength = buffer.readInt16LE(8);
  const recordLength = buffer.readInt16LE(10);

  const fields = [];
  let cursor = 32;

  // Deskryptory pól kończy bajt 0x0D.
  while (cursor < headerLength - 1 && buffer[cursor] !== 0x0d) {
    const name = buffer.toString("latin1", cursor, cursor + 11).replace(/\0.*$/, "");
    fields.push({ name, length: buffer[cursor + 16] });
    cursor += 32;
  }

  const rows = [];
  for (let i = 0; i < recordCount; i++) {
    const start = headerLength + i * recordLength;
    if (start + recordLength > buffer.length) {
      break;
    }

    // Pierwszy bajt rekordu to znacznik skasowania.
    let offset = start + 1;
    const row = {};

    for (const field of fields) {
      // Geofabrik zapisuje nazwy w UTF-8 mimo klasycznego DBF-a (stąd plik .cpg).
      row[field.name] = buffer
        .toString("utf8", offset, offset + field.length)
        .replace(/\0/g, "")
        .trim();
      offset += field.length;
    }

    rows.push(row);
  }

  return rows;
}

/**
 * Powierzchnia poligonu w metrach kwadratowych.
 *
 * Zamiast pełnej geodezji rzutujemy stopnie na metry wokół środkowej
 * szerokości figury i liczymy wzór na sznurowadło. Dla zbiorników wielkości
 * kilku kilometrów błąd jest ułamkiem procenta, a to i tak służy wyłącznie do
 * odsiewu najmniejszych oczek.
 */
export function ringsAreaSqm(rings) {
  const allPoints = rings.flat();
  if (allPoints.length === 0) {
    return 0;
  }

  const meanLat =
    allPoints.reduce((sum, [, lat]) => sum + lat, 0) / allPoints.length;
  const lonScale = METERS_PER_DEG_LON * Math.cos((meanLat * Math.PI) / 180);

  let total = 0;

  for (const ring of rings) {
    let shoelace = 0;
    for (let i = 0; i < ring.length - 1; i++) {
      const [lon1, lat1] = ring[i];
      const [lon2, lat2] = ring[i + 1];
      shoelace +=
        lon1 * lonScale * (lat2 * METERS_PER_DEG_LAT) -
        lon2 * lonScale * (lat1 * METERS_PER_DEG_LAT);
    }
    // Pierścienie zewnętrzne i dziury mają przeciwne orientacje, więc suma
    // pól ze znakiem sama odejmuje wyspy.
    total += shoelace / 2;
  }

  return Math.abs(total);
}

/** Geometria shapefile'a na GeoJSON. */
export function shapeToGeoJson({ kind, parts }) {
  if (kind === "line") {
    return parts.length === 1
      ? { type: "LineString", coordinates: parts[0] }
      : { type: "MultiLineString", coordinates: parts };
  }

  return parts.length === 1
    ? { type: "Polygon", coordinates: parts }
    : { type: "MultiPolygon", coordinates: parts.map((ring) => [ring]) };
}
