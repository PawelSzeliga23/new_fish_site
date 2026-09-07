import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { acceptFriendRequest, removeFriendship } from "./actions";
import {
  page,
  cardCompact,
  heading,
  subheading,
  meta,
  btnPrimary,
  btnGhost,
  btnLink,
} from "@/lib/ui";

type PersonRow = {
  friendship_id: string;
  friend_id?: string;
  requester_id?: string;
  addressee_id?: string;
  username: string;
  avatar_url: string | null;
};

export default async function FriendsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const [{ data: friends }, { data: incoming }, { data: outgoing }] =
    await Promise.all([
      supabase.rpc("list_friends"),
      supabase.rpc("list_incoming_requests"),
      supabase.rpc("list_outgoing_requests"),
    ]);

  return (
    <div className={page}>
      <div className="mb-5 flex items-center justify-between">
        <h1 className={heading}>Znajomi</h1>
        <a href="/search" className={btnLink}>
          Znajdź osoby
        </a>
      </div>

      {((incoming as PersonRow[]) ?? []).length > 0 && (
        <div className="mb-6">
          <h2 className={`${subheading} mb-3`}>Zaproszenia przychodzące</h2>
          <div className="flex flex-col gap-2">
            {(incoming as PersonRow[]).map((r) => (
              <div
                key={r.friendship_id}
                className={`${cardCompact} flex items-center justify-between gap-3`}
              >
                <a href={`/u/${r.username}`} className="text-sm hover:text-primary">
                  {r.username}
                </a>
                <div className="flex gap-2">
                  <form action={acceptFriendRequest}>
                    <input
                      type="hidden"
                      name="friendship_id"
                      value={r.friendship_id}
                    />
                    <button type="submit" className={btnPrimary}>
                      Akceptuj
                    </button>
                  </form>
                  <form action={removeFriendship}>
                    <input
                      type="hidden"
                      name="friendship_id"
                      value={r.friendship_id}
                    />
                    <button
                      type="submit"
                      className={btnGhost}
                    >
                      Odrzuć
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {((outgoing as PersonRow[]) ?? []).length > 0 && (
        <div className="mb-6">
          <h2 className={`${subheading} mb-3`}>Wysłane zaproszenia</h2>
          <div className="flex flex-col gap-2">
            {(outgoing as PersonRow[]).map((r) => (
              <div
                key={r.friendship_id}
                className={`${cardCompact} flex items-center justify-between gap-3`}
              >
                <a href={`/u/${r.username}`} className="text-sm hover:text-primary">
                  {r.username}
                </a>
                <form action={removeFriendship}>
                  <input
                    type="hidden"
                    name="friendship_id"
                    value={r.friendship_id}
                  />
                  <button
                    type="submit"
                    className={btnGhost}
                  >
                    Anuluj
                  </button>
                </form>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <h2 className={`${subheading} mb-3`}>Twoi znajomi</h2>
        <div className="flex flex-col gap-2">
          {((friends as PersonRow[]) ?? []).length === 0 && (
            <p className={meta}>
              Nie masz jeszcze znajomych.
            </p>
          )}
          {(friends as PersonRow[]).map((f) => (
            <div
              key={f.friendship_id}
              className={`${cardCompact} flex items-center justify-between gap-3`}
            >
              <a href={`/u/${f.username}`} className="text-sm hover:text-primary">
                {f.username}
              </a>
              <form action={removeFriendship}>
                <input
                  type="hidden"
                  name="friendship_id"
                  value={f.friendship_id}
                />
                <button type="submit" className={btnGhost}>
                  Usuń
                </button>
              </form>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
