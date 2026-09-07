import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
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

  return <MapLoader locations={(data as LocationPoint[]) ?? []} />;
}
