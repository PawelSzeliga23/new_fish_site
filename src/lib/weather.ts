const FORECAST_API = "https://api.open-meteo.com/v1/forecast";

/** Pół godziny - Open-Meteo i tak aktualizuje dane rzadziej. */
const REVALIDATE_SECONDS = 1800;

export type WeatherSnapshot = {
  temperature: number;
  pressureMsl: number;
  windSpeedKmh: number;
  weatherCode: number;
  time: string;
};

/**
 * Lekki odczyt "tu i teraz", zapisywany do catch_reports.conditions_snapshot
 * przy logowaniu połowu. Celowo trzyma wąski zestaw pól - to, co już leży w
 * bazie, musi dać się odczytać tym samym typem.
 */
export async function getCurrentWeather(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot | null> {
  try {
    const url = `${FORECAST_API}?latitude=${lat}&longitude=${lng}&current=temperature_2m,pressure_msl,wind_speed_10m,weather_code`;
    const res = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS } });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();

    return {
      temperature: data.current.temperature_2m,
      pressureMsl: data.current.pressure_msl,
      windSpeedKmh: data.current.wind_speed_10m,
      weatherCode: data.current.weather_code,
      time: data.current.time,
    };
  } catch {
    return null;
  }
}

export type DailyForecast = {
  date: string;
  tempMax: number;
  tempMin: number;
  precipitationMm: number;
  windMaxKmh: number;
  sunrise: string;
  sunset: string;
};

export type CurrentConditions = {
  time: string;
  temperature: number;
  apparentTemperature: number;
  humidity: number;
  precipitationMm: number;
  weatherCode: number;
  cloudCover: number;
  pressureMsl: number;
  windSpeedKmh: number;
  windGustsKmh: number;
  windDirection: number;
};

export type PressureTrend = {
  /** Zmiana w hPa względem odczytu sprzed 3 / 6 / 24 godzin. */
  delta3h: number;
  delta6h: number;
  delta24h: number;
  direction: "rosnie" | "spada" | "stabilne";
};

export type HourlyPoint = {
  time: string;
  pressureMsl: number;
  temperature: number;
  cloudCover: number;
  windSpeedKmh: number;
};

export type LocationConditions = {
  current: CurrentConditions;
  pressure: PressureTrend;
  forecast: DailyForecast[];
  /** Doba wstecz i doba w przód - pod wykres ciśnienia. */
  hourly: HourlyPoint[];
};

/**
 * Jeden strzał po komplet danych dla miejscówki.
 *
 * Wcześniej strona miejscówki wołała Open-Meteo dwa razy (osobno pogodę bieżącą
 * i prognozę). Tu bierzemy wszystko naraz, a dodatkowo `past_days=1` - bez
 * godzinowej historii ciśnienia nie da się policzyć trendu, a to najmocniejszy
 * pojedynczy czynnik w heurystyce brań.
 */
export async function getLocationConditions(
  lat: number,
  lng: number,
): Promise<LocationConditions | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    current:
      "temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,cloud_cover,pressure_msl,wind_speed_10m,wind_gusts_10m,wind_direction_10m",
    hourly: "pressure_msl,temperature_2m,cloud_cover,wind_speed_10m",
    daily:
      "sunrise,sunset,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max",
    past_days: "1",
    forecast_days: "7",
    timezone: "auto",
  });

  try {
    const res = await fetch(`${FORECAST_API}?${params}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const hourly: HourlyPoint[] = (data.hourly.time as string[]).map((time, i) => ({
      time,
      pressureMsl: data.hourly.pressure_msl[i],
      temperature: data.hourly.temperature_2m[i],
      cloudCover: data.hourly.cloud_cover[i],
      windSpeedKmh: data.hourly.wind_speed_10m[i],
    }));

    return {
      current: {
        time: data.current.time,
        temperature: data.current.temperature_2m,
        apparentTemperature: data.current.apparent_temperature,
        humidity: data.current.relative_humidity_2m,
        precipitationMm: data.current.precipitation,
        weatherCode: data.current.weather_code,
        cloudCover: data.current.cloud_cover,
        pressureMsl: data.current.pressure_msl,
        windSpeedKmh: data.current.wind_speed_10m,
        windGustsKmh: data.current.wind_gusts_10m,
        windDirection: data.current.wind_direction_10m,
      },
      pressure: buildPressureTrend(hourly, data.current.time, data.current.pressure_msl),
      forecast: (data.daily.time as string[]).map((date, i) => ({
        date,
        tempMax: data.daily.temperature_2m_max[i],
        tempMin: data.daily.temperature_2m_min[i],
        precipitationMm: data.daily.precipitation_sum[i],
        windMaxKmh: data.daily.wind_speed_10m_max[i],
        sunrise: data.daily.sunrise[i],
        sunset: data.daily.sunset[i],
      })),
      hourly,
    };
  } catch {
    return null;
  }
}

function buildPressureTrend(
  hourly: HourlyPoint[],
  currentTime: string,
  currentPressure: number,
): PressureTrend {
  // Godziny lecą co 1 h od doby wstecz, więc wystarczy znaleźć "teraz" i cofnąć
  // się o tyle pozycji, ile godzin nas interesuje.
  const nowIndex = hourly.findIndex((point) => point.time >= currentTime);
  const anchor = nowIndex === -1 ? hourly.length - 1 : nowIndex;

  const at = (hoursAgo: number): number | null => {
    const point = hourly[anchor - hoursAgo];
    return point ? point.pressureMsl : null;
  };

  const delta = (hoursAgo: number): number => {
    const past = at(hoursAgo);
    return past === null ? 0 : Number((currentPressure - past).toFixed(1));
  };

  const delta3h = delta(3);

  return {
    delta3h,
    delta6h: delta(6),
    delta24h: delta(24),
    // 0,5 hPa/3h to typowy próg, poniżej którego mówi się o ciśnieniu stałym.
    direction: delta3h <= -0.5 ? "spada" : delta3h >= 0.5 ? "rosnie" : "stabilne",
  };
}

/** Zachowane dla zgodności - używa go jeszcze widok bez pełnych warunków. */
export async function getWeatherForecast(
  lat: number,
  lng: number,
): Promise<DailyForecast[]> {
  const conditions = await getLocationConditions(lat, lng);
  return conditions?.forecast ?? [];
}

const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Bezchmurnie",
  1: "Głównie bezchmurnie",
  2: "Częściowe zachmurzenie",
  3: "Pochmurno",
  45: "Mgła",
  48: "Mgła osadzająca szadź",
  51: "Mżawka",
  53: "Mżawka",
  55: "Gęsta mżawka",
  56: "Marznąca mżawka",
  57: "Marznąca mżawka",
  61: "Słaby deszcz",
  63: "Deszcz",
  65: "Ulewny deszcz",
  66: "Marznący deszcz",
  67: "Marznący deszcz",
  71: "Słabe opady śniegu",
  73: "Opady śniegu",
  75: "Intensywne opady śniegu",
  77: "Śnieg ziarnisty",
  80: "Przelotny deszcz",
  81: "Przelotny deszcz",
  82: "Gwałtowne przelotne opady",
  85: "Przelotny śnieg",
  86: "Przelotny śnieg",
  95: "Burza",
  96: "Burza z gradem",
  99: "Burza z gradem",
};

export function describeWeatherCode(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? "Brak opisu";
}

const COMPASS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

export function describeWindDirection(degrees: number): string {
  return COMPASS[Math.round(degrees / 45) % 8];
}
