import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeather } from "@/lib/weather";
import MapLoader from "@/components/MapLoader";
import type { LocationPoint } from "@/components/MapView";

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

  const locations = await Promise.all(
    ((data as Omit<LocationPoint, "weather">[]) ?? []).map(async (loc) => ({
      ...loc,
      weather: await getCurrentWeather(loc.lat, loc.lng),
    })),
  );

  return <MapLoader locations={locations} />;
}
