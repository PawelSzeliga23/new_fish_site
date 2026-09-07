"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }
  return { supabase, user };
}

export async function createPost(formData: FormData) {
  const { supabase, user } = await requireUser();

  const content = (formData.get("content") as string) || null;
  const photo = formData.get("photo") as File | null;
  const locationId = (formData.get("location_id") as string) || null;

  let photos: string[] | null = null;

  if (photo && photo.size > 0) {
    const path = `${user.id}/${Date.now()}-${photo.name}`;
    const { error: uploadError } = await supabase.storage
      .from("post-photos")
      .upload(path, photo, { contentType: photo.type });

    if (uploadError) {
      throw new Error(uploadError.message);
    }

    const {
      data: { publicUrl },
    } = supabase.storage.from("post-photos").getPublicUrl(path);
    photos = [publicUrl];
  }

  const { error } = await supabase
    .from("posts")
    .insert({ user_id: user.id, content, photos, location_id: locationId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/feed");
}

export async function addComment(formData: FormData) {
  const { supabase, user } = await requireUser();

  const postId = formData.get("post_id") as string;
  const content = formData.get("content") as string;

  if (!content?.trim()) {
    return;
  }

  const { error } = await supabase
    .from("comments")
    .insert({ post_id: postId, user_id: user.id, content });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/feed");
}

export async function likePost(formData: FormData) {
  const { supabase, user } = await requireUser();
  const postId = formData.get("post_id") as string;

  const { error } = await supabase
    .from("likes")
    .insert({ post_id: postId, user_id: user.id });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/feed");
}

export async function unlikePost(formData: FormData) {
  const { supabase, user } = await requireUser();
  const postId = formData.get("post_id") as string;

  const { error } = await supabase
    .from("likes")
    .delete()
    .eq("post_id", postId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/feed");
}
