-- Miejscówka ma sens tylko nad wodą, więc add_location odrzuca punkty dalej niż
-- 50 m od jakiegokolwiek zbiornika lub cieku. Dane pochodzą z importu zrzutów
-- Geofabrika (scripts/import-water-bodies.mjs) - stąd niski próg powierzchni
-- przy imporcie: pominięty staw to miejsce, którego nikt nie doda.
--
-- Przy okazji znika martwa 4-argumentowa wersja add_location: aplikacja od
-- dawna woła wariant ze zdjęciami, a druga sygnatura była tylko pułapką.
drop function if exists add_location(double precision, double precision, text, text);
drop function if exists add_location(double precision, double precision, text, text, text[]);

create or replace function max_distance_to_water()
returns double precision
language sql
immutable
as $$ select 50.0 $$;

-- Najbliższy zbiornik dla punktu - używa jej zarówno walidacja przy zapisie,
-- jak i podpowiedź na mapie przed wysłaniem formularza.
create or replace function water_body_near(
  lat double precision,
  lng double precision,
  max_meters double precision default null
)
returns table (
  id uuid,
  name text,
  type text,
  distance_m double precision
)
language sql
stable
set search_path = public
as $$
  select
    w.id,
    w.name,
    w.type,
    round(st_distance(w.geom::geography, st_setsrid(st_makepoint(lng, lat), 4326)::geography)::numeric, 1)::double precision
  from water_bodies w
  where st_dwithin(
    w.geom::geography,
    st_setsrid(st_makepoint(lng, lat), 4326)::geography,
    coalesce(max_meters, max_distance_to_water())
  )
  order by st_distance(w.geom::geography, st_setsrid(st_makepoint(lng, lat), 4326)::geography)
  limit 1;
$$;

create or replace function add_location(
  lat double precision,
  lng double precision,
  note text,
  visibility text,
  photos text[] default null
)
returns locations
language plpgsql
set search_path = public
as $$
declare
  new_location locations;
  nearest record;
begin
  select * into nearest from water_body_near(lat, lng);

  if nearest.id is null then
    raise exception 'Miejscówkę można postawić najwyżej % m od wody. Wybierz punkt przy brzegu zbiornika lub rzeki.',
      max_distance_to_water()::int
      using errcode = 'check_violation';
  end if;

  insert into locations (user_id, geom, note, visibility, photos, water_body_id)
  values (
    auth.uid(),
    st_setsrid(st_makepoint(lng, lat), 4326),
    note,
    visibility,
    photos,
    nearest.id
  )
  returning * into new_location;

  return new_location;
end;
$$;
