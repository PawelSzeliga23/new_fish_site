"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const username = formData.get("username") as string;
  const avatar = formData.get("avatar") as File | null;
  const cover = formData.get("cover") as File | null;

  const update: { username: string; avatar_url?: string; cover_url?: string } = {
    username,
  };

  if (avatar && avatar.size > 0) {
    const path = `${user.id}/${Date.now()}-avatar-${avatar.name}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, avatar, { contentType: avatar.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    update.avatar_url = publicUrl;
  }

  if (cover && cover.size > 0) {
    const path = `${user.id}/${Date.now()}-cover-${cover.name}`;
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(path, cover, { contentType: cover.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("avatars").getPublicUrl(path);
    update.cover_url = publicUrl;
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/u/[username]", "page");
  revalidatePath("/");

  redirect(`/u/${encodeURIComponent(username)}`);
}
