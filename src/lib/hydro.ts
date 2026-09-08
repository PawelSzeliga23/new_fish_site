/**
 * Dane hydrologiczne dla miejscówki z dwóch niezależnych źródeł:
 *
 * - IMGW (danepubliczne.imgw.pl) - stan wody, temperatura wody i przepływ z
 *   posterunków wodowskazowych w Polsce, razem z progami ostrzegawczym i
 *   alarmowym. Endpoint zwraca naraz wszystkie stacje wraz ze współrzędnymi,
 *   więc najbliższą dobieramy sami po odległości.
 * - Open-Meteo Flood API (model GloFAS) - przepływ rzeki dla dowolnego punktu
 *   na świecie, z historią i prognozą. Działa też tam, gdzie nie ma posterunku.
 *
 * Uwaga na świeżość: IMGW podaje osobny znacznik czasu dla każdego pomiaru i
 * potrafi zwrócić przepływ sprzed pół roku przy aktualnym stanie wody. Dlatego
 * każdy odczyt niesie swoją datę - interfejs ma pokazać, kiedy naprawdę zmierzono.
 */

const IMGW_HYDRO_API = "https://danepubliczne.imgw.pl/api/data/hydro/";
const FLOOD_API = "https://flood-api.open-meteo.com/v1/flood";
const REVALIDATE_SECONDS = 1800;

/** Dalej niż tyle posterunek przestaje mówić cokolwiek o naszej wodzie. */
const MAX_STATION_DISTANCE_KM = 60;

export type WaterStatus = "normalny" | "ostrzegawczy" | "alarmowy" | "nieznany";

export type HydroStation = {
  id: string;
  name: string;
  river: string;
  province: string;
  distanceKm: number;
  waterLevelCm: number | null;
  waterLevelAt: string | null;
  waterTemperature: number | null;
  waterTemperatureAt: string | null;
  dischargeM3s: number | null;
  dischargeAt: string | null;
  warningLevelCm: number | null;
  alarmLevelCm: number | null;
  status: WaterStatus;
};

export type RiverDischarge = {
  today: number;
  /** Doba po dobie: 7 dni wstecz i 7 w przód. */
  series: { date: string; value: number }[];
  trend: "rosnie" | "spada" | "stabilny";
  /** Zmiana względem stanu sprzed tygodnia, w procentach. */
  changePercent: number;
};

export type Hydrology = {
  station: HydroStation | null;
  discharge: RiverDischarge | null;
};

type ImgwRow = Record<string, string | null>;

function toNumber(value: string | null | undefined): number | null {
  if (value === null || value === undefined || value.trim() === "") {
    return null;
  }
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Odległość po wielkim kole - dokładność w zupełności wystarcza do rankingu stacji. */
function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;

  return 2 * R * Math.asin(Math.sqrt(a));
}

function classify(
  levelCm: number | null,
  warningCm: number | null,
  alarmCm: number | null,
): WaterStatus {
  if (levelCm === null) return "nieznany";
  if (alarmCm !== null && levelCm >= alarmCm) return "alarmowy";
  if (warningCm !== null && levelCm >= warningCm) return "ostrzegawczy";
  if (warningCm === null && alarmCm === null) return "nieznany";
  return "normalny";
}

export async function getNearestHydroStation(
  lat: number,
  lng: number,
): Promise<HydroStation | null> {
  try {
    const res = await fetch(IMGW_HYDRO_API, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      return null;
    }

    const rows = (await res.json()) as ImgwRow[];

    let best: { row: ImgwRow; distance: number } | null = null;

    for (const row of rows) {
      const stationLat = toNumber(row.lat);
      const stationLng = toNumber(row.lon);
      if (stationLat === null || stationLng === null) {
        continue;
      }

      const distance = distanceKm(lat, lng, stationLat, stationLng);
      if (!best || distance < best.distance) {
        best = { row, distance };
      }
    }

    if (!best || best.distance > MAX_STATION_DISTANCE_KM) {
      return null;
    }

    const row = best.row;
    const waterLevelCm = toNumber(row.stan_wody);
    const warningLevelCm = toNumber(row.stan_ostrzegawczy);
    const alarmLevelCm = toNumber(row.stan_alarmowy);

    return {
      id: row.id_stacji ?? "",
      name: row.stacja ?? "Nieznana stacja",
      river: row.rzeka ?? "",
      province: row.wojewodztwo ?? "",
      distanceKm: Number(best.distance.toFixed(1)),
      waterLevelCm,
      waterLevelAt: row.stan_wody_data_pomiaru,
      waterTemperature: toNumber(row.temperatura_wody),
      waterTemperatureAt: row.temperatura_wody_data_pomiaru,
      dischargeM3s: toNumber(row.przeplyw),
      dischargeAt: row.przeplyw_data,
      warningLevelCm,
      alarmLevelCm,
      status: classify(waterLevelCm, warningLevelCm, alarmLevelCm),
    };
  } catch {
    return null;
  }
}

export async function getRiverDischarge(
  lat: number,
  lng: number,
): Promise<RiverDischarge | null> {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    daily: "river_discharge",
    past_days: "7",
    forecast_days: "7",
  });

  try {
    const res = await fetch(`${FLOOD_API}?${params}`, {
      next: { revalidate: REVALIDATE_SECONDS },
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    const dates = data?.daily?.time as string[] | undefined;
    const values = data?.daily?.river_discharge as (number | null)[] | undefined;

    if (!dates || !values) {
      return null;
    }

    const series = dates
      .map((date, i) => ({ date, value: values[i] }))
      .filter((point): point is { date: string; value: number } => point.value !== null);

    if (series.length === 0) {
      return null;
    }

    // past_days=7 ustawia dzisiaj na ósmej pozycji; gdyby API przycięło serię,
    // schodzimy na ostatni dostępny punkt.
    const todayIndex = Math.min(7, series.length - 1);
    const today = series[todayIndex].value;
    const weekAgo = series[0].value;

    const changePercent = weekAgo === 0 ? 0 : ((today - weekAgo) / weekAgo) * 100;

    return {
      today,
      series,
      trend: changePercent > 8 ? "rosnie" : changePercent < -8 ? "spada" : "stabilny",
      changePercent: Number(changePercent.toFixed(0)),
    };
  } catch {
    return null;
  }
}

export async function getHydrology(lat: number, lng: number): Promise<Hydrology> {
  const [station, discharge] = await Promise.all([
    getNearestHydroStation(lat, lng),
    getRiverDischarge(lat, lng),
  ]);

  return { station, discharge };
}
