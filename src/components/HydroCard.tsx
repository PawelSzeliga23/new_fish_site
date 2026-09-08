import type { Hydrology, RiverDischarge, WaterStatus } from "@/lib/hydro";
import { relativeFromNow, isStale } from "@/lib/format";

const STATUS_STYLE: Record<WaterStatus, { label: string; color: string }> = {
  normalny: { label: "Stan normalny", color: "var(--muted-foreground)" },
  ostrzegawczy: { label: "Stan ostrzegawczy", color: "var(--chart-series-2)" },
  alarmowy: { label: "Stan alarmowy", color: "var(--score-bad)" },
  nieznany: { label: "Brak progów", color: "var(--muted-foreground)" },
};

function Reading({
  label,
  value,
  measuredAt,
  staleAfterHours = 24,
}: {
  label: string;
  value: string;
  measuredAt: string | null;
  staleAfterHours?: number;
}) {
  const age = relativeFromNow(measuredAt);
  const stale = isStale(measuredAt, staleAfterHours);

  return (
    <div className="rounded-xl border border-border p-3">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-bold">{value}</p>
      {age && (
        <p className={`text-xs ${stale ? "font-semibold" : "text-muted-foreground"}`}>
          {stale ? `⚠ ${age}` : age}
        </p>
      )}
    </div>
  );
}

function DischargeSparkline({ discharge }: { discharge: RiverDischarge }) {
  const { series } = discharge;
  const values = series.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const width = 260;
  const height = 48;
  const xAt = (i: number) => (width * i) / (series.length - 1);
  const yAt = (v: number) => height - 4 - ((v - min) / range) * (height - 8);

  const path = series
    .map((point, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(point.value)}`)
    .join(" ");

  // past_days=7 stawia dzisiaj na ósmej pozycji serii.
  const todayIndex = Math.min(7, series.length - 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="mt-2 w-full"
      role="img"
      aria-label="Przepływ rzeki: 7 dni wstecz i 7 dni prognozy"
    >
      <path d={path} fill="none" stroke="var(--chart-series-1)" strokeWidth={2} />
      <circle
        cx={xAt(todayIndex)}
        cy={yAt(series[todayIndex].value)}
        r={4}
        fill="var(--chart-series-1)"
        stroke="var(--card)"
        strokeWidth={2}
      >
        <title>{`Dziś: ${series[todayIndex].value} m³/s`}</title>
      </circle>
    </svg>
  );
}

export default function HydroCard({ hydrology }: { hydrology: Hydrology }) {
  const { station, discharge } = hydrology;

  if (!station && !discharge) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-sm text-muted-foreground">
          Brak danych hydrologicznych dla tej okolicy - najbliższy posterunek IMGW
          jest dalej niż 60 km, a model GloFAS nie prowadzi tu cieku.
        </p>
      </div>
    );
  }

  const status = station ? STATUS_STYLE[station.status] : null;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      {station && (
        <>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-bold">
              {station.river ? `${station.river} - ` : ""}
              {station.name}
            </p>
            <p className="text-xs text-muted-foreground">
              posterunek IMGW {station.distanceKm} km stąd
            </p>
          </div>

          {status && (
            <p className="mt-1 flex items-center gap-2 text-sm">
              <span
                className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                style={{ background: status.color }}
                aria-hidden
              />
              {status.label}
              {station.warningLevelCm !== null && (
                <span className="text-muted-foreground">
                  (próg ostrzegawczy {station.warningLevelCm} cm)
                </span>
              )}
            </p>
          )}

          <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
            <Reading
              label="Stan wody"
              value={station.waterLevelCm !== null ? `${station.waterLevelCm} cm` : "brak"}
              measuredAt={station.waterLevelAt}
            />
            <Reading
              label="Temperatura wody"
              value={
                station.waterTemperature !== null
                  ? `${station.waterTemperature.toFixed(1)}°C`
                  : "nie mierzona"
              }
              measuredAt={station.waterTemperatureAt}
            />
            <Reading
              label="Przepływ (IMGW)"
              value={
                station.dischargeM3s !== null ? `${station.dischargeM3s} m³/s` : "brak"
              }
              measuredAt={station.dischargeAt}
            />
          </div>
        </>
      )}

      {discharge && (
        <div className={station ? "mt-4 border-t border-border pt-3" : ""}>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">Przepływ modelowany (GloFAS)</p>
            <p className="text-sm">
              <span className="font-bold">{discharge.today} m³/s</span>{" "}
              <span className="text-muted-foreground">
                {discharge.trend === "rosnie"
                  ? `↑ +${discharge.changePercent}% w tydzień`
                  : discharge.trend === "spada"
                    ? `↓ ${discharge.changePercent}% w tydzień`
                    : "→ stabilny"}
              </span>
            </p>
          </div>

          <DischargeSparkline discharge={discharge} />

          <p className="mt-1 text-xs text-muted-foreground">
            {discharge.trend === "rosnie"
              ? "Woda przybiera - rzeka zwykle mętnieje, ryby schodzą pod brzeg i do zastoisk."
              : discharge.trend === "spada"
                ? "Woda opada i klaruje się - dobre warunki na metody finezyjne."
                : "Przepływ stabilny - ryby trzymają się swoich stanowisk."}
          </p>
        </div>
      )}
    </div>
  );
}
