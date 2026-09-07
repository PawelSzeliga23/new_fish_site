-- Post może (opcjonalnie) należeć do grupy
alter table posts add column group_id uuid references groups(id);

-- posts_select: własne posty + znajomych + z grup, których jestem członkiem
-- (zamiast "wszyscy zalogowani widzą wszystko")
drop policy "posts_select" on posts;

create policy "posts_select" on posts
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = auth.uid() and f.addressee_id = posts.user_id)
          or (f.addressee_id = auth.uid() and f.requester_id = posts.user_id)
        )
    )
    or (
      group_id is not null
      and exists (
        select 1 from group_members gm
        where gm.group_id = posts.group_id and gm.user_id = auth.uid()
      )
    )
  );

-- locations_select: dorzucamy visibility = 'friends' (do tej pory traktowane jak 'private')
drop policy "locations_select" on locations;

create policy "locations_select" on locations
  for select using (
    visibility = 'public'
    or user_id = auth.uid()
    or (
      visibility = 'friends'
      and exists (
        select 1 from friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = auth.uid() and f.addressee_id = locations.user_id)
            or (f.addressee_id = auth.uid() and f.requester_id = locations.user_id)
          )
      )
    )
  );

-- list_feed_posts: RLS na posts już filtruje wiersze (własne/znajomi/grupy),
-- funkcja tylko dorzuca nazwę grupy do wyniku
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
  location_note text,
  group_id uuid,
  group_name text
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
    loc.note as location_note,
    p.group_id,
    g.name as group_name
  from posts p
  join profiles pr on pr.id = p.user_id
  left join locations loc on loc.id = p.location_id
  left join groups g on g.id = p.group_id
  order by p.created_at desc;
$$;
