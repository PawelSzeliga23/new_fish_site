import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentWeather } from "@/lib/weather";
import PostComposer from "@/components/PostComposer";
import PostCard, { type PostCardData, type PostComment } from "@/components/PostCard";
import { cardCompact, heading, subheading, meta, btnLink } from "@/lib/ui";

type FeedPost = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string | null;
  photos: string[] | null;
  created_at: string;
  like_count: number;
  comment_count: number;
  liked_by_me: boolean;
  location_id: string | null;
  location_note: string | null;
  group_id: string | null;
  group_name: string | null;
};

type MyLocation = {
  id: string;
  note: string | null;
  lat: number;
  lng: number;
};

type MyGroup = {
  id: string;
  name: string;
};

type Friend = {
  friendship_id: string;
  friend_id: string;
  username: string;
  avatar_url: string | null;
};

type Comment = PostComment;

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: posts, error } = await supabase.rpc("list_feed_posts");
  if (error) {
    throw new Error(error.message);
  }

  const [
    { data: myLocations },
    { data: myGroups },
    { data: friends },
  ] = await Promise.all([
    supabase.rpc("list_my_locations"),
    supabase.rpc("list_my_groups"),
    supabase.rpc("list_friends"),
  ]);

  const postsWithComments = await Promise.all(
    (posts as FeedPost[]).map(async (post) => {
      const { data: comments } = await supabase.rpc("list_comments", {
        target_post_id: post.id,
      });
      return { ...post, comments: (comments as Comment[]) ?? [] };
    }),
  );

  const locationsWithWeather = await Promise.all(
    ((myLocations as MyLocation[]) ?? []).slice(0, 6).map(async (loc) => ({
      ...loc,
      weather: await getCurrentWeather(loc.lat, loc.lng),
    })),
  );

  const friendList = ((friends as Friend[]) ?? []).slice(0, 6);
  const groupList = ((myGroups as MyGroup[]) ?? []).slice(0, 6);

  return (
    <div className="mx-auto grid w-full max-w-6xl grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[240px_1fr_280px]">
      <aside className="order-2 lg:order-1">
        <h2 className={`${subheading} mb-3`}>Twoje miejscówki</h2>
        <div className="flex flex-col gap-2">
          {locationsWithWeather.length === 0 && (
            <p className={meta}>Brak miejscówek.</p>
          )}
          {locationsWithWeather.map((loc) => (
            <a
              key={loc.id}
              href={`/locations/${loc.id}`}
              className={`${cardCompact} transition-colors hover:border-primary`}
            >
              <p className="text-sm font-medium">
                {loc.note || `Miejscówka ${loc.id.slice(0, 8)}`}
              </p>
              {loc.weather && (
                <p className="text-xs text-muted-foreground">
                  🌡 {loc.weather.temperature}°C · 💨 {loc.weather.windSpeedKmh} km/h
                </p>
              )}
            </a>
          ))}
          <a href="/map" className={btnLink}>
            Zobacz na mapie
          </a>
        </div>
      </aside>

      <main className="order-1 lg:order-2">
        <h1 className={`${heading} mb-4`}>Strona główna</h1>

        <PostComposer
          locations={((myLocations as MyLocation[]) ?? []).map((loc) => ({
            id: loc.id,
            label: loc.note || `Miejscówka ${loc.id.slice(0, 8)}`,
          }))}
        />

        <div className="flex flex-col gap-4">
          {postsWithComments.map((post) => (
            <PostCard
              key={post.id}
              post={post as PostCardData}
              comments={post.comments as PostComment[]}
              currentUserId={user!.id}
            />
          ))}
        </div>
      </main>

      <aside className="order-3">
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between">
            <h2 className={subheading}>Znajomi</h2>
            <a href="/friends" className={btnLink}>
              Zobacz wszystkich
            </a>
          </div>
          <div className="flex flex-col gap-2">
            {friendList.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nie masz jeszcze znajomych.
              </p>
            )}
            {friendList.map((f) => (
              <a
                key={f.friendship_id}
                href={`/u/${f.username}`}
                className={`${cardCompact} text-sm transition-colors hover:border-primary`}
              >
                {f.username}
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className={subheading}>Grupy</h2>
            <a href="/groups" className={btnLink}>
              Zobacz wszystkie
            </a>
          </div>
          <div className="flex flex-col gap-2">
            {groupList.length === 0 && (
              <p className="text-sm text-muted-foreground">
                Nie należysz jeszcze do żadnej grupy.
              </p>
            )}
            {groupList.map((g) => (
              <a
                key={g.id}
                href={`/groups/${g.id}`}
                className={`${cardCompact} text-sm transition-colors hover:border-primary`}
              >
                {g.name}
              </a>
            ))}
          </div>
        </div>
      </aside>
    </div>
  );
}
