import { Trash2, User } from "lucide-react";
import {
  addComment,
  deleteComment,
  deletePost,
  likePost,
  unlikePost,
} from "@/app/feed/actions";
import { card, input, meta, btnIcon, btnLink } from "@/lib/ui";

export type PostCardData = {
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
  group_name: string | null;
};

export type PostComment = {
  id: string;
  user_id: string;
  username: string;
  avatar_url: string | null;
  content: string;
  created_at: string;
};

function formatDate(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("pl-PL", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Avatar({
  src,
  size = 40,
}: {
  src: string | null;
  size?: number;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-muted-foreground"
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <User size={size * 0.5} />
      )}
    </div>
  );
}

// Zamienia wzmiankę "@Nazwa miejscówki" w treści na link do tej miejscówki
function renderContent(post: PostCardData) {
  if (!post.content) {
    return null;
  }

  if (!post.location_note || !post.location_id) {
    return <p className="whitespace-pre-wrap">{post.content}</p>;
  }

  const mention = `@${post.location_note}`;
  const parts = post.content.split(mention);

  if (parts.length === 1) {
    return <p className="whitespace-pre-wrap">{post.content}</p>;
  }

  return (
    <p className="whitespace-pre-wrap">
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <a
              href={`/locations/${post.location_id}`}
              className="font-medium text-primary hover:underline"
            >
              {mention}
            </a>
          )}
        </span>
      ))}
    </p>
  );
}

export default function PostCard({
  post,
  comments,
  currentUserId,
}: {
  post: PostCardData;
  comments: PostComment[];
  currentUserId: string;
}) {
  const isMyPost = post.user_id === currentUserId;

  return (
    <article className={card}>
      <header className="flex items-center gap-3">
        <Avatar src={post.avatar_url} />
        <div className="min-w-0 flex-1">
          <a
            href={`/u/${encodeURIComponent(post.username)}`}
            className="block truncate text-sm font-semibold hover:text-primary"
          >
            {post.username}
          </a>
          <p className="text-xs text-muted-foreground">
            {formatDate(post.created_at)}
            {post.group_name && ` · 👥 ${post.group_name}`}
          </p>
        </div>

        {isMyPost && (
          <form action={deletePost}>
            <input type="hidden" name="post_id" value={post.id} />
            <button
              type="submit"
              aria-label="Usuń post"
              className={`${btnIcon} hover:text-red-500`}
            >
              <Trash2 size={16} />
            </button>
          </form>
        )}
      </header>

      <hr className="my-3 border-border" />

      {renderContent(post)}

      {post.photos?.[0] && (
        <img
          src={post.photos[0]}
          alt="Zdjęcie posta"
          className="mt-3 w-full rounded-xl"
        />
      )}

      <div className="mt-3 flex items-center gap-4 text-sm">
        <form action={post.liked_by_me ? unlikePost : likePost}>
          <input type="hidden" name="post_id" value={post.id} />
          <button
            type="submit"
            className={
              post.liked_by_me
                ? "text-red-500"
                : "text-muted-foreground hover:text-red-500"
            }
          >
            ❤ {post.like_count}
          </button>
        </form>
        <span className={meta}>💬 {post.comment_count}</span>
      </div>

      {comments.length > 0 && (
        <div className="mt-3 flex flex-col gap-3 border-t border-border pt-3">
          {comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2">
              <Avatar src={c.avatar_url} size={28} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <a
                    href={`/u/${encodeURIComponent(c.username)}`}
                    className="text-sm font-semibold hover:text-primary"
                  >
                    {c.username}
                  </a>
                  <span className="text-xs text-muted-foreground">
                    {formatDateTime(c.created_at)}
                  </span>
                </div>
                <p className="text-sm">{c.content}</p>
              </div>

              {c.user_id === currentUserId && (
                <form action={deleteComment}>
                  <input type="hidden" name="comment_id" value={c.id} />
                  <button
                    type="submit"
                    aria-label="Usuń komentarz"
                    className={`${btnIcon} p-1 hover:text-red-500`}
                  >
                    <Trash2 size={14} />
                  </button>
                </form>
              )}
            </div>
          ))}
        </div>
      )}

      <form action={addComment} className="mt-3 flex gap-2">
        <input type="hidden" name="post_id" value={post.id} />
        <input
          type="text"
          name="content"
          placeholder="Dodaj komentarz..."
          className={input}
        />
        <button type="submit" className={btnLink}>
          Wyślij
        </button>
      </form>
    </article>
  );
}
