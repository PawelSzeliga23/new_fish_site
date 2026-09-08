-- Tabela water_bodies stała pusta od migracji 001 - był schemat i indeks GiST,
-- ale nic jej nie zapełniało i nic z niej nie czytało. Ta migracja robi z niej
-- realne źródło danych: import obrysów z OpenStreetMap, odczyt po bboksie pod
-- mapę i automatyczne wiązanie miejscówki ze zbiornikiem, na którym leży.

alter table water_bodies add column if not exists osm_id bigint;
alter table water_bodies add column if not exists area_ha double precision;

-- Klucz deduplikacji importu. Częściowy, bo zbiorniki dodane ręcznie przez
-- użytkownika nie mają odpowiednika w OSM.
create unique index if not exists water_bodies_osm_id_key
  on water_bodies (osm_id)
  where osm_id is not null;

-- locations.water_body_id przestaje być kolumną-widmem, więc dostaje indeks.
create index if not exists locations_water_body_id_idx on locations (water_body_id);

-- ---------------------------------------------------------------------------
-- Import z OpenStreetMap
-- ---------------------------------------------------------------------------

-- security definer, bo import wykonuje zalogowany użytkownik, ale zapisuje dane
-- wspólne dla wszystkich - polityka water_bodies_insert wymagałaby, żeby każdy
-- zbiornik miał created_by = auth.uid(), a przy ponownym imporcie przez inną
-- osobę update by się nie udał.
create or replace function upsert_osm_water_body(
  p_osm_id bigint,
  p_name text,
  p_type text,
  p_geojson jsonb,
  p_species text[] default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_geom geometry;
  v_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Musisz być zalogowany, żeby importować zbiorniki';
  end if;

  -- Obrysy z OSM bywają samoprzecinające się; bez makevalid ST_Contains i
  -- ST_Area potrafią zwrócić bzdury albo wywalić zapytanie.
  v_geom := st_makevalid(st_setsrid(st_geomfromgeojson(p_geojson::text), 4326));

  if v_geom is null or st_isempty(v_geom) then
    return null;
  end if;

  insert into water_bodies (name, type, geom, source, osm_id, area_ha, species, created_by)
  values (
    coalesce(nullif(trim(p_name), ''), 'Zbiornik bez nazwy'),
    p_type,
    v_geom,
    'osm',
    p_osm_id,
    st_area(v_geom::geography) / 10000,
    p_species,
    auth.uid()
  )
  on conflict (osm_id) where osm_id is not null do update
    set name = excluded.name,
        type = excluded.type,
        geom = excluded.geom,
        area_ha = excluded.area_ha
  returning id into v_id;

  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Odczyt pod mapę
-- ---------------------------------------------------------------------------

create or replace function water_bodies_in_bbox(
  min_lat double precision,
  min_lng double precision,
  max_lat double precision,
  max_lng double precision
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
    w.id,
    w.name,
    w.type,
    w.area_ha,
    w.species,
    st_asgeojson(w.geom)::jsonb
  from water_bodies w
  where w.geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  order by w.area_ha desc nulls last
  limit 300;
$$;

-- ---------------------------------------------------------------------------
-- Wiązanie miejscówki ze zbiornikiem
-- ---------------------------------------------------------------------------

-- Celowo security invoker: update ma przejść przez locations_update_own, żeby
-- cudzej miejscówki nie dało się przepiąć.
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

  -- Najpierw zbiornik, w którym punkt faktycznie leży; dopiero potem najbliższy
  -- w promieniu 500 m (pinezki lądują na brzegu częściej, niż się wydaje).
  select w.id into v_water
  from water_bodies w
  where st_dwithin(w.geom::geography, v_point::geography, 500)
  order by
    case when st_contains(w.geom, v_point) then 0 else 1 end,
    st_distance(w.geom::geography, v_point::geography)
  limit 1;

  update locations set water_body_id = v_water where id = target_location_id;

  return v_water;
end;
$$;

-- Szczegóły zbiornika przypiętego do miejscówki - jedno zapytanie zamiast
-- dociągania geometrii, której strona miejscówki i tak nie rysuje.
create or replace function get_water_body(target_id uuid)
returns table (
  id uuid,
  name text,
  type text,
  area_ha double precision,
  species text[],
  source text
)
language sql
stable
set search_path = public
as $$
  select w.id, w.name, w.type, w.area_ha, w.species, w.source
  from water_bodies w
  where w.id = target_id;
$$;
