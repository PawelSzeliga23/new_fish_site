import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sendFriendRequest } from "@/app/friends/actions";
import PhotoLightbox from "@/components/PhotoLightbox";
import PostCard, { type PostCardData, type PostComment } from "@/components/PostCard";
import { cardCompact, subheading, meta, btnPrimary, btnSecondary } from "@/lib/ui";

type Profile = {
  id: string;
  username: string;
  avatar_url: string | null;
  cover_url: string | null;
  friendship_status:
    | "self"
    | "accepted"
    | "pending_outgoing"
    | "pending_incoming"
    | "none";
};

type Comment = PostComment;

type UserLocation = {
  id: string;
  note: string | null;
  visibility: string;
};

type UserGroup = {
  id: string;
  name: string;
  is_private: boolean;
};

type UserFriend = {
  friend_id: string;
  username: string;
  avatar_url: string | null;
};

export default async function PublicProfilePage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username: rawUsername } = await params;
  const username = decodeURIComponent(rawUsername);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase.rpc("get_profile_by_username", {
    target_username: username,
  });

  if (error) {
    throw new Error(error.message);
  }

  const profile = (data as Profile[])?.[0];
  if (!profile) {
    notFound();
  }

  const isSelf = profile.friendship_status === "self";

  const [{ data: posts }, { data: locations }, { data: groups }, { data: friends }] =
    await Promise.all([
      supabase.rpc("list_user_posts", { target_user_id: profile.id }),
      supabase.rpc("list_user_locations", { target_user_id: profile.id }),
      supabase.rpc("list_user_groups", { target_user_id: profile.id }),
      supabase.rpc("list_user_friends", { target_user_id: profile.id }),
    ]);

  const locationList = (locations as UserLocation[]) ?? [];
  const groupList = (groups as UserGroup[]) ?? [];
  const friendList = (friends as UserFriend[]) ?? [];
  const postList = (posts as PostCardData[]) ?? [];

  const postsWithComments = await Promise.all(
    postList.map(async (post) => {
      const { data: comments } = await supabase.rpc("list_comments", {
        target_post_id: post.id,
      });
      return { post, comments: (comments as Comment[]) ?? [] };
    }),
  );

  return (
    <div className="mx-auto w-full max-w-5xl">
      <div className="h-52 w-full bg-muted">
        {profile.cover_url && (
          <PhotoLightbox
            src={profile.cover_url}
            alt="Tło profilu"
            className="h-full w-full object-cover"
          />
        )}
      </div>

      <div className="px-4 pb-8">
        <div className="-mt-14 mb-4 flex items-end justify-between gap-4">
          <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-background bg-muted">
            {profile.avatar_url && (
              <PhotoLightbox
                src={profile.avatar_url}
                alt="Zdjęcie profilowe"
                className="h-full w-full object-cover"
              />
            )}
          </div>

          {isSelf && (
            <a href="/profile/edit" className={btnSecondary}>
              Edytuj profil
            </a>
          )}
          {profile.friendship_status === "none" && (
            <form action={sendFriendRequest}>
              <input type="hidden" name="addressee_id" value={profile.id} />
              <button type="submit" className={btnPrimary}>
                Wyślij zaproszenie
              </button>
            </form>
          )}
          {profile.friendship_status === "pending_outgoing" && (
            <span className={btnSecondary}>Zaproszenie wysłane</span>
          )}
          {profile.friendship_status === "pending_incoming" && (
            <a href="/friends" className={btnPrimary}>
              Odpowiedz na zaproszenie
            </a>
          )}
          {profile.friendship_status === "accepted" && (
            <span className={btnSecondary}>Znajomi ✓</span>
          )}
        </div>

        <h1 className="mb-6 text-2xl font-bold">{profile.username}</h1>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_280px]">
          <div className="flex flex-col gap-4">
            <h2 className={subheading}>Posty</h2>
            {postsWithComments.length === 0 && (
              <p className={meta}>Brak widocznych postów.</p>
            )}
            {postsWithComments.map(({ post, comments }) => (
              <PostCard
                key={post.id}
                post={post}
                comments={comments as PostComment[]}
                currentUserId={user!.id}
              />
            ))}
          </div>

          <aside className="flex flex-col gap-6">
            <div>
              <h2 className={`${subheading} mb-3`}>
                {isSelf ? "Twoje miejscówki" : "Miejscówki"}
              </h2>
              <div className="flex flex-col gap-2">
                {locationList.length === 0 && (
                  <p className={meta}>Brak widocznych miejscówek.</p>
                )}
                {locationList.map((loc) => (
                  <a
                    key={loc.id}
                    href={`/locations/${loc.id}`}
                    className={`${cardCompact} text-sm transition-colors hover:border-primary`}
                  >
                    {loc.note || `Miejscówka ${loc.id.slice(0, 8)}`}
                    {loc.visibility === "private" && " 🔒"}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h2 className={`${subheading} mb-3`}>Grupy</h2>
              <div className="flex flex-col gap-2">
                {groupList.length === 0 && (
                  <p className={meta}>Brak wspólnych grup.</p>
                )}
                {groupList.map((g) => (
                  <a
                    key={g.id}
                    href={`/groups/${g.id}`}
                    className={`${cardCompact} text-sm transition-colors hover:border-primary`}
                  >
                    {g.name} {g.is_private && "🔒"}
                  </a>
                ))}
              </div>
            </div>

            <div>
              <h2 className={`${subheading} mb-3`}>
                Znajomi ({friendList.length})
              </h2>
              <div className="flex flex-col gap-2">
                {friendList.length === 0 && (
                  <p className={meta}>Brak znajomych.</p>
                )}
                {friendList.slice(0, 8).map((f) => (
                  <a
                    key={f.friend_id}
                    href={`/u/${encodeURIComponent(f.username)}`}
                    className={`${cardCompact} flex items-center gap-2 text-sm transition-colors hover:border-primary`}
                  >
                    <span className="h-7 w-7 overflow-hidden rounded-full bg-muted">
                      {f.avatar_url && (
                        <img
                          src={f.avatar_url}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      )}
                    </span>
                    {f.username}
                  </a>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
