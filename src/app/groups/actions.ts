"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createGroup(formData: FormData) {
  const supabase = await createClient();

  const name = formData.get("name") as string;
  const description = (formData.get("description") as string) || null;
  const isPrivate = formData.get("is_private") === "on";

  const { error } = await supabase.rpc("create_group", {
    name,
    description,
    is_private: isPrivate,
  });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/groups");
}

export async function joinGroup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const groupId = formData.get("group_id") as string;

  const { error } = await supabase
    .from("group_members")
    .insert({ group_id: groupId, user_id: user.id });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/groups");
}

export async function updateGroupPhoto(formData: FormData) {
  const supabase = await createClient();
  const groupId = formData.get("group_id") as string;
  const avatar = formData.get("avatar") as File | null;
  const cover = formData.get("cover") as File | null;

  const update: { avatar_url?: string; cover_url?: string } = {};

  if (avatar && avatar.size > 0) {
    const path = `${groupId}/${Date.now()}-avatar-${avatar.name}`;
    const { error: uploadError } = await supabase.storage
      .from("group-photos")
      .upload(path, avatar, { contentType: avatar.type });
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("group-photos").getPublicUrl(path);
    update.avatar_url = publicUrl;
  }

  if (cover && cover.size > 0) {
    const path = `${groupId}/${Date.now()}-cover-${cover.name}`;
    const { error: uploadError } = await supabase.storage
      .from("group-photos")
      .upload(path, cover, { contentType: cover.type });
    if (uploadError) {
      throw new Error(uploadError.message);
    }
    const {
      data: { publicUrl },
    } = supabase.storage.from("group-photos").getPublicUrl(path);
    update.cover_url = publicUrl;
  }

  const { error } = await supabase
    .from("groups")
    .update(update)
    .eq("id", groupId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/groups/[id]", "page");
}

export async function leaveGroup(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const groupId = formData.get("group_id") as string;

  const { error } = await supabase
    .from("group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/groups");
}
