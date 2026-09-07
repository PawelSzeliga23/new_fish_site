import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { logout } from "./login/actions";

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto mt-20 max-w-sm text-center">
      <h1 className="mb-4 text-2xl font-bold">Zalogowano jako {user.email}</h1>
      <div className="mb-4 flex justify-center gap-2">
        <a
          href="/map"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
        >
          Otwórz mapę
        </a>
        <a
          href="/feed"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
        >
          Otwórz feed
        </a>
        <a
          href="/profile"
          className="inline-block rounded bg-blue-600 px-4 py-2 text-white"
        >
          Profil
        </a>
      </div>
      <form>
        <button
          formAction={logout}
          className="rounded border border-red-600 px-4 py-2 text-red-600"
        >
          Wyloguj
        </button>
      </form>
    </div>
  );
}
