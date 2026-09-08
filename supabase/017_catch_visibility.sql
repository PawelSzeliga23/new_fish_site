-- Połowy były widoczne wyłącznie dla autora (catch_reports_select_own), więc
-- statystyki miejscówki (liczba ryb, łączna waga, gatunki) na cudzej lub
-- wspólnej miejscówce pokazywały tylko własne wpisy - a to właśnie te wspólne
-- dane są sensem miejscówki publicznej.
--
-- Nowa reguła: widzisz połów, jeśli jest Twój ALBO jest przypięty do
-- miejscówki, którą i tak możesz zobaczyć (public / własna / friends).
-- Połów bez miejscówki (location_id is null) pozostaje prywatny.

-- Widoczność miejscówki jako funkcja - ta sama reguła co polityka
-- locations_select z 009_feed_visibility.sql. security definer, żeby polityka
-- na catch_reports nie zaglądała do locations przez RLS (i nie zależała od
-- kolejności wyliczania polityk).
create or replace function can_view_location(target_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from locations l
    where l.id = target_id
      and (
        l.visibility = 'public'
        or l.user_id = auth.uid()
        or (
          l.visibility = 'friends'
          and exists (
            select 1 from friendships f
            where f.status = 'accepted'
              and (
                (f.requester_id = auth.uid() and f.addressee_id = l.user_id)
                or (f.addressee_id = auth.uid() and f.requester_id = l.user_id)
              )
          )
        )
      )
  );
$$;

drop policy "catch_reports_select_own" on catch_reports;

create policy "catch_reports_select" on catch_reports
  for select using (
    user_id = auth.uid()
    or (location_id is not null and can_view_location(location_id))
  );

-- list_catches_for_location: zdejmujemy filtr `user_id = auth.uid()` (od teraz
-- robi to RLS) i dorzucamy autora, bo lista przestała być jednoosobowa.
-- (drop wymagany - funkcja zwracała `setof catch_reports`)
drop function if exists list_catches_for_location(uuid);

create or replace function list_catches_for_location(target_location_id uuid)
returns table (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  species text,
  weight_kg float,
  length_cm float,
  caught_at timestamptz,
  photos text[],
  created_at timestamptz
)
language sql
stable
as $$
  select
    c.id,
    c.user_id,
    pr.username,
    pr.avatar_url,
    c.species,
    c.weight_kg,
    c.length_cm,
    c.caught_at,
    c.photos,
    c.created_at
  from catch_reports c
  join profiles pr on pr.id = c.user_id
  where c.location_id = target_location_id
  order by c.caught_at desc;
$$;
