/**
 * Wspólna logika połowów dla rankingu w kolumnie bocznej miejscówki i pełnej
 * przeglądarki historii na podstronie.
 */

export type CatchReport = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  species: string;
  weight_kg: number | null;
  length_cm: number | null;
  caught_at: string;
  photos: string[] | null;
};

/** Pory doby liczone z godziny połowu - stąd bierze się "najskuteczniejsza pora". */
const DAY_PARTS: { label: string; from: number; to: number }[] = [
  { label: "Świt (4-8)", from: 4, to: 8 },
  { label: "Przedpołudnie (8-12)", from: 8, to: 12 },
  { label: "Popołudnie (12-17)", from: 12, to: 17 },
  { label: "Wieczór (17-22)", from: 17, to: 22 },
  { label: "Noc (22-4)", from: 22, to: 4 },
];

export function dayPartOf(isoDate: string): string {
  const hour = new Date(isoDate).getHours();
  const part = DAY_PARTS.find(({ from, to }) =>
    from < to ? hour >= from && hour < to : hour >= from || hour < to,
  );
  return part?.label ?? "Noc (22-4)";
}

export function computeStats(rows: CatchReport[]) {
  const speciesCounts = new Map<string, number>();
  const dayPartCounts = new Map<string, number>();

  for (const row of rows) {
    speciesCounts.set(row.species, (speciesCounts.get(row.species) ?? 0) + 1);
    const part = dayPartOf(row.caught_at);
    dayPartCounts.set(part, (dayPartCounts.get(part) ?? 0) + 1);
  }

  return {
    count: rows.length,
    totalWeight: rows.reduce((sum, row) => sum + (row.weight_kg ?? 0), 0),
    anglers: new Set(rows.map((row) => row.user_id)).size,
    days: new Set(rows.map((row) => row.caught_at.slice(0, 10))).size,
    speciesBreakdown: [...speciesCounts.entries()].sort((a, b) => b[1] - a[1]),
    bestPart: [...dayPartCounts.entries()].sort((a, b) => b[1] - a[1])[0] ?? null,
  };
}

/**
 * "Największe" znaczy najcięższe, a przy braku wagi - najdłuższe. Połowy bez
 * obu wymiarów lądują na końcu: nie da się ich uczciwie porównać z resztą.
 */
export function rankBySize(rows: CatchReport[]): CatchReport[] {
  return [...rows].sort((a, b) => {
    const weightDiff = (b.weight_kg ?? 0) - (a.weight_kg ?? 0);
    if (weightDiff !== 0) {
      return weightDiff;
    }
    return (b.length_cm ?? 0) - (a.length_cm ?? 0);
  });
}

/** Dopasowanie do wyszukiwarki - po gatunku i po nicku łowiącego. */
export function matchesQuery(row: CatchReport, query: string): boolean {
  const needle = query.trim().toLocaleLowerCase("pl");
  if (needle === "") {
    return true;
  }

  return (
    row.species.toLocaleLowerCase("pl").includes(needle) ||
    row.username.toLocaleLowerCase("pl").includes(needle)
  );
}

export function formatSize(row: CatchReport): string {
  const parts: string[] = [];
  if (row.weight_kg) {
    parts.push(`${row.weight_kg} kg`);
  }
  if (row.length_cm) {
    parts.push(`${row.length_cm} cm`);
  }
  return parts.join(" · ") || "bez wymiarów";
}

/** Data i godzina połowu - rekordy pokazujemy co do minuty, nie co do dnia. */
export function formatCatchMoment(isoDate: string): string {
  return new Date(isoDate).toLocaleString("pl-PL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Znacznik z bazy (ISO ze strefą) na lokalny format pickera "YYYY-MM-DDTHH:mm".
 * Bez tego granice kalendarza rozjeżdżałyby się o przesunięcie strefy.
 */
export function toPickerValue(isoDate: string): string {
  const date = new Date(isoDate);
  const pad = (n: number) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
