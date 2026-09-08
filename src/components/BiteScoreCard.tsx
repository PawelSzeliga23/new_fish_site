"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BiteScore } from "@/lib/bite-score";

/** Skala rozbieżna: czerwony biegun - szara neutralna średnia - niebieski biegun. */
function toneColor(tone: BiteScore["tone"]): string {
  if (tone === "bad") return "var(--score-bad)";
  if (tone === "weak") return "var(--score-weak)";
  return "var(--score-good)";
}

/** Ten sam podział dla pojedynczych czynników, żeby paski czytało się tak samo. */
function factorColor(score: number): string {
  if (score < 40) return "var(--score-bad)";
  if (score < 58) return "var(--score-weak)";
  return "var(--score-good)";
}

const RADIUS = 42;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export default function BiteScoreCard({ bite }: { bite: BiteScore }) {
  const [open, setOpen] = useState(false);
  const color = toneColor(bite.tone);

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center gap-4">
        <svg viewBox="0 0 100 100" className="h-24 w-24 shrink-0" role="img" aria-label={`Ocena brań ${bite.score} na 100`}>
          <circle
            cx={50}
            cy={50}
            r={RADIUS}
            fill="none"
            stroke="var(--border)"
            strokeWidth={8}
          />
          <circle
            cx={50}
            cy={50}
            r={RADIUS}
            fill="none"
            stroke={color}
            strokeWidth={8}
            strokeLinecap="round"
            strokeDasharray={CIRCUMFERENCE}
            strokeDashoffset={CIRCUMFERENCE * (1 - bite.score / 100)}
            transform="rotate(-90 50 50)"
          />
          <text
            x={50}
            y={50}
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={26}
            fontWeight={700}
            fill="var(--foreground)"
          >
            {bite.score}
          </text>
        </svg>

        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">
            Prognoza brań
          </p>
          <p className="flex items-center gap-2 text-xl font-bold">
            <span
              className="inline-block h-3 w-3 shrink-0 rounded-full"
              style={{ background: color }}
              aria-hidden
            />
            {bite.rating}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{bite.summary}</p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="mt-3 flex w-full items-center justify-between rounded-xl px-2 py-2 text-sm font-semibold transition-colors hover:bg-muted"
      >
        Skąd ta ocena?
        <ChevronDown
          size={16}
          className={`transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <ul className="mt-1 space-y-3">
          {bite.factors.map((factor) => (
            <li key={factor.key}>
              <div className="flex items-baseline justify-between gap-2 text-sm">
                <span className="font-semibold">{factor.label}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {Math.round(factor.score)}/100 · waga {factor.weight}%
                </span>
              </div>
              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${factor.score}%`,
                    background: factorColor(factor.score),
                  }}
                />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{factor.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
