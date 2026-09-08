/**
 * Formatowanie wartości pokazywanych użytkownikowi.
 *
 * Wiek pomiaru jest tu najważniejszy: IMGW potrafi zwrócić aktualny stan wody i
 * przy tym przepływ sprzed pół roku. Bez wyraźnego "sprzed 6 miesięcy" taka
 * liczba wygląda jak świeży odczyt i wprowadza w błąd.
 */

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** IMGW podaje "2026-09-08 14:50:00" - bez strefy i bez litery T. */
function parseLooseDate(value: string): Date | null {
  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function relativeFromNow(value: string | null): string | null {
  if (!value) {
    return null;
  }

  const date = parseLooseDate(value);
  if (!date) {
    return null;
  }

  const diff = Date.now() - date.getTime();

  // Rozjazd stref między serwerem a posterunkiem potrafi dać ujemną różnicę -
  // lepiej powiedzieć "przed chwilą" niż "za 2 godziny".
  if (diff < 30 * MINUTE) {
    return "przed chwilą";
  }
  if (diff < DAY) {
    return `sprzed ${Math.round(diff / HOUR)} h`;
  }
  if (diff < 60 * DAY) {
    return `sprzed ${Math.round(diff / DAY)} dni`;
  }

  return `pomiar z ${date.toLocaleDateString("pl-PL")}`;
}

/** True, gdy pomiar jest na tyle stary, że nie opisuje już bieżących warunków. */
export function isStale(value: string | null, maxAgeHours = 24): boolean {
  if (!value) {
    return true;
  }

  const date = parseLooseDate(value);
  return date ? Date.now() - date.getTime() > maxAgeHours * HOUR : true;
}

export function formatArea(hectares: number | null): string {
  if (hectares === null) {
    return "nieznana powierzchnia";
  }
  if (hectares < 1) {
    return `${Math.round(hectares * 10_000)} m²`;
  }
  if (hectares < 100) {
    return `${hectares.toFixed(1)} ha`;
  }
  return `${Math.round(hectares)} ha`;
}

const WATER_BODY_LABELS: Record<string, string> = {
  lake: "Jezioro",
  river: "Rzeka",
  pond: "Staw",
  reservoir: "Zbiornik zaporowy",
};

export function describeWaterBodyType(type: string): string {
  return WATER_BODY_LABELS[type] ?? "Zbiornik";
}
