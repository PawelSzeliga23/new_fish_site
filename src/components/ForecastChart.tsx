"use client";

import { useState } from "react";
import type { DailyForecast } from "@/lib/weather";

const WIDTH = 360;
const HEIGHT = 150;
const PAD_X = 22;
const PAD_TOP = 18;
const PAD_BOTTOM = 26;

const USABLE_W = WIDTH - PAD_X * 2;
const USABLE_H = HEIGHT - PAD_TOP - PAD_BOTTOM;

function weekday(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("pl-PL", { weekday: "short" });
}

function xAt(i: number, count: number): number {
  return count === 1 ? WIDTH / 2 : PAD_X + (USABLE_W * i) / (count - 1);
}

/**
 * Wspólna warstwa hover dla obu wykresów: pionowy celownik plus dymek nad
 * wykresem. Natywny <title> w SVG pojawia się z sekundowym opóźnieniem i nie
 * działa na dotyku, więc obsługujemy zdarzenia wskaźnika sami.
 */
function useHoverIndex(count: number) {
  const [index, setIndex] = useState<number | null>(null);

  const onPointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
    const raw = Math.round(((x - PAD_X) / USABLE_W) * (count - 1));
    setIndex(Math.min(count - 1, Math.max(0, raw)));
  };

  return {
    index,
    handlers: {
      onPointerMove,
      onPointerLeave: () => setIndex(null),
    },
  };
}

function Tooltip({
  x,
  children,
}: {
  x: number;
  children: React.ReactNode;
}) {
  return (
    <div
      className="pointer-events-none absolute top-0 -translate-x-1/2 whitespace-nowrap rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-sm"
      style={{ left: `${(x / WIDTH) * 100}%` }}
    >
      {children}
    </div>
  );
}

function Baseline() {
  return (
    <line
      x1={PAD_X}
      y1={HEIGHT - PAD_BOTTOM}
      x2={WIDTH - PAD_X}
      y2={HEIGHT - PAD_BOTTOM}
      stroke="var(--border)"
      strokeWidth={1}
    />
  );
}

function DayLabels({ forecast }: { forecast: DailyForecast[] }) {
  return (
    <>
      {forecast.map((d, i) => (
        <text
          key={d.date}
          x={xAt(i, forecast.length)}
          y={HEIGHT - 8}
          textAnchor="middle"
          fontSize={10}
          fill="var(--muted-foreground)"
        >
          {weekday(d.date)}
        </text>
      ))}
    </>
  );
}

export function TemperatureChart({ forecast }: { forecast: DailyForecast[] }) {
  const { index, handlers } = useHoverIndex(forecast.length);

  if (forecast.length === 0) {
    return <p className="text-sm text-muted-foreground">Brak danych prognozy.</p>;
  }

  const allTemps = forecast.flatMap((d) => [d.tempMax, d.tempMin]);
  const min = Math.min(...allTemps);
  const max = Math.max(...allTemps);
  const range = max - min || 1;

  // Oddech nad i pod serią, żeby skrajne punkty nie kleiły się do ramki.
  const yAt = (v: number) => PAD_TOP + USABLE_H - ((v - min) / range) * USABLE_H;

  const path = (key: "tempMax" | "tempMin") =>
    forecast
      .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i, forecast.length)} ${yAt(d[key])}`)
      .join(" ");

  // Wypełnienie między maksimum a minimum pokazuje amplitudę dobową.
  const bandPath = `${path("tempMax")} L ${xAt(forecast.length - 1, forecast.length)} ${yAt(
    forecast[forecast.length - 1].tempMin,
  )} ${forecast
    .slice()
    .reverse()
    .map((d, i) => `L ${xAt(forecast.length - 1 - i, forecast.length)} ${yAt(d.tempMin)}`)
    .join(" ")} Z`;

  const hovered = index === null ? null : forecast[index];

  return (
    <div>
      <div className="mb-1 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--chart-series-1)" }}
          />
          Maksymalna
        </span>
        <span className="flex items-center gap-1">
          <span
            className="inline-block h-2 w-2 rounded-full"
            style={{ background: "var(--chart-series-2)" }}
          />
          Minimalna
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          role="img"
          aria-label="Prognoza temperatury na 7 dni"
          {...handlers}
        >
          <Baseline />
          <path d={bandPath} fill="var(--chart-series-1)" opacity={0.1} />
          <path
            d={path("tempMax")}
            fill="none"
            stroke="var(--chart-series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <path
            d={path("tempMin")}
            fill="none"
            stroke="var(--chart-series-2)"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {hovered && index !== null && (
            <g>
              <line
                x1={xAt(index, forecast.length)}
                y1={PAD_TOP}
                x2={xAt(index, forecast.length)}
                y2={HEIGHT - PAD_BOTTOM}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
              />
              <circle
                cx={xAt(index, forecast.length)}
                cy={yAt(hovered.tempMax)}
                r={4}
                fill="var(--chart-series-1)"
                stroke="var(--card)"
                strokeWidth={2}
              />
              <circle
                cx={xAt(index, forecast.length)}
                cy={yAt(hovered.tempMin)}
                r={4}
                fill="var(--chart-series-2)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            </g>
          )}

          <DayLabels forecast={forecast} />
        </svg>

        {hovered && index !== null && (
          <Tooltip x={xAt(index, forecast.length)}>
            <span className="font-semibold">{weekday(hovered.date)}</span>{" "}
            <span className="text-muted-foreground">
              {Math.round(hovered.tempMin)}° … {Math.round(hovered.tempMax)}°
            </span>
          </Tooltip>
        )}
      </div>
    </div>
  );
}

export function PrecipitationChart({ forecast }: { forecast: DailyForecast[] }) {
  const { index, handlers } = useHoverIndex(forecast.length);

  if (forecast.length === 0) {
    return null;
  }

  const max = Math.max(1, ...forecast.map((d) => d.precipitationMm));
  const yAt = (v: number) => HEIGHT - PAD_BOTTOM - (v / max) * USABLE_H;

  // 2 px przerwy między słupkami, żeby sąsiednie dni się nie zlewały.
  const slot = USABLE_W / forecast.length;
  const barWidth = Math.max(4, slot - 2);

  const wettest = forecast.reduce(
    (best, d, i) => (d.precipitationMm > forecast[best].precipitationMm ? i : best),
    0,
  );

  const hovered = index === null ? null : forecast[index];

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        role="img"
        aria-label="Prognoza sumy opadów na 7 dni"
        {...handlers}
      >
        <Baseline />

        {forecast.map((d, i) => {
          const height = Math.max(0, HEIGHT - PAD_BOTTOM - yAt(d.precipitationMm));
          return (
            <rect
              key={d.date}
              x={xAt(i, forecast.length) - barWidth / 2}
              y={yAt(d.precipitationMm)}
              width={barWidth}
              height={height}
              rx={height > 4 ? 4 : 0}
              fill="var(--chart-series-1)"
              opacity={index === null || index === i ? 1 : 0.45}
            />
          );
        })}

        {/* Bezpośrednia etykieta tylko na najbardziej mokrym dniu - liczba nad
            każdym słupkiem to szum. */}
        {forecast[wettest].precipitationMm > 0 && (
          <text
            x={xAt(wettest, forecast.length)}
            y={yAt(forecast[wettest].precipitationMm) - 5}
            textAnchor="middle"
            fontSize={10}
            fill="var(--foreground)"
          >
            {forecast[wettest].precipitationMm.toFixed(1)} mm
          </text>
        )}

        <DayLabels forecast={forecast} />
      </svg>

      {hovered && index !== null && (
        <Tooltip x={xAt(index, forecast.length)}>
          <span className="font-semibold">{weekday(hovered.date)}</span>{" "}
          <span className="text-muted-foreground">
            {hovered.precipitationMm.toFixed(1)} mm · wiatr do{" "}
            {Math.round(hovered.windMaxKmh)} km/h
          </span>
        </Tooltip>
      )}
    </div>
  );
}
