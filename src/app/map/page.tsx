import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getLocationConditions } from "@/lib/weather";
import { getNearestHydroStation } from "@/lib/hydro";
import { computeBiteScore } from "@/lib/bite-score";
import MapLoader from "@/components/MapLoader";
import type { LocationPoint } from "@/components/MapView";

type LocationRow = {
  id: string;
  note: string | null;
  visibility: string;
  lat: number;
  lng: number;
  photos: string[] | null;
  water_body_name: string | null;
  catch_count: number;
};

/**
 * Dokłada do miejscówki to, co pokazuje jej dymek na mapie: bieżące warunki,
 * ocenę brań i najbliższy posterunek wodowskazowy.
 *
 * Wszystkie trzy źródła są cache'owane przez Next na pół godziny, a lista
 * miejscówek jednego użytkownika to kilkanaście pozycji - stąd zgoda na pytanie
 * o nie osobno dla każdej pinezki.
 */
async function withConditions(row: LocationRow): Promise<LocationPoint> {
  const [conditions, station] = await Promise.all([
    getLocationConditions(row.lat, row.lng),
    getNearestHydroStation(row.lat, row.lng),
  ]);

  const bite =
    conditions && conditions.forecast.length > 0
      ? computeBiteScore({
          at: new Date(conditions.current.time),
          pressureMsl: conditions.current.pressureMsl,
          pressureDelta3h: conditions.pressure.delta3h,
          airTemperature: conditions.current.temperature,
          waterTemperature: station?.waterTemperature ?? null,
          windSpeedKmh: conditions.current.windSpeedKmh,
          cloudCover: conditions.current.cloudCover,
          sunrise: new Date(conditions.forecast[0].sunrise),
          sunset: new Date(conditions.forecast[0].sunset),
        })
      : null;

  return {
    id: row.id,
    note: row.note,
    visibility: row.visibility,
    lat: row.lat,
    lng: row.lng,
    photos: row.photos,
    waterBodyName: row.water_body_name,
    catchCount: Number(row.catch_count ?? 0),
    conditions: conditions
      ? {
          temperature: conditions.current.temperature,
          windSpeedKmh: conditions.current.windSpeedKmh,
          windDirection: conditions.current.windDirection,
          pressureMsl: conditions.current.pressureMsl,
          pressureDelta3h: conditions.pressure.delta3h,
          cloudCover: conditions.current.cloudCover,
          weatherCode: conditions.current.weatherCode,
        }
      : null,
    bite: bite ? { score: bite.score, rating: bite.rating, tone: bite.tone } : null,
    hydro: station
      ? {
          station: station.name,
          river: station.river,
          waterLevelCm: station.waterLevelCm,
          waterTemperature: station.waterTemperature,
          dischargeM3s: station.dischargeM3s,
          distanceKm: station.distanceKm,
        }
      : null,
  };
}

export default async function MapPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("list_my_locations");

  if (error) {
    throw new Error(error.message);
  }

  // Flaga steruje wyłącznie tym, czy przycisk jest widoczny. Prawdziwą kontrolę
  // trzyma delete_water_body w bazie - ukrycie guzika niczego samo nie chroni.
  const { data: isAdmin } = await supabase.rpc("is_admin");

  // Zbiorników nie ładujemy tutaj: po imporcie ze zrzutów OSM jest ich w bazie
  // sto tysięcy, więc mapa dociąga je sama dla aktualnego kadru.
  const locations = await Promise.all(
    ((data as LocationRow[]) ?? []).map(withConditions),
  );

  return <MapLoader locations={locations} isAdmin={isAdmin === true} />;
}
