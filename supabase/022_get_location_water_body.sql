-- get_location nie zwracało water_body_id, więc strona miejscówki nie miała jak
-- pokazać zbiornika, do którego 021 właśnie ją podpina. Zmiana listy kolumn
-- wymaga drop + create (Postgres nie pozwala zmienić typu zwracanego przez
-- create or replace).
drop function if exists get_location(uuid);

create or replace function get_location(target_id uuid)
returns table (
  id uuid,
  user_id uuid,
  note text,
  visibility text,
  access_info text,
  lat double precision,
  lng double precision,
  photos text[],
  water_body_id uuid,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    id,
    user_id,
    note,
    visibility,
    access_info,
    st_y(geom) as lat,
    st_x(geom) as lng,
    photos,
    water_body_id,
    created_at
  from locations
  where id = target_id;
$$;
