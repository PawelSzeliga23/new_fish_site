-- Profil publiczny użytkownika (auth.users jest ukryte przed PostgREST ze względów bezpieczeństwa)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_url text,
  created_at timestamptz default now()
);

alter table profiles enable row level security;

create policy "profiles_select" on profiles
  for select using (auth.role() = 'authenticated');
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Automatyczne tworzenie profilu przy rejestracji.
-- Nazwa = prefiks emaila + fragment id, żeby uniknąć konfliktu unique i nie blokować rejestracji
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username)
  values (
    new.id,
    split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- Backfill profilu dla kont, które już istnieją (np. Twoje testowe konto)
insert into public.profiles (id, username)
select id, split_part(email, '@', 1) || '_' || substr(id::text, 1, 6)
from auth.users
where id not in (select id from public.profiles);

-- Feed: posty z nazwą autora, licznikiem lajków/komentarzy i flagą czy ja polubiłem
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
  liked_by_me boolean
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
    ) as liked_by_me
  from posts p
  join profiles pr on pr.id = p.user_id
  order by p.created_at desc;
$$;

-- Komentarze z nazwą autora
create or replace function list_comments(target_post_id uuid)
returns table (
  id uuid,
  user_id uuid,
  username text,
  content text,
  created_at timestamptz
)
language sql
stable
as $$
  select c.id, c.user_id, pr.username, c.content, c.created_at
  from comments c
  join profiles pr on pr.id = c.user_id
  where c.post_id = target_post_id
  order by c.created_at asc;
$$;

-- Bucket na zdjęcia w postach
insert into storage.buckets (id, name, public)
values ('post-photos', 'post-photos', true)
on conflict (id) do nothing;

create policy "post_photos_read" on storage.objects
  for select using (bucket_id = 'post-photos');

create policy "post_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'post-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
