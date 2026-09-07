import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  page,
  cardCompact,
  heading,
  subheading,
  meta,
  input,
  btnPrimary,
} from "@/lib/ui";

type PersonResult = {
  id: string;
  username: string;
  avatar_url: string | null;
};

type GroupResult = {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  avatar_url: string | null;
};

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { q } = await searchParams;
  const query = q?.trim() ?? "";

  let people: PersonResult[] = [];
  let groups: GroupResult[] = [];

  if (query) {
    const [{ data: peopleData }, { data: groupsData }] = await Promise.all([
      supabase
        .from("profiles")
        .select("id, username, avatar_url")
        .ilike("username", `%${query}%`)
        .neq("id", user.id)
        .limit(20),
      supabase
        .from("groups")
        .select("id, name, description, is_private, avatar_url")
        .ilike("name", `%${query}%`)
        .limit(20),
    ]);
    people = (peopleData as PersonResult[]) ?? [];
    groups = (groupsData as GroupResult[]) ?? [];
  }

  return (
    <div className={page}>
      <h1 className={`${heading} mb-5`}>Szukaj</h1>

      <form className="mb-6 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={query}
          placeholder="Szukaj osób i grup..."
          className={input}
        />
        <button
          type="submit"
          className={btnPrimary}
        >
          Szukaj
        </button>
      </form>

      {query && (
        <>
          <div className="mb-6">
            <h2 className={`${subheading} mb-3`}>Osoby</h2>
            <div className="flex flex-col gap-2">
              {people.length === 0 && (
                <p className={meta}>Brak wyników.</p>
              )}
              {people.map((p) => (
                <a
                  key={p.id}
                  href={`/u/${p.username}`}
                  className={`${cardCompact} flex items-center gap-3 transition-colors hover:border-primary`}
                >
                  <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
                    {p.avatar_url && (
                      <img
                        src={p.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <span className="text-sm">{p.username}</span>
                </a>
              ))}
            </div>
          </div>

          <div>
            <h2 className={`${subheading} mb-3`}>Grupy</h2>
            <div className="flex flex-col gap-2">
              {groups.length === 0 && (
                <p className={meta}>Brak wyników.</p>
              )}
              {groups.map((g) => (
                <a
                  key={g.id}
                  href={`/groups/${g.id}`}
                  className={`${cardCompact} flex items-center gap-3 transition-colors hover:border-primary`}
                >
                  <div className="h-8 w-8 overflow-hidden rounded-full bg-muted">
                    {g.avatar_url && (
                      <img
                        src={g.avatar_url}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </div>
                  <span className="text-sm">
                    {g.name} {g.is_private && "🔒"}
                  </span>
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
