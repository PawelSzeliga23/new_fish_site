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

  const content = ((formData.get("content") as string) ?? "").trim() || null;
  const photo = formData.get("photo") as File | null;
  const locationId = (formData.get("location_id") as string) || null;
  const groupId = (formData.get("group_id") as string) || null;

  // pusty post (bez treści i bez zdjęcia) nie ma sensu - nie zapisujemy
  if (!content && (!photo || photo.size === 0)) {
    return;
  }

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

  const { error } = await supabase.from("posts").insert({
    user_id: user.id,
    content,
    photos,
    location_id: locationId,
    group_id: groupId,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/groups/[id]", "page");
}

export async function deletePost(formData: FormData) {
  const { supabase, user } = await requireUser();
  const postId = formData.get("post_id") as string;

  // RLS (posts_delete_own) i tak przepuści tylko własne posty
  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/groups/[id]", "page");
}

export async function deleteComment(formData: FormData) {
  const { supabase, user } = await requireUser();
  const commentId = formData.get("comment_id") as string;

  const { error } = await supabase
    .from("comments")
    .delete()
    .eq("id", commentId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/groups/[id]", "page");
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

  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/groups/[id]", "page");
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

  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/groups/[id]", "page");
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

  revalidatePath("/");
  revalidatePath("/u/[username]", "page");
  revalidatePath("/groups/[id]", "page");
}
