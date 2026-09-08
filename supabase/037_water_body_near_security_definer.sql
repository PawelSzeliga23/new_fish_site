-- water_body_near działało 123 ms jako właściciel i 15,6 s pod rolą
-- authenticated. Winna jest RLS: Postgres przepuszcza przed barierę
-- bezpieczeństwa wyłącznie operatory leakproof, a ST_DWithin taki nie jest.
-- Planer nie mógł więc użyć indeksu water_bodies_geography_idx i skanował
-- wszystkie 103 tys. wierszy, rzutując każdy na geography.
--
-- security definer omija RLS i przywraca użycie indeksu. Nic tu nie wycieka:
-- polityka water_bodies_select i tak udostępnia całą tabelę każdemu
-- zalogowanemu, a funkcja zwraca wyłącznie nazwę, typ i odległość zbiornika.
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
security definer
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

-- link_location_water_body miało ten sam problem - własne wyszukiwanie
-- przestrzenne pod RLS. Zastępujemy je wywołaniem water_body_near; sam UPDATE
-- zostaje pod RLS wywołującego, żeby cudzej miejscówki nie dało się przepiąć.
create or replace function link_location_water_body(target_location_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_point geometry;
  v_water uuid;
begin
  select geom into v_point from locations where id = target_location_id;

  if v_point is null then
    return null;
  end if;

  select n.id into v_water
  from water_body_near(st_y(v_point), st_x(v_point), 500) n;

  update locations set water_body_id = v_water where id = target_location_id;

  return v_water;
end;
$$;

notify pgrst, 'reload schema';
