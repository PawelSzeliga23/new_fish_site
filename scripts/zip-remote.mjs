/**
 * Czytanie pojedynczych plików z zipa leżącego na serwerze, bez ściągania go w
 * całości.
 *
 * Zrzuty Geofabrika mają po kilkaset megabajtów, bo zawierają wszystkie warstwy
 * OSM (drogi, budynki, POI...). Nam potrzebna jest jedna - poligony wodne.
 * Serwer deklaruje `Accept-Ranges: bytes`, więc zamiast pobierać całość:
 *
 *   1. bierzemy ogon pliku i szukamy w nim stopki archiwum (EOCD),
 *   2. z niej odczytujemy pozycję centralnego katalogu i pobieramy sam katalog,
 *   3. z katalogu wyłuskujemy offsety interesujących nas plików,
 *   4. pobieramy tylko te zakresy bajtów i rozpakowujemy je w pamięci.
 *
 * Dla mazowieckiego to różnica między 560 MB a kilkunastoma.
 */

import { inflateRawSync } from "node:zlib";

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_FILE_SIGNATURE = 0x02014b50;

/** Maksymalny rozmiar stopki ZIP: 22 B rekordu + do 64 KB komentarza. */
const EOCD_MAX_SIZE = 22 + 0xffff;

async function fetchRange(url, start, end) {
  const res = await fetch(url, {
    headers: { Range: `bytes=${start}-${end}` },
    redirect: "follow",
  });

  if (res.status !== 206 && res.status !== 200) {
    throw new Error(`Serwer odrzucił zakres bajtów (HTTP ${res.status})`);
  }

  return Buffer.from(await res.arrayBuffer());
}

async function fetchSize(url) {
  const res = await fetch(url, { method: "HEAD", redirect: "follow" });
  const length = res.headers.get("content-length");

  if (!length) {
    throw new Error("Serwer nie podał rozmiaru pliku");
  }

  return Number(length);
}

/** Lista plików w archiwum wraz z pozycjami, bez pobierania ich zawartości. */
export async function listRemoteZip(url) {
  const size = await fetchSize(url);
  const tailSize = Math.min(EOCD_MAX_SIZE, size);
  const tail = await fetchRange(url, size - tailSize, size - 1);

  // EOCD ma zmienną długość przez komentarz, więc sygnatury szukamy od końca.
  let eocd = -1;
  for (let i = tail.length - 22; i >= 0; i--) {
    if (tail.readUInt32LE(i) === EOCD_SIGNATURE) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) {
    throw new Error("Nie znaleziono stopki ZIP - to nie jest archiwum ZIP");
  }

  const centralSize = tail.readUInt32LE(eocd + 12);
  const centralOffset = tail.readUInt32LE(eocd + 16);
  const central = await fetchRange(url, centralOffset, centralOffset + centralSize - 1);

  const entries = [];
  let cursor = 0;

  while (cursor < central.length - 4 && central.readUInt32LE(cursor) === CENTRAL_FILE_SIGNATURE) {
    const compressionMethod = central.readUInt16LE(cursor + 10);
    const compressedSize = central.readUInt32LE(cursor + 20);
    const uncompressedSize = central.readUInt32LE(cursor + 24);
    const nameLength = central.readUInt16LE(cursor + 28);
    const extraLength = central.readUInt16LE(cursor + 30);
    const commentLength = central.readUInt16LE(cursor + 32);
    const localHeaderOffset = central.readUInt32LE(cursor + 42);
    const name = central.toString("utf8", cursor + 46, cursor + 46 + nameLength);

    entries.push({
      name,
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset,
    });

    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return { url, size, entries };
}

/** Pobiera i rozpakowuje jeden plik z archiwum. */
export async function readRemoteZipEntry(url, entry) {
  // Nagłówek lokalny ma własne (często inne) długości nazwy i pola extra, więc
  // najpierw czytamy 30 bajtów nagłówka, dopiero potem właściwe dane.
  const header = await fetchRange(url, entry.localHeaderOffset, entry.localHeaderOffset + 29);
  const nameLength = header.readUInt16LE(26);
  const extraLength = header.readUInt16LE(28);

  const dataStart = entry.localHeaderOffset + 30 + nameLength + extraLength;
  const raw = await fetchRange(url, dataStart, dataStart + entry.compressedSize - 1);

  if (entry.compressionMethod === 0) {
    return raw;
  }
  if (entry.compressionMethod === 8) {
    return inflateRawSync(raw);
  }

  throw new Error(`Nieobsługiwana metoda kompresji: ${entry.compressionMethod}`);
}
