"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

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
