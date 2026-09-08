-- Masowy import zbiorników ze zrzutu Geofabrika (scripts/import-water-bodies.mjs).
-- Osobna funkcja od upsert_osm_water_body, bo tamta wymaga auth.uid() (import
-- z aplikacji robi zalogowany użytkownik), a wsad z pliku nie ma autora.
create or replace function bulk_upsert_osm_water_bodies(p_items jsonb)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  insert into water_bodies (name, type, geom, source, osm_id, area_ha)
  select
    coalesce(nullif(trim(item->>'name'), ''), 'Zbiornik bez nazwy'),
    item->>'type',
    st_makevalid(st_setsrid(st_geomfromgeojson(item->>'geojson'), 4326)),
    'osm',
    (item->>'osm_id')::bigint,
    (item->>'area_ha')::double precision
  from jsonb_array_elements(p_items) as item
  on conflict (osm_id) where osm_id is not null do update
    set name = excluded.name,
        type = excluded.type,
        geom = excluded.geom,
        area_ha = excluded.area_ha;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

-- Wsad masowy jest operacją serwisową: zapisuje dane wspólne dla wszystkich i
-- omija RLS. Nie ma powodu, żeby mógł ją wywołać ktokolwiek z kluczem anon.
revoke execute on function bulk_upsert_osm_water_bodies(jsonb) from anon, authenticated;
