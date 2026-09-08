-- Ponowny import ze zrzutu nadpisywał nazwę wartością z pliku, więc obrys
-- nazwany przez name_unnamed_water_bodies wracał do "Zbiornik bez nazwy".
-- Placeholder nigdy nie powinien wypierać nazwy, którą już mamy.
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
  select distinct on (osm_id)
    name, type, geom, 'osm', osm_id, area_ha
  from (
    select
      coalesce(nullif(trim(item->>'name'), ''), 'Zbiornik bez nazwy') as name,
      item->>'type' as type,
      st_makevalid(st_setsrid(st_geomfromgeojson(item->>'geojson'), 4326)) as geom,
      (item->>'osm_id')::bigint as osm_id,
      (item->>'area_ha')::double precision as area_ha
    from jsonb_array_elements(p_items) as item
  ) parsed
  order by osm_id, area_ha desc nulls last
  on conflict (osm_id) where osm_id is not null do update
    set name = case
          when excluded.name = 'Zbiornik bez nazwy' then water_bodies.name
          else excluded.name
        end,
        name_source = case
          when excluded.name = 'Zbiornik bez nazwy' then water_bodies.name_source
          else 'osm'
        end,
        type = excluded.type,
        geom = excluded.geom,
        area_ha = excluded.area_ha;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function bulk_upsert_osm_water_bodies(jsonb) from public;
grant execute on function bulk_upsert_osm_water_bodies(jsonb) to service_role;
