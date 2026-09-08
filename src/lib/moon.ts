/**
 * Faza księżyca liczona lokalnie - żadne API nie jest do tego potrzebne, a
 * wędkarze traktują ją jako jeden z czynników brań (nów i pełnia zwykle
 * uchodzą za lepsze niż kwadry).
 */

/** Długość miesiąca synodycznego w dniach. */
const SYNODIC_MONTH = 29.530588853;

/** Nów z 6 stycznia 2000, 18:14 UTC - punkt odniesienia dla całej rachuby. */
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14);

export type MoonPhase = {
  /** 0 = nów, 0.5 = pełnia, 1 = znowu nów. */
  fraction: number;
  /** Oświetlona część tarczy, 0-1. */
  illumination: number;
  label: string;
  emoji: string;
};

const PHASES: { limit: number; label: string; emoji: string }[] = [
  { limit: 0.0625, label: "Nów", emoji: "🌑" },
  { limit: 0.1875, label: "Sierp przybywający", emoji: "🌒" },
  { limit: 0.3125, label: "Pierwsza kwadra", emoji: "🌓" },
  { limit: 0.4375, label: "Garb przybywający", emoji: "🌔" },
  { limit: 0.5625, label: "Pełnia", emoji: "🌕" },
  { limit: 0.6875, label: "Garb ubywający", emoji: "🌖" },
  { limit: 0.8125, label: "Ostatnia kwadra", emoji: "🌗" },
  { limit: 0.9375, label: "Sierp ubywający", emoji: "🌘" },
];

export function getMoonPhase(date: Date = new Date()): MoonPhase {
  const days = (date.getTime() - KNOWN_NEW_MOON) / 86_400_000;
  const fraction = (((days % SYNODIC_MONTH) + SYNODIC_MONTH) % SYNODIC_MONTH) / SYNODIC_MONTH;

  // Oświetlenie tarczy zmienia się kosinusoidalnie: 0 w nowiu, 1 w pełni.
  const illumination = (1 - Math.cos(2 * Math.PI * fraction)) / 2;

  const phase = PHASES.find((p) => fraction < p.limit) ?? PHASES[0];

  return {
    fraction,
    illumination,
    label: phase.label,
    emoji: phase.emoji,
  };
}
