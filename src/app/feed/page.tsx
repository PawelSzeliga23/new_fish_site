import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createPost, addComment, likePost, unlikePost } from "./actions";

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
};

type MyLocation = {
  id: string;
  note: string | null;
};

type Comment = {
  id: string;
  user_id: string;
  username: string;
  content: string;
  created_at: string;
};

export default async function FeedPage() {
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

  const { data: myLocations } = await supabase.rpc("list_my_locations");

  const postsWithComments = await Promise.all(
    (posts as FeedPost[]).map(async (post) => {
      const { data: comments } = await supabase.rpc("list_comments", {
        target_post_id: post.id,
      });
      return { ...post, comments: (comments as Comment[]) ?? [] };
    }),
  );

  return (
    <div className="mx-auto max-w-xl p-4">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Feed</h1>
        <div className="flex gap-3">
          <a href="/map" className="text-sm text-blue-600 underline">
            Mapa
          </a>
          <a href="/profile" className="text-sm text-blue-600 underline">
            Profil
          </a>
        </div>
      </div>

      <form
        action={createPost}
        className="mb-6 flex flex-col gap-2 rounded border p-3"
      >
        <textarea
          name="content"
          placeholder="Co złowiłeś?"
          className="rounded border p-2 text-sm"
        />
        <input type="file" name="photo" accept="image/*" className="text-sm" />
        <select name="location_id" className="rounded border p-2 text-sm">
          <option value="">Bez powiązanej miejscówki</option>
          {((myLocations as MyLocation[]) ?? []).map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.note || `Miejscówka ${loc.id.slice(0, 8)}`}
            </option>
          ))}
        </select>
        <button
          type="submit"
          className="self-start rounded bg-blue-600 px-4 py-1 text-sm text-white"
        >
          Opublikuj
        </button>
      </form>

      <div className="flex flex-col gap-4">
        {postsWithComments.map((post) => (
          <div key={post.id} className="rounded border p-3">
            <p className="text-sm font-medium">{post.username}</p>
            {post.content && <p className="mt-1">{post.content}</p>}
            {post.location_note && (
              <p className="mt-1 text-xs text-gray-500">
                📍 {post.location_note}
              </p>
            )}
            {post.photos?.[0] && (
              <img
                src={post.photos[0]}
                alt="Zdjęcie posta"
                className="mt-2 w-full rounded"
              />
            )}

            <div className="mt-2 flex items-center gap-3 text-sm">
              <form action={post.liked_by_me ? unlikePost : likePost}>
                <input type="hidden" name="post_id" value={post.id} />
                <button
                  type="submit"
                  className={post.liked_by_me ? "text-red-600" : ""}
                >
                  ❤ {post.like_count}
                </button>
              </form>
              <span>💬 {post.comment_count}</span>
            </div>

            <div className="mt-2 flex flex-col gap-1">
              {post.comments.map((c) => (
                <p key={c.id} className="text-sm">
                  <span className="font-medium">{c.username}: </span>
                  {c.content}
                </p>
              ))}
            </div>

            <form action={addComment} className="mt-2 flex gap-2">
              <input type="hidden" name="post_id" value={post.id} />
              <input
                type="text"
                name="content"
                placeholder="Dodaj komentarz..."
                className="flex-1 rounded border p-1 text-sm"
              />
              <button type="submit" className="text-sm text-blue-600">
                Wyślij
              </button>
            </form>
          </div>
        ))}
      </div>
    </div>
  );
}
