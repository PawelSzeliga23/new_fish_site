-- Mapa dostawała obrysy w pełnej rozdzielczości OSM: 300 poligonów widoku
-- Warszawy to 735 kB GeoJSON-a przy każdym przesunięciu mapy. Uproszczenie z
-- tolerancją ok. 10 m (0.0001 stopnia) tnie to do 166 kB, a przy zoomie, przy
-- którym w ogóle rysujemy obrysy, różnica jest niewidoczna.
-- SimplifyPreserveTopology, żeby nie porozrywać wielokątów z wyspami.
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
    st_asgeojson(st_simplifypreservetopology(w.geom, 0.0001))::jsonb
  from water_bodies w
  where w.geom && st_makeenvelope(min_lng, min_lat, max_lng, max_lat, 4326)
  order by w.area_ha desc nulls last
  limit 300;
$$;
