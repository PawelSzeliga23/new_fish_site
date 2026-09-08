-- Zapytanie o kadr czyta teraz chudą warstwę mapową i przyjmuje próg
-- powierzchni zależny od przybliżenia: przy oddalonym widoku staw 0,6 ha to
-- kilka pikseli, a takich obiektów są w kadrze tysiące. Cieki liniowe nie mają
-- powierzchni (area_ha is null) i pokazują się zawsze.
create or replace function water_bodies_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision,
  min_area_ha double precision default 0
)
returns table (
  id uuid,
  name text,
  type text,
  area_ha double precision,
  species text[],
  geojson jsonb
)
language sql
stable
set search_path = public
as $$
  select
    m.id,
    m.name,
    m.type,
    m.area_ha,
    null::text[],
    st_asgeojson(m.geom)::jsonb
  from water_bodies_map m
  where m.geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
    and (m.area_ha is null or m.area_ha >= min_area_ha)
  order by m.area_ha desc nulls last
  limit 300;
$$;

-- PostgREST trzyma schemat w cache; po zmianie sygnatury funkcji klient dostaje
-- "Could not find the function public.water_bodies_in_bbox".
notify pgrst, 'reload schema';
