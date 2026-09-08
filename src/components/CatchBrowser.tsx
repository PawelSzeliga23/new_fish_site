"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  computeStats,
  dayPartOf,
  formatCatchMoment,
  formatSize,
  matchesQuery,
  rankBySize,
  toPickerValue,
  type CatchReport,
} from "@/lib/catches";
import DateTimePicker from "@/components/DateTimePicker";
import { cardCompact, input, meta, subheading, btnSecondary } from "@/lib/ui";

type SortKey = "date" | "weight" | "length";

const SORT_LABELS: Record<SortKey, string> = {
  date: "Od najnowszych",
  weight: "Od najcięższych",
  length: "Od najdłuższych",
};

const PAGE_SIZE = 20;

/** Kompaktowy wariant pola formularza - pięć kontrolek musi zmieścić się w jednym
 *  rzędzie, więc mają mniejszy tekst i padding niż współdzielony styl `input`. */
const filterControl =
  "min-w-0 flex-1 rounded-xl border border-border bg-background px-2 py-1.5 text-xs outline-none focus:border-primary";

export default function CatchBrowser({
  catches,
  currentUserId,
}: {
  catches: CatchReport[];
  currentUserId: string;
}) {
  const [query, setQuery] = useState("");
  const [species, setSpecies] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sort, setSort] = useState<SortKey>("date");
  const [onlyMine, setOnlyMine] = useState(false);
  const [page, setPage] = useState(1);

  const allSpecies = useMemo(
    () =>
      [...new Set(catches.map((c) => c.species))].sort((a, b) =>
        a.localeCompare(b, "pl"),
      ),
    [catches],
  );

  // Zakres wzięty z samych połowów ogranicza kalendarz - nie ma sensu
  // pozwalać wybrać dnia, w którym i tak nic nie złowiono.
  const dateBounds = useMemo(() => {
    if (catches.length === 0) {
      return { min: "", max: "" };
    }

    const sorted = [...catches].sort(
      (a, b) => new Date(a.caught_at).getTime() - new Date(b.caught_at).getTime(),
    );

    return {
      min: toPickerValue(sorted[0].caught_at),
      max: toPickerValue(sorted[sorted.length - 1].caught_at),
    };
  }, [catches]);

  const filtered = useMemo(() => {
    // Filtry niosą teraz godzinę, więc porównujemy znaczniki czasu, a nie
    // teksty: wartość z pickera jest lokalna i bez strefy, a caught_at ma
    // przesunięcie - tylko epoch stawia je na wspólnej osi.
    const fromMs = dateFrom === "" ? null : new Date(dateFrom).getTime();
    const toMs = dateTo === "" ? null : new Date(dateTo).getTime();

    const rows = catches.filter((c) => {
      const ts = new Date(c.caught_at).getTime();

      return (
        matchesQuery(c, query) &&
        (species === "all" || c.species === species) &&
        (fromMs === null || ts >= fromMs) &&
        (toMs === null || ts <= toMs) &&
        (!onlyMine || c.user_id === currentUserId)
      );
    });

    if (sort === "weight") {
      return rankBySize(rows);
    }
    if (sort === "length") {
      return [...rows].sort((a, b) => (b.length_cm ?? 0) - (a.length_cm ?? 0));
    }
    return [...rows].sort((a, b) => b.caught_at.localeCompare(a.caught_at));
  }, [catches, query, species, dateFrom, dateTo, sort, onlyMine, currentUserId]);

  const stats = useMemo(() => computeStats(filtered), [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  // Zmiana filtrów potrafi skrócić listę poniżej bieżącej strony - wtedy
  // pokazujemy ostatnią istniejącą zamiast pustki.
  const safePage = Math.min(page, pageCount);
  const pageRows = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const hasFilters =
    query !== "" || species !== "all" || dateFrom !== "" || dateTo !== "" || onlyMine;

  /** Każda zmiana kryteriów cofa na pierwszą stronę - inaczej wynik "znika". */
  const resetPage =
    <T,>(setter: (value: T) => void) =>
    (value: T) => {
      setter(value);
      setPage(1);
    };

  const clearFilters = () => {
    setQuery("");
    setSpecies("all");
    setDateFrom("");
    setDateTo("");
    setOnlyMine(false);
    setPage(1);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label className="relative block">
          <Search
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground"
          />
          <input
            value={query}
            onChange={(e) => resetPage(setQuery)(e.target.value)}
            placeholder="Szukaj po gatunku albo wędkarzu..."
            className={`${input} pl-9`}
            aria-label="Szukaj połowów"
          />
        </label>

        {/* Wszystkie filtry w jednym rzędzie, bez paska przewijania: kontrolki
            dzielą dostępną szerokość po równo (flex-1) i zwężają się razem z nią. */}
        <div className="flex gap-2">
          <select
            value={species}
            onChange={(e) => resetPage(setSpecies)(e.target.value)}
            className={filterControl}
            aria-label="Filtruj po gatunku"
          >
            <option value="all">Wszystkie gatunki</option>
            {allSpecies.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>

          <DateTimePicker
            value={dateFrom}
            onChange={resetPage(setDateFrom)}
            label="Połowy od"
            placeholder="Od..."
            min={dateBounds.min}
            max={dateTo || dateBounds.max}
            defaultTime="00:00"
          />

          <DateTimePicker
            value={dateTo}
            onChange={resetPage(setDateTo)}
            label="Połowy do"
            placeholder="Do..."
            min={dateFrom || dateBounds.min}
            max={dateBounds.max}
            defaultTime="23:59"
          />

          <select
            value={sort}
            onChange={(e) => resetPage(setSort)(e.target.value as SortKey)}
            className={filterControl}
            aria-label="Sortowanie"
          >
            {Object.entries(SORT_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => resetPage(setOnlyMine)(!onlyMine)}
            aria-pressed={onlyMine}
            className={`shrink-0 rounded-xl border px-2 py-1.5 text-xs font-semibold whitespace-nowrap transition-colors ${
              onlyMine
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border hover:bg-muted"
            }`}
          >
            Tylko moje
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <p className={meta}>
          {filtered.length === catches.length
            ? `${catches.length} połowów`
            : `${filtered.length} z ${catches.length} połowów`}
          {stats.count > 0 &&
            ` · ${stats.totalWeight.toFixed(1)} kg · ${stats.anglers} wędkarzy`}
        </p>
        {hasFilters && (
          <button
            type="button"
            onClick={clearFilters}
            className="text-sm font-semibold text-primary transition-opacity hover:opacity-80"
          >
            Wyczyść filtry
          </button>
        )}
      </div>

      {filtered.length === 0 ? (
        <p className={meta}>Nic nie pasuje do wybranych kryteriów.</p>
      ) : (
        <>
          <div className="flex flex-col gap-3">
            {pageRows.map((c) => (
              <div key={c.id} className={`${cardCompact} text-sm`}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-semibold">{c.species}</p>
                  <p className="text-muted-foreground">{formatSize(c)}</p>
                </div>
                <p className="text-xs text-muted-foreground">
                  {c.user_id === currentUserId ? (
                    "Ty"
                  ) : (
                    <a
                      href={`/u/${encodeURIComponent(c.username)}`}
                      className="hover:underline"
                    >
                      {c.username}
                    </a>
                  )}{" "}
                  · {formatCatchMoment(c.caught_at)} ·{" "}
                  {dayPartOf(c.caught_at)}
                </p>
                {c.photos?.[0] && (
                  <img
                    src={c.photos[0]}
                    alt="Zdjęcie połowu"
                    className="mt-2 w-full rounded-xl"
                  />
                )}
              </div>
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setPage(safePage - 1)}
                disabled={safePage === 1}
                className={`${btnSecondary} disabled:opacity-40`}
              >
                Poprzednia
              </button>

              <span className={meta}>
                Strona {safePage} z {pageCount}
              </span>

              <button
                type="button"
                onClick={() => setPage(safePage + 1)}
                disabled={safePage === pageCount}
                className={`${btnSecondary} disabled:opacity-40`}
              >
                Następna
              </button>
            </div>
          )}
        </>
      )}

      {stats.speciesBreakdown.length > 1 && (
        <div className={cardCompact}>
          <h2 className={`${subheading} mb-2`}>Gatunki w wynikach</h2>
          <ul className="flex flex-col gap-2">
            {stats.speciesBreakdown.map(([name, count]) => (
              <li key={name} className="text-sm">
                <div className="flex justify-between">
                  <span>{name}</span>
                  <span className="text-muted-foreground">{count}</span>
                </div>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / stats.speciesBreakdown[0][1]) * 100}%`,
                      background: "var(--chart-series-1)",
                    }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
