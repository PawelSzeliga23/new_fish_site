import type { createClient } from "@/lib/supabase/server";
import type { PostComment } from "@/components/PostCard";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type CommentRow = PostComment & { post_id: string };

/**
 * Komentarze dla całej listy postów w JEDNYM zapytaniu.
 * Wcześniej każdy widok feedu wołał list_comments osobno dla każdego posta.
 */
export async function fetchCommentsByPost(
  supabase: SupabaseServerClient,
  postIds: string[],
): Promise<Map<string, PostComment[]>> {
  const byPost = new Map<string, PostComment[]>();

  if (postIds.length === 0) {
    return byPost;
  }

  const { data, error } = await supabase.rpc("list_comments_for_posts", {
    target_post_ids: postIds,
  });

  if (error) {
    throw new Error(error.message);
  }

  for (const { post_id, ...comment } of (data as CommentRow[]) ?? []) {
    const existing = byPost.get(post_id);
    if (existing) {
      existing.push(comment);
    } else {
      byPost.set(post_id, [comment]);
    }
  }

  return byPost;
}
