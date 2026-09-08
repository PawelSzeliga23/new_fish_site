-- Feed pobierał komentarze osobnym RPC dla KAŻDEGO posta (N+1): 30 postów =
-- 31 round-tripów do Supabase. Ta funkcja zwraca komentarze do całej listy
-- postów w jednym zapytaniu; grupowanie po post_id robi już aplikacja.
-- list_comments(uuid) zostaje - używa jej widok pojedynczego posta.
create or replace function list_comments_for_posts(target_post_ids uuid[])
returns table (
  post_id uuid,
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  content text,
  created_at timestamptz
)
language sql
stable
as $$
  select
    c.post_id,
    c.id,
    c.user_id,
    pr.username,
    pr.avatar_url,
    c.content,
    c.created_at
  from comments c
  join profiles pr on pr.id = c.user_id
  where c.post_id = any(target_post_ids)
  order by c.post_id, c.created_at asc;
$$;

-- Indeksy pod feed. Na bazie założonej ręcznie w panelu ich nie było, a
-- list_feed_posts liczy lajki i komentarze podzapytaniem dla każdego posta.
create index if not exists comments_post_id_created_at_idx on comments (post_id, created_at);
create index if not exists likes_post_id_idx on likes (post_id);
create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_user_id_created_at_idx on posts (user_id, created_at desc);
