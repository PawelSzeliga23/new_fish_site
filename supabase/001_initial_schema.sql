-- Schemat bazowy: tabele, na których opierają się wszystkie kolejne migracje.
--
-- UWAGA: ten plik został odtworzony po fakcie. Pierwotna wersja schematu
-- (locations, posts, likes, comments) powstała bezpośrednio w panelu Supabase
-- i nigdy nie trafiła do repozytorium - dlatego migracje zaczynały się od 002,
-- a projektu nie dało się postawić od zera na czystej bazie.
--
-- Plik jest idempotentny i bezpieczny dla istniejącej bazy:
--   * tabele i kolumny powstają tylko przez `if not exists`,
--   * polityki RLS zakładane są tylko wtedy, gdy tabela nie ma jeszcze ŻADNEJ
--     polityki (czyli wyłącznie na świeżo utworzonej tabeli).
-- Na Twojej obecnej bazie ten plik nie zmieni więc niczego; na czystej bazie
-- buduje komplet, po czym migracje 002-018 wykonują się po kolei.

create extension if not exists postgis;

-- --------------------------------------------------------------------------
-- Tabele
-- --------------------------------------------------------------------------

-- Miejscówka: punkt na mapie należący do użytkownika.
-- geom trzymamy jako PostGIS Point (SRID 4326), a lat/lng wyliczają funkcje
-- st_y/st_x w RPC - patrz 002_location_rpc.sql.
create table if not exists locations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  geom geometry(Point, 4326) not null,
  note text,
  visibility text not null default 'private'
    check (visibility in ('private', 'friends', 'public')),
  photos text[],
  created_at timestamptz default now()
);

-- Post w feedzie. location_id i group_id są opcjonalne - post może być
-- "przypięty" do miejscówki (005) i/lub opublikowany w grupie (009).
create table if not exists posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  content text,
  photos text[],
  location_id uuid references locations(id) on delete set null,
  created_at timestamptz default now()
);

-- Lajk. Para (post_id, user_id) jest unikalna, więc "polub" jest idempotentne.
create table if not exists likes (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create table if not exists comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  content text not null,
  created_at timestamptz default now()
);

-- Klucze obce do posts dodajemy osobno, bo 016 je podmienia na wersję
-- z `on delete cascade`. Nazwy muszą się zgadzać z tymi, których szuka 016.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'likes_post_id_fkey'
  ) then
    alter table likes add constraint likes_post_id_fkey
      foreign key (post_id) references posts(id);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'comments_post_id_fkey'
  ) then
    alter table comments add constraint comments_post_id_fkey
      foreign key (post_id) references posts(id);
  end if;
end $$;

-- --------------------------------------------------------------------------
-- Indeksy
-- --------------------------------------------------------------------------

create index if not exists locations_geom_idx on locations using gist (geom);
create index if not exists locations_user_id_idx on locations (user_id);
create index if not exists posts_user_id_created_at_idx on posts (user_id, created_at desc);
create index if not exists posts_created_at_idx on posts (created_at desc);
create index if not exists posts_location_id_idx on posts (location_id);
create index if not exists likes_post_id_idx on likes (post_id);
create index if not exists comments_post_id_created_at_idx on comments (post_id, created_at);

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------

alter table locations enable row level security;
alter table posts enable row level security;
alter table likes enable row level security;
alter table comments enable row level security;

-- Polityki zakładamy tylko na tabeli, która ich jeszcze nie ma - dzięki temu
-- uruchomienie pliku na istniejącej bazie nie nadpisze niczego, co już działa.
-- Wersje `*_select` dla locations i posts są tu w formie sprzed 009; migracja
-- 009_feed_visibility.sql podmienia je na wersję ze znajomymi i grupami.

do $$
begin
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'locations'
  ) then
    create policy "locations_select" on locations
      for select using (visibility = 'public' or user_id = auth.uid());
    create policy "locations_insert_own" on locations
      for insert with check (auth.uid() = user_id);
    create policy "locations_update_own" on locations
      for update using (auth.uid() = user_id);
    create policy "locations_delete_own" on locations
      for delete using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'posts'
  ) then
    create policy "posts_select" on posts
      for select using (auth.role() = 'authenticated');
    create policy "posts_insert_own" on posts
      for insert with check (auth.uid() = user_id);
    create policy "posts_update_own" on posts
      for update using (auth.uid() = user_id);
    create policy "posts_delete_own" on posts
      for delete using (auth.uid() = user_id);
  end if;

  -- Lajk/komentarz widać wtedy, gdy widać sam post: podzapytanie do posts
  -- podlega polityce posts_select, więc reguła zostaje spójna z 009.
  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'likes'
  ) then
    create policy "likes_select" on likes
      for select using (
        exists (select 1 from posts p where p.id = likes.post_id)
      );
    create policy "likes_insert_own" on likes
      for insert with check (auth.uid() = user_id);
    create policy "likes_delete_own" on likes
      for delete using (auth.uid() = user_id);
  end if;

  if not exists (
    select 1 from pg_policies where schemaname = 'public' and tablename = 'comments'
  ) then
    create policy "comments_select" on comments
      for select using (
        exists (select 1 from posts p where p.id = comments.post_id)
      );
    create policy "comments_insert_own" on comments
      for insert with check (auth.uid() = user_id);
    create policy "comments_delete_own" on comments
      for delete using (auth.uid() = user_id);
  end if;
end $$;
