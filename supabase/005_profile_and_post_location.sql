-- Bucket na avatary
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "avatars_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_update_own" on storage.objects
  for update using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_delete_own" on storage.objects
  for delete using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- list_feed_posts: dorzucamy location_id i notatkę powiązanej miejscówki
-- (drop wymagany, bo zmienia się struktura returns table)
drop function if exists list_feed_posts();

create or replace function list_feed_posts()
returns table (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  content text,
  photos text[],
  created_at timestamptz,
  like_count bigint,
  comment_count bigint,
  liked_by_me boolean,
  location_id uuid,
  location_note text
)
language sql
stable
as $$
  select
    p.id,
    p.user_id,
    pr.username,
    pr.avatar_url,
    p.content,
    p.photos,
    p.created_at,
    (select count(*) from likes l where l.post_id = p.id) as like_count,
    (select count(*) from comments c where c.post_id = p.id) as comment_count,
    exists(
      select 1 from likes l2 where l2.post_id = p.id and l2.user_id = auth.uid()
    ) as liked_by_me,
    p.location_id,
    loc.note as location_note
  from posts p
  join profiles pr on pr.id = p.user_id
  left join locations loc on loc.id = p.location_id
  order by p.created_at desc;
$$;
