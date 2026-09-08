import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { joinGroup, leaveGroup, updateGroupPhoto } from "../actions";
import PostComposer from "@/components/PostComposer";
import FileInput from "@/components/FileInput";
import PostCard, { type PostCardData } from "@/components/PostCard";
import { fetchCommentsByPost } from "@/lib/comments";
import {
  card,
  cardCompact,
  meta,
  subheading,
  btnPrimary,
  btnSecondary,
} from "@/lib/ui";

type Group = {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  avatar_url: string | null;
  cover_url: string | null;
};

type Member = {
  user_id: string;
  username: string;
  avatar_url: string | null;
  role: string;
};

type MyLocation = {
  id: string;
  note: string | null;
};

export default async function GroupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: group } = await supabase
    .from("groups")
    .select("id, name, description, is_private, avatar_url, cover_url")
    .eq("id", id)
    .single();

  if (!group) {
    notFound();
  }

  const g = group as Group;

  const { data: members } = await supabase.rpc("list_group_members", {
    target_group_id: id,
  });
  const memberList = (members as Member[]) ?? [];
  const myMembership = memberList.find((m) => m.user_id === user!.id);
  const isMember = !!myMembership;
  const isAdmin = myMembership?.role === "admin";

  const { data: posts } = isMember
    ? await supabase.rpc("list_group_posts", { target_group_id: id })
    : { data: [] };

  const { data: myLocations } = isMember
    ? await supabase.rpc("list_my_locations")
    : { data: [] };

  const postList = (posts as PostCardData[]) ?? [];
  const commentsByPost = await fetchCommentsByPost(
    supabase,
    postList.map((post) => post.id),
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="h-48 w-full bg-muted">
        {g.cover_url && (
          <img
            src={g.cover_url}
            alt="Tło grupy"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="px-4 pb-6">
        <div className="-mt-14 mb-4 flex items-end justify-between gap-4">
          <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-background bg-muted">
            {g.avatar_url && (
              <img
                src={g.avatar_url}
                alt="Zdjęcie grupy"
                className="h-full w-full object-cover"
              />
            )}
          </div>

          {isMember ? (
            <form action={leaveGroup}>
              <input type="hidden" name="group_id" value={g.id} />
              <button type="submit" className={btnSecondary}>
                Opuść grupę
              </button>
            </form>
          ) : (
            !g.is_private && (
              <form action={joinGroup}>
                <input type="hidden" name="group_id" value={g.id} />
                <button type="submit" className={btnPrimary}>
                  Dołącz
                </button>
              </form>
            )
          )}
        </div>

        <h1 className="text-2xl font-bold">
          {g.name} {g.is_private && "🔒"}
        </h1>
        {g.description && <p className={`${meta} mt-1`}>{g.description}</p>}

        {isAdmin && (
          <form action={updateGroupPhoto} className={`${card} mt-4 flex flex-col gap-3`}>
            <p className={subheading}>Zdjęcia grupy</p>
            <input type="hidden" name="group_id" value={g.id} />
            <div className="flex flex-col gap-2">
              <span className={meta}>Zdjęcie grupy</span>
              <FileInput name="avatar" label="Zmień zdjęcie" />
            </div>
            <div className="flex flex-col gap-2">
              <span className={meta}>Zdjęcie w tle</span>
              <FileInput name="cover" label="Zmień tło" />
            </div>
            <button type="submit" className={`${btnPrimary} self-start`}>
              Zapisz
            </button>
          </form>
        )}

        <div className="mt-6">
          <h2 className="mb-2 font-medium">
            Członkowie ({memberList.length})
          </h2>
          <div className="flex flex-wrap gap-2">
            {memberList.map((m) => (
              <a
                key={m.user_id}
                href={`/u/${m.username}`}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs text-card-foreground"
              >
                {m.username} {m.role === "admin" && "⭐"}
              </a>
            ))}
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-4">
          {isMember ? (
            <>
              <PostComposer
                groupId={g.id}
                placeholder={`Napisz coś w grupie ${g.name}...`}
                locations={((myLocations as MyLocation[]) ?? []).map((loc) => ({
                  id: loc.id,
                  label: loc.note || `Miejscówka ${loc.id.slice(0, 8)}`,
                }))}
              />

              {postList.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  comments={commentsByPost.get(post.id) ?? []}
                  currentUserId={user!.id}
                />
              ))}
              {postList.length === 0 && (
                <p className={meta}>Brak jeszcze postów w tej grupie.</p>
              )}
            </>
          ) : (
            <p className={meta}>Dołącz do grupy, żeby zobaczyć posty.</p>
          )}
        </div>
      </div>
    </div>
  );
}
