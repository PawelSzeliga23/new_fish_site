"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function sendFriendRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("Musisz być zalogowany");
  }

  const addresseeId = formData.get("addressee_id") as string;

  const { error } = await supabase
    .from("friendships")
    .insert({ requester_id: user.id, addressee_id: addresseeId });

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/friends");
}

export async function acceptFriendRequest(formData: FormData) {
  const supabase = await createClient();
  const friendshipId = formData.get("friendship_id") as string;

  const { error } = await supabase
    .from("friendships")
    .update({ status: "accepted" })
    .eq("id", friendshipId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/friends");
}

export async function removeFriendship(formData: FormData) {
  const supabase = await createClient();
  const friendshipId = formData.get("friendship_id") as string;

  const { error } = await supabase
    .from("friendships")
    .delete()
    .eq("id", friendshipId);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/friends");
}
