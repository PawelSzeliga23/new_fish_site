"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeather } from "@/lib/weather";

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

export async function updateLocationAccessInfo(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const locationId = formData.get("location_id") as string;
  const accessInfo = (formData.get("access_info") as string) || null;

  const { error } = await supabase
    .from("locations")
    .update({ access_info: accessInfo })
    .eq("id", locationId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/locations/[id]", "page");
}
