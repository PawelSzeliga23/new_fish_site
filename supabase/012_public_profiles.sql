alter table profiles add column cover_url text;
alter table groups add column avatar_url text;
alter table groups add column cover_url text;

-- Bucket na zdjęcia grup (avatar/tło) - dowolny członek grupy może je zmieniać
insert into storage.buckets (id, name, public)
values ('group-photos', 'group-photos', true)
on conflict (id) do nothing;

create policy "group_photos_read" on storage.objects
  for select using (bucket_id = 'group-photos');

create policy "group_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'group-photos'
    and is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

create policy "group_photos_update" on storage.objects
  for update using (
    bucket_id = 'group-photos'
    and is_group_member((storage.foldername(name))[1]::uuid, auth.uid())
  );

-- Publiczny profil po nazwie użytkownika + status znajomości z wywołującym
create or replace function get_profile_by_username(target_username text)
returns table (
  id uuid,
  username text,
  avatar_url text,
  cover_url text,
  friendship_status text
)
language sql
stable
as $$
  select
    pr.id,
    pr.username,
    pr.avatar_url,
    pr.cover_url,
    case
      when pr.id = auth.uid() then 'self'
      when exists (
        select 1 from friendships f
        where f.status = 'accepted'
          and ((f.requester_id = auth.uid() and f.addressee_id = pr.id)
               or (f.addressee_id = auth.uid() and f.requester_id = pr.id))
      ) then 'accepted'
      when exists (
        select 1 from friendships f
        where f.status = 'pending' and f.requester_id = auth.uid() and f.addressee_id = pr.id
      ) then 'pending_outgoing'
      when exists (
        select 1 from friendships f
        where f.status = 'pending' and f.addressee_id = auth.uid() and f.requester_id = pr.id
      ) then 'pending_incoming'
      else 'none'
    end as friendship_status
  from profiles pr
  where pr.username = target_username;
$$;

-- Posty konkretnego użytkownika widoczne dla mnie (RLS na posts filtruje resztę)
create or replace function list_user_posts(target_user_id uuid)
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
    p.id, p.user_id, pr.username, pr.avatar_url, p.content, p.photos, p.created_at,
    (select count(*) from likes l where l.post_id = p.id),
    (select count(*) from comments c where c.post_id = p.id),
    exists(select 1 from likes l2 where l2.post_id = p.id and l2.user_id = auth.uid()),
    p.location_id, loc.note, p.group_id, g.name
  from posts p
  join profiles pr on pr.id = p.user_id
  left join locations loc on loc.id = p.location_id
  left join groups g on g.id = p.group_id
  where p.user_id = target_user_id
  order by p.created_at desc;
$$;

-- Posty konkretnej grupy (RLS na posts wpuszcza tylko członków grupy)
create or replace function list_group_posts(target_group_id uuid)
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
    p.id, p.user_id, pr.username, pr.avatar_url, p.content, p.photos, p.created_at,
    (select count(*) from likes l where l.post_id = p.id),
    (select count(*) from comments c where c.post_id = p.id),
    exists(select 1 from likes l2 where l2.post_id = p.id and l2.user_id = auth.uid()),
    p.location_id, loc.note, p.group_id, g.name
  from posts p
  join profiles pr on pr.id = p.user_id
  left join locations loc on loc.id = p.location_id
  left join groups g on g.id = p.group_id
  where p.group_id = target_group_id
  order by p.created_at desc;
$$;
