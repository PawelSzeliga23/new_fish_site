/**
 * Kompresja zdjęć w przeglądarce, zanim plik trafi do Supabase Storage.
 *
 * Zdjęcie z telefonu to dziś 4-12 MB, a w aplikacji i tak wyświetlamy je
 * najwyżej na szerokość ekranu. Bez tego kroku darmowy 1 GB storage kończy się
 * po ~150 zdjęciach. Skalujemy do 1920 px na dłuższym boku i przekodowujemy na
 * JPEG - typowe zdjęcie schodzi z 4 MB do ~400 kB.
 *
 * Moduł jest wyłącznie przeglądarkowy (canvas, File, URL.createObjectURL) -
 * importuj tylko z komponentów "use client".
 */

/** Twardy limit: nic większego nie wychodzi z przeglądarki. */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

/** Dłuższy bok po przeskalowaniu - wystarcza na pełny ekran i lightbox. */
const MAX_EDGE = 1920;

/** Kolejne progi jakości JPEG, gdyby zdjęcie nadal było za duże. */
const QUALITY_STEPS = [0.82, 0.7, 0.6, 0.45];

/** Animacji i wektorów nie ruszamy - przekodowanie na JPEG by je zepsuło. */
const SKIP_TYPES = new Set(["image/gif", "image/svg+xml"]);

/**
 * Zwraca skompresowaną kopię pliku albo - gdy kompresja nie ma sensu lub się
 * nie powiodła - oryginał. Nigdy nie rzuca: nieudana kompresja nie powinna
 * blokować dodania posta.
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.has(file.type)) {
    return file;
  }

  let source: ImageBitmap | HTMLImageElement;
  try {
    source = await decode(file);
  } catch {
    // Format, którego przeglądarka nie umie odczytać (np. HEIC na Androidzie).
    return file;
  }

  try {
    for (const quality of QUALITY_STEPS) {
      const blob = await render(source, MAX_EDGE, quality);
      if (blob && blob.size <= MAX_UPLOAD_BYTES) {
        // Małe PNG-i potrafią być lżejsze niż ich JPEG-owa wersja.
        return blob.size < file.size ? toFile(blob, file) : file;
      }
    }

    // Ostatnia deska ratunku dla zdjęć z aparatów wielkoformatowych: połowa
    // rozdzielczości przy najniższej jakości.
    const blob = await render(source, MAX_EDGE / 2, QUALITY_STEPS[QUALITY_STEPS.length - 1]);
    return blob ? toFile(blob, file) : file;
  } catch {
    return file;
  } finally {
    if ("close" in source) {
      source.close();
    }
  }
}

async function decode(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      // from-image: bez tego zdjęcia z telefonu wychodzą obrócone, bo canvas
      // ignoruje znacznik orientacji z EXIF.
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      // Starsze Safari nie zna tej opcji - schodzimy do <img>, które orientację
      // z EXIF stosuje samo.
    }
  }

  return await decodeViaImg(file);
}

function decodeViaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Nie udało się odczytać zdjęcia"));
    };

    img.src = url;
  });
}

function render(
  source: ImageBitmap | HTMLImageElement,
  maxEdge: number,
  quality: number,
): Promise<Blob | null> {
  const sourceWidth = "naturalWidth" in source ? source.naturalWidth : source.width;
  const sourceHeight = "naturalHeight" in source ? source.naturalHeight : source.height;
  const scale = Math.min(1, maxEdge / Math.max(sourceWidth, sourceHeight));

  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(sourceWidth * scale));
  canvas.height = Math.max(1, Math.round(sourceHeight * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return Promise.resolve(null);
  }

  // JPEG nie ma kanału alfa - bez białego tła przezroczyste PNG wyszłyby czarne.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

function toFile(blob: Blob, original: File): File {
  // Nazwa pliku ląduje w kluczu obiektu w Storage, więc przy okazji czyścimy ją
  // ze spacji i polskich znaków.
  const base =
    original.name
      .replace(/\.[^.]+$/, "")
      .replace(/[^a-zA-Z0-9-_]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "zdjecie";

  return new File([blob], `${base}.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${Math.round(bytes / 1024)} kB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
