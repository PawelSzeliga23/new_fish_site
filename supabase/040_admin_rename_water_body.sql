-- 040: zmiana nazwy zbiornika przez administratora
--
-- Druga połowa ręcznej korekty warstwy wód (pierwsza to 039). Rozlewiska
-- podpisane nazwą sąsiedniej rzeki ("Narew" na bagnach Biebrzy) czasem warto
-- przemianować zamiast kasować - obrys bywa poprawny, błędna jest sama nazwa
-- doklejona przez name_unnamed_water_bodies.

create or replace function rename_water_body(target_id uuid, new_name text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  clean_name text;
begin
  if not is_admin() then
    raise exception 'Brak uprawnień do zmiany nazwy zbiornika';
  end if;

  clean_name := nullif(trim(new_name), '');

  if clean_name is null then
    raise exception 'Nazwa nie może być pusta';
  end if;

  if length(clean_name) > 120 then
    raise exception 'Nazwa może mieć najwyżej 120 znaków';
  end if;

  -- name_source = 'manual' wyłącza ten obrys z automatycznego nazywania:
  -- name_unnamed_water_bodies rusza tylko wiersze ze źródłem 'osm'/'unnamed',
  -- więc ręczna poprawka nie zostanie nadpisana przy kolejnym przebiegu.
  update water_bodies
     set name = clean_name,
         name_source = 'manual'
   where id = target_id;

  if not found then
    raise exception 'Zbiornik nie istnieje';
  end if;

  return jsonb_build_object('name', clean_name);
end;
$$;

revoke all on function rename_water_body(uuid, text) from public;
grant execute on function rename_water_body(uuid, text) to authenticated;

-- Import ze zrzutu nadpisywał nazwę wartością z pliku zawsze, gdy tylko OSM
-- jakąś miał. Ręczna poprawka przepadłaby przy najbliższym imporcie, a to
-- właśnie ona jest tą, o której wiemy, że jest prawdziwa.
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
          when water_bodies.name_source = 'manual' then water_bodies.name
          when excluded.name = 'Zbiornik bez nazwy' then water_bodies.name
          else excluded.name
        end,
        name_source = case
          when water_bodies.name_source = 'manual' then 'manual'
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

notify pgrst, 'reload schema';
