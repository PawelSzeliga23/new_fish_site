import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "./actions";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, avatar_url")
    .eq("id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className="mx-auto max-w-sm p-4">
      <h1 className="mb-4 text-2xl font-bold">Twój profil</h1>

      {profile.avatar_url && (
        <img
          src={profile.avatar_url}
          alt="Avatar"
          className="mb-4 h-24 w-24 rounded-full object-cover"
        />
      )}

      <p className="mb-4 text-sm text-gray-600">{user.email}</p>

      <form action={updateProfile} className="flex flex-col gap-3">
        <label htmlFor="username">Nazwa użytkownika</label>
        <input
          id="username"
          name="username"
          defaultValue={profile.username}
          required
          className="rounded border px-3 py-2"
        />

        <label htmlFor="avatar">Avatar</label>
        <input id="avatar" name="avatar" type="file" accept="image/*" />

        <button
          type="submit"
          className="mt-2 rounded bg-blue-600 py-2 text-white"
        >
          Zapisz
        </button>
      </form>
    </div>
  );
}
