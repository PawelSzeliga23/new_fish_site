"use client";

import { useState } from "react";
import type { BiteOutlook } from "@/lib/bite-score";

const WIDTH = 720;
const HEIGHT = 190;
const PAD_X = 10;
const PAD_TOP = 14;
const PAD_BOTTOM = 30;

/** Powyżej tego progu heurystyka mówi "dobre" - rysujemy go jako linię odniesienia. */
const GOOD_THRESHOLD = 58;

function hourLabel(time: string): string {
  return time.slice(11, 16);
}

function dayLabel(time: string): string {
  return new Date(time).toLocaleDateString("pl-PL", { weekday: "short" });
}

function formatWindow(start: string, end: string): string {
  const sameDay = start.slice(0, 10) === end.slice(0, 10);
  const startText = `${dayLabel(start)} ${hourLabel(start)}`;
  return sameDay
    ? `${startText}–${hourLabel(end)}`
    : `${startText} – ${dayLabel(end)} ${hourLabel(end)}`;
}

export default function BiteOutlookChart({ outlook }: { outlook: BiteOutlook }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const { hours, best } = outlook;

  if (hours.length < 2) {
    return (
      <p className="text-sm text-muted-foreground">
        Brak danych godzinowych do prognozy brań.
      </p>
    );
  }

  const usableW = WIDTH - PAD_X * 2;
  const usableH = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xAt = (i: number) => PAD_X + (usableW * i) / (hours.length - 1);
  const yAt = (score: number) => PAD_TOP + usableH - (score / 100) * usableH;

  const linePath = hours
    .map((point, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(point.score)}`)
    .join(" ");
  const areaPath = `${linePath} L ${xAt(hours.length - 1)} ${HEIGHT - PAD_BOTTOM} L ${xAt(0)} ${HEIGHT - PAD_BOTTOM} Z`;

  // Północ zaczyna nowy dzień - stąd biorą się podpisy osi i linie podziału.
  const dayStarts = hours
    .map((point, i) => ({ point, i }))
    .filter(({ point, i }) => i === 0 || point.time.slice(11, 13) === "00");

  const bestStart = best ? hours.findIndex((h) => h.time === best.start) : -1;
  const bestEnd = best ? hours.findIndex((h) => h.time === best.end) : -1;

  const hovered = hoverIndex === null ? null : hours[hoverIndex];

  const handlePointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const x = ratio * WIDTH;
    const index = Math.round(((x - PAD_X) / usableW) * (hours.length - 1));
    setHoverIndex(Math.min(hours.length - 1, Math.max(0, index)));
  };

  return (
    <div>
      {best && (
        <p className="mb-2 text-sm">
          <span className="font-semibold">Najlepsze okno:</span>{" "}
          {formatWindow(best.start, best.end)}{" "}
          <span className="text-muted-foreground">({best.score} pkt)</span>
        </p>
      )}

      <div className="relative">
        <svg
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          className="w-full touch-none"
          onPointerMove={handlePointer}
          onPointerLeave={() => setHoverIndex(null)}
          role="img"
          aria-label="Prognoza brań godzina po godzinie na najbliższe dwie doby"
        >
          {best && bestStart >= 0 && bestEnd >= bestStart && (
            <rect
              x={xAt(bestStart)}
              y={PAD_TOP}
              width={Math.max(2, xAt(bestEnd) - xAt(bestStart))}
              height={usableH}
              fill="var(--score-good)"
              opacity={0.12}
            />
          )}

          <line
            x1={PAD_X}
            y1={yAt(GOOD_THRESHOLD)}
            x2={WIDTH - PAD_X}
            y2={yAt(GOOD_THRESHOLD)}
            stroke="var(--border)"
            strokeWidth={1}
            strokeDasharray="4 4"
          />

          {dayStarts.map(({ point, i }) => (
            <g key={point.time}>
              {i > 0 && (
                <line
                  x1={xAt(i)}
                  y1={PAD_TOP}
                  x2={xAt(i)}
                  y2={HEIGHT - PAD_BOTTOM}
                  stroke="var(--border)"
                  strokeWidth={1}
                />
              )}
              <text
                x={xAt(i)}
                y={HEIGHT - 10}
                textAnchor={i === 0 ? "start" : "middle"}
                fontSize={11}
                fill="var(--muted-foreground)"
              >
                {dayLabel(point.time)} {hourLabel(point.time)}
              </text>
            </g>
          ))}

          <path d={areaPath} fill="var(--chart-series-1)" opacity={0.14} />
          <path
            d={linePath}
            fill="none"
            stroke="var(--chart-series-1)"
            strokeWidth={2}
            strokeLinejoin="round"
          />

          {hovered && hoverIndex !== null && (
            <g>
              <line
                x1={xAt(hoverIndex)}
                y1={PAD_TOP}
                x2={xAt(hoverIndex)}
                y2={HEIGHT - PAD_BOTTOM}
                stroke="var(--muted-foreground)"
                strokeWidth={1}
              />
              <circle
                cx={xAt(hoverIndex)}
                cy={yAt(hovered.score)}
                r={5}
                fill="var(--chart-series-1)"
                stroke="var(--card)"
                strokeWidth={2}
              />
            </g>
          )}
        </svg>

        {hovered && hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-border bg-card px-2 py-1 text-xs shadow-sm"
            style={{ left: `${(xAt(hoverIndex) / WIDTH) * 100}%` }}
          >
            <span className="font-semibold">{hovered.score} pkt</span>
            <span className="text-muted-foreground">
              {" "}
              · {dayLabel(hovered.time)} {hourLabel(hovered.time)}
            </span>
          </div>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        Linia przerywana to próg &bdquo;dobrych&rdquo; warunków (58 pkt). Przesuń palcem lub
        kursorem po wykresie, żeby zobaczyć ocenę konkretnej godziny.
      </p>
    </div>
  );
}
