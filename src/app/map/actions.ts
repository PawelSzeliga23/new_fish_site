"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeather } from "@/lib/weather";
import { fetchWaterBodiesNear } from "@/lib/overpass";

export async function addLocation(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const note = (formData.get("note") as string) || null;
  const visibility = (formData.get("visibility") as string) || "private";
  const photo = formData.get("photo") as File | null;

  let photos: string[] | null = null;

  if (photo && photo.size > 0) {
    const path = `${user.id}/${Date.now()}-${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("location-photos")
      .upload(path, photo, { contentType: photo.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("location-photos").getPublicUrl(path);
    photos = [publicUrl];
  }

  const { error } = await supabase.rpc("add_location", {
    lat,
    lng,
    note,
    visibility,
    photos,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/map");
}

export async function logCatch(formData: FormData) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const locationId = formData.get("location_id") as string;
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  const species = formData.get("species") as string;
  const weightKg = formData.get("weight_kg")
    ? Number(formData.get("weight_kg"))
    : null;
  const lengthCm = formData.get("length_cm")
    ? Number(formData.get("length_cm"))
    : null;
  const photo = formData.get("photo") as File | null;

  let photos: string[] | null = null;

  if (photo && photo.size > 0) {
    const path = `${user.id}/${Date.now()}-${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("catch-photos")
      .upload(path, photo, { contentType: photo.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("catch-photos").getPublicUrl(path);
    photos = [publicUrl];
  }

  const conditionsSnapshot = await getCurrentWeather(lat, lng);

  const { error } = await supabase.from("catch_reports").insert({
    user_id: user.id,
    location_id: locationId,
    species,
    weight_kg: weightKg,
    length_cm: lengthCm,
    conditions_snapshot: conditionsSnapshot,
    photos,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/map");
  revalidatePath("/locations/[id]", "page");
}


/**
 * Pobiera z OpenStreetMap obrysy zbiorników wokół miejscówki, zapisuje je do
 * water_bodies i przypina do miejscówki ten, na którym faktycznie leży pinezka.
 *
 * Import jest świadomie ręczny (przycisk na stronie miejscówki), a nie
 * automatyczny przy dodawaniu punktu: zapytanie do Overpass potrafi trwać
 * kilkadziesiąt sekund i bywa odrzucane przy przeciążeniu, więc nie może
 * blokować dodania miejscówki.
 */
export async function detectWaterBody(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const locationId = formData.get("location_id") as string;
  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));

  // Najpierw próba na danych, które już mamy - po imporcie ze zrzutu Geofabrika
  // w bazie leżą wszystkie polskie zbiorniki, więc w większości przypadków
  // wystarczy dopasowanie i nie ruszamy w ogóle Overpassa.
  const { data: linked, error: linkError } = await supabase.rpc(
    "link_location_water_body",
    { target_location_id: locationId },
  );

  if (linkError) {
    throw new Error(linkError.message);
  }

  // Dopiero gdy w bazie nic nie pasuje (nowy zbiornik, zmiana w OSM po
  // imporcie), schodzimy do Overpassa - to droga wolna i zawodna, więc jest
  // ostatecznością, a nie pierwszym krokiem.
  if (!linked) {
    await importWaterBodies(supabase, lat, lng, 1200);

    const { error: retryError } = await supabase.rpc("link_location_water_body", {
      target_location_id: locationId,
    });

    if (retryError) {
      throw new Error(retryError.message);
    }
  }

  revalidatePath("/locations/[id]", "page");
  revalidatePath("/map");
}

type ServerClient = Awaited<ReturnType<typeof createClient>>;

/**
 * Wspólny zapis obrysów z OSM do bazy. Zwraca liczbę faktycznie zapisanych
 * zbiorników - pojedynczy felerny obrys (niepoprawna geometria w OSM) nie może
 * przerwać importu całej okolicy.
 */
async function importWaterBodies(
  supabase: ServerClient,
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<number> {
  const bodies = await fetchWaterBodiesNear(lat, lng, radiusMeters);
  let saved = 0;

  for (const body of bodies) {
    const { error } = await supabase.rpc("upsert_osm_water_body", {
      p_osm_id: body.osmId,
      p_name: body.name,
      p_type: body.type,
      p_geojson: body.geojson,
    });

    if (error) {
      console.error(`Nie udało się zapisać zbiornika OSM ${body.osmId}:`, error.message);
    } else {
      saved++;
    }
  }

  return saved;
}

/**
 * Import obrysów dla aktualnego widoku mapy - bez wiązania z miejscówką.
 * Dzięki temu warstwa zbiorników zapełnia się tam, gdzie użytkownik faktycznie
 * patrzy, zamiast czekać, aż ktoś doda pinezkę.
 */
export type ImportResult = { ok: true; saved: number } | { ok: false; message: string };

export async function importWaterBodiesAt(formData: FormData): Promise<ImportResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, message: "Musisz być zalogowany" };
  }

  const lat = Number(formData.get("lat"));
  const lng = Number(formData.get("lng"));
  // Overpass odrzuca zapytania o geometrię z dużego obszaru, więc trzymamy
  // promień w rozsądnych ryzach niezależnie od tego, co przyśle klient.
  const radius = Math.min(5000, Math.max(500, Number(formData.get("radius")) || 1500));

  // Niedostępny Overpass to normalny stan świata, nie awaria aplikacji. Rzucony
  // wyjątek zamieniałby kliknięcie w przycisk na odpowiedź 500 i pustą stronę,
  // więc zwracamy wynik, który przycisk umie pokazać.
  try {
    const saved = await importWaterBodies(supabase, lat, lng, radius);
    revalidatePath("/map");
    return { ok: true, saved };
  } catch (err) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : "Nie udało się pobrać obrysów.",
    };
  }
}

/**
 * Pełna edycja miejscówki - nazwa, widoczność, dojazd i zdjęcie. Zastępuje
 * dawny formularz opisu dojazdu wpięty w stronę miejscówki, żeby wszystko, co
 * właściciel może zmienić, siedziało w jednym miejscu (tak jak edycja profilu).
 */
export async function updateLocation(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const locationId = formData.get("location_id") as string;
  const note = ((formData.get("note") as string) ?? "").trim() || null;
  const visibility = (formData.get("visibility") as string) || "private";
  const accessInfo = ((formData.get("access_info") as string) ?? "").trim() || null;
  const photo = formData.get("photo") as File | null;

  const update: {
    note: string | null;
    visibility: string;
    access_info: string | null;
    photos?: string[];
  } = { note, visibility, access_info: accessInfo };

  if (photo && photo.size > 0) {
    const path = `${user.id}/${Date.now()}-${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("location-photos")
      .upload(path, photo, { contentType: photo.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("location-photos").getPublicUrl(path);
    update.photos = [publicUrl];
  }

  // RLS (locations_update_own) pilnuje, że edytować może tylko właściciel -
  // nie duplikujemy tego warunku w kodzie.
  const { error } = await supabase.from("locations").update(update).eq("id", locationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/locations/[id]", "page");
  revalidatePath("/map");
  redirect(`/locations/${locationId}`);
}
