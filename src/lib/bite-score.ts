import type { LocationConditions } from "@/lib/weather";
import { getMoonPhase } from "@/lib/moon";

/**
 * Heurystyka brań: 0-100 punktów z rozbiciem na czynniki.
 *
 * Wagi i krzywe pochodzą z wiedzy wędkarskiej, nie ze statystyki - przy
 * kilkunastu połowach w bazie nie ma czego kalibrować. Docelowo
 * catch_reports.conditions_snapshot pozwoli stroić te liczby na własnych
 * danych, ale to wymaga setek rekordów.
 *
 * Każdy czynnik zwraca 0-100 i ma swoją wagę; wynik to średnia ważona. Dzięki
 * temu interfejs może pokazać nie tylko "72 punkty", ale też co konkretnie
 * podbiło albo zbiło ocenę - a to jedyne, co czyni taką liczbę wiarygodną.
 */

export type BiteFactor = {
  key: string;
  label: string;
  /** 0-100, wkład tego czynnika. */
  score: number;
  /** Udział w wyniku końcowym (wagi sumują się do 100). */
  weight: number;
  /** Co konkretnie zaważyło - pokazywane użytkownikowi. */
  detail: string;
};

export type BiteScore = {
  score: number;
  rating: string;
  /** Kolor akcentu dla interfejsu. */
  tone: "bad" | "weak" | "good" | "great";
  summary: string;
  factors: BiteFactor[];
};

export type BiteInput = {
  /** Czas, dla którego liczymy ocenę (lokalny dla miejscówki). */
  at: Date;
  pressureMsl: number;
  pressureDelta3h: number;
  airTemperature: number;
  waterTemperature?: number | null;
  windSpeedKmh: number;
  cloudCover: number;
  sunrise: Date;
  sunset: Date;
};

/** Interpolacja liniowa po punktach kontrolnych - czytelniejsza niż drabina ifów. */
function curve(value: number, points: [number, number][]): number {
  const first = points[0];
  const last = points[points.length - 1];

  if (value <= first[0]) return first[1];
  if (value >= last[0]) return last[1];

  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (value <= x1) {
      return y0 + ((value - x0) / (x1 - x0)) * (y1 - y0);
    }
  }

  return last[1];
}

function pressureTrendFactor(delta3h: number): BiteFactor {
  // Powolny spadek przed nadchodzącym frontem to klasyczny sygnał żerowania.
  // Gwałtowny spadek (burza tuż-tuż) i wzrost po przejściu frontu są złe.
  const score = curve(delta3h, [
    [-6, 25],
    [-3.5, 60],
    [-2, 96],
    [-0.8, 100],
    [-0.2, 70],
    [0.5, 58],
    [1.5, 38],
    [3, 25],
    [6, 18],
  ]);

  const detail =
    delta3h <= -0.8
      ? `Ciśnienie spada o ${Math.abs(delta3h).toFixed(1)} hPa/3h - ryby zwykle żerują przed załamaniem`
      : delta3h >= 0.8
        ? `Ciśnienie rośnie o ${delta3h.toFixed(1)} hPa/3h - typowo słabsze branie po froncie`
        : "Ciśnienie stabilne - brania przewidywalne, bez szczytu";

  return { key: "pressureTrend", label: "Trend ciśnienia", score, weight: 28, detail };
}

function timeOfDayFactor(at: Date, sunrise: Date, sunset: Date): BiteFactor {
  const minutesTo = (t: Date) => Math.abs(at.getTime() - t.getTime()) / 60_000;
  const toSunrise = minutesTo(sunrise);
  const toSunset = minutesTo(sunset);
  const nearest = Math.min(toSunrise, toSunset);
  const isDay = at >= sunrise && at <= sunset;

  // Szczyt o świcie i zmierzchu; poza tym noc bywa lepsza niż środek dnia.
  const golden = curve(nearest, [
    [0, 100],
    [60, 92],
    [120, 70],
    [210, 0],
  ]);
  const base = isDay ? 42 : 55;
  const score = Math.max(golden, base);

  const detail =
    nearest <= 90
      ? `${toSunrise < toSunset ? "Świt" : "Zmierzch"} w zasięgu ${Math.round(nearest)} min - najlepsze okno doby`
      : isDay
        ? "Środek dnia - ryby zwykle stoją głębiej i mniej żerują"
        : "Noc - dobra pora na suma, węgorza i sandacza";

  return { key: "timeOfDay", label: "Pora doby", score, weight: 20, detail };
}

function temperatureFactor(air: number, water?: number | null): BiteFactor {
  // Temperatura wody rządzi metabolizmem ryb, więc gdy ją znamy, bierze górę.
  const value = water ?? air;
  const score = curve(value, [
    [0, 15],
    [4, 30],
    [10, 65],
    [15, 95],
    [18, 100],
    [22, 92],
    [26, 60],
    [30, 25],
  ]);

  const detail = water
    ? `Woda ${water.toFixed(1)}°C (pomiar IMGW)`
    : `Brak pomiaru wody - liczone z powietrza (${air.toFixed(1)}°C)`;

  return { key: "temperature", label: "Temperatura", score, weight: 16, detail };
}

function windFactor(speedKmh: number): BiteFactor {
  // Lekka fala natlenia wodę i rozmywa sylwetkę wędkarza; sztorm i pełna cisza
  // są gorsze od delikatnego wiatru.
  const score = curve(speedKmh, [
    [0, 45],
    [3, 65],
    [8, 100],
    [16, 92],
    [25, 62],
    [35, 32],
    [50, 15],
  ]);

  const detail =
    speedKmh < 3
      ? "Cisza - woda jak lustro, ryby bardziej płochliwe"
      : speedKmh <= 18
        ? `Lekka fala przy ${Math.round(speedKmh)} km/h - dobrze natlenia wodę`
        : `Silny wiatr ${Math.round(speedKmh)} km/h - trudne warunki do prezentacji przynęty`;

  return { key: "wind", label: "Wiatr", score, weight: 12, detail };
}

function cloudFactor(cloudCover: number): BiteFactor {
  const score = curve(cloudCover, [
    [0, 45],
    [25, 65],
    [50, 95],
    [80, 100],
    [100, 82],
  ]);

  const detail =
    cloudCover < 25
      ? "Pełne słońce - drapieżniki chowają się w cieniu"
      : cloudCover > 80
        ? "Zachmurzenie całkowite - ryby śmielej wychodzą na płyciznę"
        : "Zmienne zachmurzenie - dobre rozproszone światło";

  return { key: "clouds", label: "Zachmurzenie", score, weight: 10, detail };
}

function pressureLevelFactor(pressureMsl: number): BiteFactor {
  const score = curve(pressureMsl, [
    [980, 30],
    [995, 62],
    [1008, 100],
    [1016, 92],
    [1024, 55],
    [1035, 28],
  ]);

  const detail =
    pressureMsl > 1024
      ? `Wyż ${Math.round(pressureMsl)} hPa - ryby zwykle apatyczne`
      : pressureMsl < 995
        ? `Głęboki niż ${Math.round(pressureMsl)} hPa`
        : `${Math.round(pressureMsl)} hPa - zakres sprzyjający żerowaniu`;

  return { key: "pressureLevel", label: "Ciśnienie", score, weight: 8, detail };
}

function moonFactor(at: Date): BiteFactor {
  const moon = getMoonPhase(at);
  // Nów i pełnia uchodzą za lepsze od kwadr - największe pływy i najsilniejszy
  // wpływ na aktywność dobową.
  const distanceFromQuarter = Math.abs(moon.illumination - 0.5) * 2;
  const score = curve(distanceFromQuarter, [
    [0, 58],
    [0.5, 78],
    [1, 100],
  ]);

  return {
    key: "moon",
    label: "Faza księżyca",
    score,
    weight: 6,
    detail: `${moon.emoji} ${moon.label} - tarcza oświetlona w ${Math.round(moon.illumination * 100)}%`,
  };
}

export function computeBiteScore(input: BiteInput): BiteScore {
  const factors = [
    pressureTrendFactor(input.pressureDelta3h),
    timeOfDayFactor(input.at, input.sunrise, input.sunset),
    temperatureFactor(input.airTemperature, input.waterTemperature),
    windFactor(input.windSpeedKmh),
    cloudFactor(input.cloudCover),
    pressureLevelFactor(input.pressureMsl),
    moonFactor(input.at),
  ];

  const totalWeight = factors.reduce((sum, f) => sum + f.weight, 0);
  const score = Math.round(
    factors.reduce((sum, f) => sum + f.score * f.weight, 0) / totalWeight,
  );

  const ranked = [...factors].sort((a, b) => b.score * b.weight - a.score * a.weight);
  const best = ranked[0];
  const worst = [...factors].sort((a, b) => a.score - b.score)[0];

  const { rating, tone } =
    score >= 75
      ? { rating: "Bardzo dobre", tone: "great" as const }
      : score >= 58
        ? { rating: "Dobre", tone: "good" as const }
        : score >= 40
          ? { rating: "Przeciętne", tone: "weak" as const }
          : { rating: "Słabe", tone: "bad" as const };

  const summary =
    worst.score < 45
      ? `Na plus: ${best.label.toLowerCase()}. Największy minus: ${worst.detail.toLowerCase()}.`
      : `Warunki spójne, najmocniej pracuje ${best.label.toLowerCase()}.`;

  return { score, rating, tone, summary, factors };
}

export type BiteOutlookPoint = {
  time: string;
  score: number;
};

export type BiteWindow = {
  start: string;
  end: string;
  score: number;
};

export type BiteOutlook = {
  hours: BiteOutlookPoint[];
  /** Najlepsze ciągłe okno w najbliższych dobach. */
  best: BiteWindow | null;
};

/**
 * Ocena godzina po godzinie na najbliższe dwie doby - z tego powstaje wykres i
 * podpowiedź "jedź w czwartek o świcie".
 */
export function computeBiteOutlook(
  conditions: LocationConditions,
  waterTemperature?: number | null,
  hoursAhead = 48,
): BiteOutlook {
  const sunByDate = new Map(
    conditions.forecast.map((day) => [day.date, { sunrise: day.sunrise, sunset: day.sunset }]),
  );

  const now = conditions.current.time;
  const startIndex = conditions.hourly.findIndex((point) => point.time >= now);
  if (startIndex === -1) {
    return { hours: [], best: null };
  }

  const hours: BiteOutlookPoint[] = [];

  for (let i = startIndex; i < Math.min(startIndex + hoursAhead, conditions.hourly.length); i++) {
    const point = conditions.hourly[i];
    const sun = sunByDate.get(point.time.slice(0, 10));
    if (!sun) {
      continue;
    }

    // Trend liczony z tego samego szeregu, w którym stoimy - trzy godziny wstecz.
    const past = conditions.hourly[i - 3];
    const delta3h = past ? Number((point.pressureMsl - past.pressureMsl).toFixed(1)) : 0;

    hours.push({
      time: point.time,
      score: computeBiteScore({
        at: new Date(point.time),
        pressureMsl: point.pressureMsl,
        pressureDelta3h: delta3h,
        airTemperature: point.temperature,
        waterTemperature,
        windSpeedKmh: point.windSpeedKmh,
        cloudCover: point.cloudCover,
        sunrise: new Date(sun.sunrise),
        sunset: new Date(sun.sunset),
      }).score,
    });
  }

  return { hours, best: findBestWindow(hours) };
}

function findBestWindow(hours: BiteOutlookPoint[]): BiteWindow | null {
  if (hours.length === 0) {
    return null;
  }

  const threshold = Math.max(60, Math.max(...hours.map((h) => h.score)) - 8);

  let best: BiteWindow | null = null;
  let runStart: number | null = null;

  const closeRun = (endExclusive: number) => {
    if (runStart === null) return;
    const run = hours.slice(runStart, endExclusive);
    const peak = Math.max(...run.map((h) => h.score));
    // Dłuższe okno wygrywa z krótkim o tej samej sile - łatwiej je zaplanować.
    if (!best || peak > best.score || (peak === best.score && run.length > 1)) {
      best = { start: run[0].time, end: run[run.length - 1].time, score: peak };
    }
    runStart = null;
  };

  hours.forEach((hour, i) => {
    if (hour.score >= threshold) {
      if (runStart === null) runStart = i;
    } else {
      closeRun(i);
    }
  });
  closeRun(hours.length);

  return best;
}
