-- Strona miejscówki rysuje teraz obrys zbiornika na mapce, więc get_water_body
-- musi oddawać geometrię, a nie tylko metadane. Zmiana listy kolumn wymaga
-- drop + create.
drop function if exists get_water_body(uuid);

create or replace function get_water_body(target_id uuid)
returns table (
  id uuid,
  name text,
  type text,
  area_ha double precision,
  species text[],
  source text,
  geojson jsonb
)
language sql
stable
set search_path = public
as $$
  select
    w.id,
    w.name,
    w.type,
    w.area_ha,
    w.species,
    w.source,
    st_asgeojson(w.geom)::jsonb
  from water_bodies w
  where w.id = target_id;
$$;
