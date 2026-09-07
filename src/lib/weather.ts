export type WeatherSnapshot = {
  temperature: number;
  pressureMsl: number;
  windSpeedKmh: number;
  weatherCode: number;
  time: string;
};

export async function getCurrentWeather(
  lat: number,
  lng: number,
): Promise<WeatherSnapshot | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,pressure_msl,wind_speed_10m,weather_code`;
    const res = await fetch(url, { next: { revalidate: 1800 } });

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
};

export async function getWeatherForecast(
  lat: number,
  lng: number,
): Promise<DailyForecast[]> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto&forecast_days=7`;
    const res = await fetch(url, { next: { revalidate: 1800 } });

    if (!res.ok) {
      return [];
    }

    const data = await res.json();
    const daily = data.daily;

    return (daily.time as string[]).map((date: string, i: number) => ({
      date,
      tempMax: daily.temperature_2m_max[i],
      tempMin: daily.temperature_2m_min[i],
      precipitationMm: daily.precipitation_sum[i],
      windMaxKmh: daily.wind_speed_10m_max[i],
    }));
  } catch {
    return [];
  }
}
