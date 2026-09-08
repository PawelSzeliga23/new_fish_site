-- 1. Komentarze i lajki nie dziedziczyły widoczności postów.
--
-- posts_select (009_feed_visibility.sql) starannie ogranicza posty do autora,
-- znajomych i członków grupy - ale comments_select i likes_select stały otworem
-- na `auth.role() = 'authenticated'`. Każdy zalogowany mógł strzelić
-- GET /rest/v1/comments?select=* i odczytać treść WSZYSTKICH komentarzy w
-- aplikacji, łącznie z prywatnymi grupami, do których nie należy. RPC tego nie
-- zasłaniały - list_comments i list_comments_for_posts są security invoker,
-- więc opierają się dokładnie na tej polityce.
--
-- 2. Brakujące indeksy na kluczach obcych leżących na ścieżce zapytań.
--
-- 3. auth.uid() w politykach przeliczane dla każdego wiersza. Owinięcie w
--    (select auth.uid()) pozwala planerowi policzyć je raz (initplan) zamiast
--    per wiersz. Semantyka bez zmian.

-- ---------------------------------------------------------------------------
-- 1. Widoczność komentarzy i lajków
-- ---------------------------------------------------------------------------

-- Ta sama reguła co polityka posts_select, wyciągnięta do funkcji. security
-- definer - żeby polityka na comments/likes nie zaglądała do posts przez RLS
-- (i nie zależała od kolejności wyliczania polityk). Bliźniak
-- can_view_location z 017_catch_visibility.sql.
create or replace function can_view_post(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from posts p
    where p.id = target_id
      and (
        p.user_id = (select auth.uid())
        or exists (
          select 1 from friendships f
          where f.status = 'accepted'
            and (
              (f.requester_id = (select auth.uid()) and f.addressee_id = p.user_id)
              or (f.addressee_id = (select auth.uid()) and f.requester_id = p.user_id)
            )
        )
        or (
          p.group_id is not null
          and exists (
            select 1 from group_members gm
            where gm.group_id = p.group_id
              and gm.user_id = (select auth.uid())
          )
        )
      )
  );
$$;

drop policy if exists "comments_select" on comments;
create policy "comments_select" on comments
  for select using (can_view_post(post_id));

drop policy if exists "likes_select" on likes;
create policy "likes_select" on likes
  for select using (can_view_post(post_id));

-- Komentować i lajkować można tylko to, co się widzi - do tej pory warunkiem
-- było samo `user_id = auth.uid()`, więc dało się dopisać komentarz pod postem
-- z cudzej prywatnej grupy.
drop policy if exists "comments_insert_own" on comments;
create policy "comments_insert_own" on comments
  for insert with check (
    (select auth.uid()) = user_id and can_view_post(post_id)
  );

drop policy if exists "likes_insert_own" on likes;
create policy "likes_insert_own" on likes
  for insert with check (
    (select auth.uid()) = user_id and can_view_post(post_id)
  );

drop policy if exists "comments_delete_own" on comments;
create policy "comments_delete_own" on comments
  for delete using ((select auth.uid()) = user_id);

drop policy if exists "likes_delete_own" on likes;
create policy "likes_delete_own" on likes
  for delete using ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Indeksy na kluczach obcych
-- ---------------------------------------------------------------------------

-- list_catches_for_location filtruje po location_id, a po 017 jest to zapytanie
-- wielo-użytkownikowe (statystyki miejscówki), nie tylko własne połowy.
create index if not exists catch_reports_location_id_idx on catch_reports (location_id);
create index if not exists catch_reports_user_id_idx on catch_reports (user_id);

-- friendships ma unikat (requester_id, addressee_id), który obsługuje szukanie
-- po requester_id - ale nie po addressee_id. Polityki widoczności sprawdzają
-- znajomość w obie strony, więc druga kolumna potrzebuje własnego indeksu.
create index if not exists friendships_addressee_id_idx on friendships (addressee_id);

-- Do joinów w list_comments_for_posts / list_group_posts i do kaskad przy
-- usuwaniu konta lub grupy.
create index if not exists comments_user_id_idx on comments (user_id);
create index if not exists likes_user_id_idx on likes (user_id);
create index if not exists posts_group_id_idx on posts (group_id);
create index if not exists posts_location_id_idx on posts (location_id);
create index if not exists locations_user_id_idx on locations (user_id);
create index if not exists group_members_user_id_idx on group_members (user_id);

-- ---------------------------------------------------------------------------
-- 3. (select auth.uid()) w politykach
-- ---------------------------------------------------------------------------
-- Poniżej te same reguły co dotychczas, przepisane 1:1 - jedyna zmiana to
-- owinięcie wywołań auth.* w podzapytanie. Polityki comments i likes zostały
-- już wyżej zapisane w nowej formie.

-- water_bodies
drop policy if exists "water_bodies_select" on water_bodies;
create policy "water_bodies_select" on water_bodies
  for select using ((select auth.role()) = 'authenticated');

drop policy if exists "water_bodies_insert" on water_bodies;
create policy "water_bodies_insert" on water_bodies
  for insert with check ((select auth.uid()) = created_by);

drop policy if exists "water_bodies_update_own" on water_bodies;
create policy "water_bodies_update_own" on water_bodies
  for update using ((select auth.uid()) = created_by);

drop policy if exists "water_bodies_delete_own" on water_bodies;
create policy "water_bodies_delete_own" on water_bodies
  for delete using ((select auth.uid()) = created_by);

-- locations
drop policy if exists "locations_select" on locations;
create policy "locations_select" on locations
  for select using (
    visibility = 'public'
    or user_id = (select auth.uid())
    or (
      visibility = 'friends'
      and exists (
        select 1 from friendships f
        where f.status = 'accepted'
          and (
            (f.requester_id = (select auth.uid()) and f.addressee_id = locations.user_id)
            or (f.addressee_id = (select auth.uid()) and f.requester_id = locations.user_id)
          )
      )
    )
  );

drop policy if exists "locations_insert_own" on locations;
create policy "locations_insert_own" on locations
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "locations_update_own" on locations;
create policy "locations_update_own" on locations
  for update using ((select auth.uid()) = user_id);

drop policy if exists "locations_delete_own" on locations;
create policy "locations_delete_own" on locations
  for delete using ((select auth.uid()) = user_id);

-- posts
drop policy if exists "posts_select" on posts;
create policy "posts_select" on posts
  for select using (
    user_id = (select auth.uid())
    or exists (
      select 1 from friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id = posts.user_id)
          or (f.addressee_id = (select auth.uid()) and f.requester_id = posts.user_id)
        )
    )
    or (
      group_id is not null
      and exists (
        select 1 from group_members gm
        where gm.group_id = posts.group_id
          and gm.user_id = (select auth.uid())
      )
    )
  );

drop policy if exists "posts_insert_own" on posts;
create policy "posts_insert_own" on posts
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "posts_update_own" on posts;
create policy "posts_update_own" on posts
  for update using ((select auth.uid()) = user_id);

drop policy if exists "posts_delete_own" on posts;
create policy "posts_delete_own" on posts
  for delete using ((select auth.uid()) = user_id);

-- profiles
drop policy if exists "profiles_select" on profiles;
create policy "profiles_select" on profiles
  for select using ((select auth.role()) = 'authenticated');

drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using ((select auth.uid()) = id);

-- catch_reports
drop policy if exists "catch_reports_select" on catch_reports;
create policy "catch_reports_select" on catch_reports
  for select using (
    user_id = (select auth.uid())
    or (location_id is not null and can_view_location(location_id))
  );

drop policy if exists "catch_reports_insert_own" on catch_reports;
create policy "catch_reports_insert_own" on catch_reports
  for insert with check ((select auth.uid()) = user_id);

drop policy if exists "catch_reports_delete_own" on catch_reports;
create policy "catch_reports_delete_own" on catch_reports
  for delete using ((select auth.uid()) = user_id);

-- friendships
drop policy if exists "friendships_select" on friendships;
create policy "friendships_select" on friendships
  for select using (
    status = 'accepted'
    or (select auth.uid()) = requester_id
    or (select auth.uid()) = addressee_id
  );

drop policy if exists "friendships_insert" on friendships;
create policy "friendships_insert" on friendships
  for insert with check (
    (select auth.uid()) = requester_id and requester_id <> addressee_id
  );

drop policy if exists "friendships_update" on friendships;
create policy "friendships_update" on friendships
  for update using ((select auth.uid()) = addressee_id);

drop policy if exists "friendships_delete" on friendships;
create policy "friendships_delete" on friendships
  for delete using (
    (select auth.uid()) = requester_id or (select auth.uid()) = addressee_id
  );

-- groups
drop policy if exists "groups_select" on groups;
create policy "groups_select" on groups
  for select using (
    is_private = false
    or exists (
      select 1 from group_members gm
      where gm.group_id = groups.id
        and gm.user_id = (select auth.uid())
    )
  );

drop policy if exists "groups_insert" on groups;
create policy "groups_insert" on groups
  for insert with check ((select auth.uid()) = created_by);

drop policy if exists "groups_update_own" on groups;
create policy "groups_update_own" on groups
  for update using (is_group_admin(id, (select auth.uid())));

drop policy if exists "groups_delete_own" on groups;
create policy "groups_delete_own" on groups
  for delete using ((select auth.uid()) = created_by);

-- group_members
drop policy if exists "group_members_select" on group_members;
create policy "group_members_select" on group_members
  for select using (is_group_member(group_id, (select auth.uid())));

drop policy if exists "group_members_insert" on group_members;
create policy "group_members_insert" on group_members
  for insert with check (
    (
      user_id = (select auth.uid())
      and exists (
        select 1 from groups g
        where g.id = group_members.group_id and g.is_private = false
      )
    )
    or is_group_member(group_id, (select auth.uid()))
  );

drop policy if exists "group_members_delete_own" on group_members;
create policy "group_members_delete_own" on group_members
  for delete using ((select auth.uid()) = user_id);
