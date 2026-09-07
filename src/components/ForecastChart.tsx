import type { DailyForecast } from "@/lib/weather";

const WIDTH = 340;
const HEIGHT = 130;
const PAD_X = 24;
const PAD_TOP = 20;
const PAD_BOTTOM = 22;

function weekday(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pl-PL", { weekday: "short" });
}

function xAt(i: number, count: number) {
  const usable = WIDTH - PAD_X * 2;
  return PAD_X + (usable * i) / (count - 1);
}

export function TemperatureChart({ forecast }: { forecast: DailyForecast[] }) {
  if (forecast.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak danych prognozy.</p>;
  }

  const allTemps = forecast.flatMap((d) => [d.tempMax, d.tempMin]);
  const min = Math.min(...allTemps);
  const max = Math.max(...allTemps);
  const range = max - min || 1;
  const usableH = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const yAt = (v: number) => PAD_TOP + usableH - ((v - min) / range) * usableH;

  const maxPath = forecast
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i, forecast.length)} ${yAt(d.tempMax)}`)
    .join(" ");
  const minPath = forecast
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i, forecast.length)} ${yAt(d.tempMin)}`)
    .join(" ");

  const peakIdx = forecast.reduce(
    (best, d, i) => (d.tempMax > forecast[best].tempMax ? i : best),
    0,
  );
  const troughIdx = forecast.reduce(
    (best, d, i) => (d.tempMin < forecast[best].tempMin ? i : best),
    0,
  );

  return (
    <div>
      <div className="mb-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--chart-series-1)" }}
          />
          Max
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--chart-series-2)" }}
          />
          Min
        </span>
      </div>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
        <line
          x1={PAD_X}
          y1={HEIGHT - PAD_BOTTOM}
          x2={WIDTH - PAD_X}
          y2={HEIGHT - PAD_BOTTOM}
          stroke="var(--border)"
          strokeWidth={1}
        />
        <path d={maxPath} fill="none" stroke="var(--chart-series-1)" strokeWidth={2} />
        <path d={minPath} fill="none" stroke="var(--chart-series-2)" strokeWidth={2} />
        {forecast.map((d, i) => (
          <g key={d.date}>
            <circle
              cx={xAt(i, forecast.length)}
              cy={yAt(d.tempMax)}
              r={3}
              fill="var(--chart-series-1)"
            >
              <title>{`${weekday(d.date)}: ${d.tempMax}°C`}</title>
            </circle>
            <circle
              cx={xAt(i, forecast.length)}
              cy={yAt(d.tempMin)}
              r={3}
              fill="var(--chart-series-2)"
            >
              <title>{`${weekday(d.date)}: ${d.tempMin}°C`}</title>
            </circle>
            {i === peakIdx && (
              <text
                x={xAt(i, forecast.length)}
                y={yAt(d.tempMax) - 6}
                textAnchor="middle"
                fontSize={9}
                fill="var(--foreground)"
              >
                {d.tempMax}°
              </text>
            )}
            {i === troughIdx && (
              <text
                x={xAt(i, forecast.length)}
                y={yAt(d.tempMin) + 12}
                textAnchor="middle"
                fontSize={9}
                fill="var(--foreground)"
              >
                {d.tempMin}°
              </text>
            )}
            <text
              x={xAt(i, forecast.length)}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={9}
              fill="var(--muted-foreground)"
            >
              {weekday(d.date)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function PrecipitationChart({ forecast }: { forecast: DailyForecast[] }) {
  if (forecast.length === 0) {
    return null;
  }

  const max = Math.max(1, ...forecast.map((d) => d.precipitationMm));
  const usableH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const barWidth = ((WIDTH - PAD_X * 2) / forecast.length) * 0.5;

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full">
      <line
        x1={PAD_X}
        y1={HEIGHT - PAD_BOTTOM}
        x2={WIDTH - PAD_X}
        y2={HEIGHT - PAD_BOTTOM}
        stroke="var(--border)"
        strokeWidth={1}
      />
      {forecast.map((d, i) => {
        const x = xAt(i, forecast.length) - barWidth / 2;
        const h = (d.precipitationMm / max) * usableH;
        const y = HEIGHT - PAD_BOTTOM - h;
        return (
          <g key={d.date}>
            <rect
              x={x}
              y={y}
              width={barWidth}
              height={h}
              rx={2}
              fill="var(--chart-series-1)"
            >
              <title>{`${weekday(d.date)}: ${d.precipitationMm} mm`}</title>
            </rect>
            <text
              x={xAt(i, forecast.length)}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={9}
              fill="var(--muted-foreground)"
            >
              {weekday(d.date)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
