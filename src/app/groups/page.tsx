import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createGroup, joinGroup, leaveGroup } from "./actions";
import {
  page,
  card,
  cardCompact,
  heading,
  subheading,
  meta,
  input,
  btnPrimary,
  btnGhost,
} from "@/lib/ui";

type Group = {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
};

export default async function GroupsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: myGroups } = await supabase.rpc("list_my_groups");
  const myGroupIds = new Set(((myGroups as Group[]) ?? []).map((g) => g.id));

  const { data: publicGroups } = await supabase
    .from("groups")
    .select("id, name, description, is_private")
    .eq("is_private", false);

  const joinableGroups = ((publicGroups as Group[]) ?? []).filter(
    (g) => !myGroupIds.has(g.id),
  );

  return (
    <div className={page}>
      <h1 className={`${heading} mb-4`}>Grupy</h1>

      <form action={createGroup} className={`${card} mb-6 flex flex-col gap-3`}>
        <p className={subheading}>Nowa grupa</p>
        <input
          name="name"
          placeholder="Nazwa grupy"
          required
          className={input}
        />
        <textarea
          name="description"
          rows={2}
          placeholder="Opis (opcjonalnie)"
          className={`${input} resize-none`}
        />
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="is_private" />
          Grupa zamknięta (prywatna)
        </label>
        <button type="submit" className={`${btnPrimary} self-start`}>
          Utwórz
        </button>
      </form>

      <div className="mb-6">
        <h2 className={`${subheading} mb-3`}>Twoje grupy</h2>
        <div className="flex flex-col gap-2">
          {((myGroups as Group[]) ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nie należysz jeszcze do żadnej grupy.
            </p>
          )}
          {((myGroups as Group[]) ?? []).map((g) => (
            <div
              key={g.id}
              className={`${cardCompact} flex items-center justify-between gap-3`}
            >
              <a href={`/groups/${g.id}`} className="hover:text-primary">
                <p className="text-sm font-medium">
                  {g.name} {g.is_private && "🔒"}
                </p>
                {g.description && (
                  <p className="text-xs text-muted-foreground">
                    {g.description}
                  </p>
                )}
              </a>
              <form action={leaveGroup}>
                <input type="hidden" name="group_id" value={g.id} />
                <button type="submit" className={btnGhost}>
                  Opuść
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h2 className={`${subheading} mb-3`}>Publiczne grupy do dołączenia</h2>
        <div className="flex flex-col gap-2">
          {joinableGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Brak nowych grup publicznych.
            </p>
          )}
          {joinableGroups.map((g) => (
            <div
              key={g.id}
              className={`${cardCompact} flex items-center justify-between gap-3`}
            >
              <a href={`/groups/${g.id}`} className="hover:text-primary">
                <p className="text-sm font-medium">{g.name}</p>
                {g.description && (
                  <p className="text-xs text-muted-foreground">
                    {g.description}
                  </p>
                )}
              </a>
              <form action={joinGroup}>
                <input type="hidden" name="group_id" value={g.id} />
                <button type="submit" className={btnPrimary}>
                  Dołącz
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
