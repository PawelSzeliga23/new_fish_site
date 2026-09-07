import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { updateProfile } from "../actions";
import FileInput from "@/components/FileInput";
import { page, card, heading, meta, input, btnPrimary, btnSecondary } from "@/lib/ui";

export default async function ProfileEditPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("username, avatar_url, cover_url")
    .eq("id", user.id)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return (
    <div className={page}>
      <h1 className={`${heading} mb-5`}>Edytuj profil</h1>

      <form action={updateProfile} className={`${card} flex flex-col gap-4`}>
        <div className="flex items-center gap-4">
          <div className="h-20 w-20 overflow-hidden rounded-full bg-muted">
            {profile.avatar_url && (
              <img
                src={profile.avatar_url}
                alt="Obecny avatar"
                className="h-full w-full object-cover"
              />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <span className={meta}>Zdjęcie profilowe</span>
            <FileInput name="avatar" label="Zmień avatar" />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className={meta}>Zdjęcie w tle</span>
          {profile.cover_url && (
            <img
              src={profile.cover_url}
              alt="Obecne tło"
              className="h-24 w-full rounded-xl object-cover"
            />
          )}
          <FileInput name="cover" label="Zmień tło" />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="username" className={meta}>
            Nazwa użytkownika
          </label>
          <input
            id="username"
            name="username"
            defaultValue={profile.username}
            required
            className={input}
          />
        </div>

        <div className="flex gap-2">
          <button type="submit" className={btnPrimary}>
            Zapisz zmiany
          </button>
          <a href={`/u/${encodeURIComponent(profile.username)}`} className={btnSecondary}>
            Anuluj
          </a>
        </div>
      </form>
    </div>
  );
}
