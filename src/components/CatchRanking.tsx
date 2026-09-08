import {
  computeStats,
  formatCatchMoment,
  formatSize,
  rankBySize,
  type CatchReport,
} from "@/lib/catches";
import { cardCompact, heading, meta, btnSecondary } from "@/lib/ui";

const TOP_COUNT = 10;
const MEDALS = ["🥇", "🥈", "🥉"];

export default function CatchRanking({
  catches,
  currentUserId,
  locationId,
}: {
  catches: CatchReport[];
  currentUserId: string;
  locationId: string;
}) {
  if (catches.length === 0) {
    return (
      <div className="flex flex-col gap-2">
        <h2 className={heading}>Ranking połowów</h2>
        <p className={meta}>
          Jeszcze nikt nie zapisał tu połowu. Pierwszy wpis otworzy ranking tej
          miejscówki.
        </p>
      </div>
    );
  }

  const stats = computeStats(catches);
  const top = rankBySize(catches).slice(0, TOP_COUNT);

  return (
    <div className="flex flex-col gap-3">
      <h2 className={heading}>Ranking połowów</h2>

      {/* Dwie kolumny na stałe - komponent stoi w wąskiej kolumnie bocznej, więc
          breakpoint liczony od szerokości okna wprowadzałby w błąd. */}
      <div className="grid grid-cols-2 gap-2">
        <div className={cardCompact}>
          <p className="text-2xl font-bold">{stats.count}</p>
          <p className="text-xs text-muted-foreground">Złowionych ryb</p>
        </div>
        <div className={cardCompact}>
          <p className="text-2xl font-bold">{stats.totalWeight.toFixed(1)} kg</p>
          <p className="text-xs text-muted-foreground">Łączna waga</p>
        </div>
        <div className={cardCompact}>
          <p className="text-2xl font-bold">{stats.anglers}</p>
          <p className="text-xs text-muted-foreground">Wędkarzy</p>
        </div>
        <div className={cardCompact}>
          <p className="text-2xl font-bold">{stats.days}</p>
          <p className="text-xs text-muted-foreground">Dni z braniem</p>
        </div>
      </div>

      {stats.bestPart && (
        <p className={`${cardCompact} text-sm`}>
          ⏰ <span className="font-semibold">Najskuteczniejsza pora:</span>{" "}
          {stats.bestPart[0]} ({stats.bestPart[1]} z {stats.count} połowów)
        </p>
      )}

      <ol className="flex flex-col gap-2">
        {top.map((row, i) => (
          <li
            key={row.id}
            className={`${cardCompact} flex items-center gap-3 text-sm`}
          >
            <span className="w-6 shrink-0 text-center font-bold">
              {MEDALS[i] ?? i + 1}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{row.species}</span>
              <span className="block text-xs text-muted-foreground">
                {formatSize(row)} ·{" "}
                {row.user_id === currentUserId ? (
                  "Ty"
                ) : (
                  <a href={`/u/${encodeURIComponent(row.username)}`} className="hover:underline">
                    {row.username}
                  </a>
                )}
              </span>
              {/* Data w osobnym wierszu - z godziną nie mieści się już obok
                  nicka w wąskiej kolumnie bocznej. */}
              <span className="block text-xs text-muted-foreground">
                {formatCatchMoment(row.caught_at)}
              </span>
            </span>
          </li>
        ))}
      </ol>

      <a href={`/locations/${locationId}/catches`} className={`${btnSecondary} text-center`}>
        Zobacz wszystkie ({catches.length})
      </a>
    </div>
  );
}
