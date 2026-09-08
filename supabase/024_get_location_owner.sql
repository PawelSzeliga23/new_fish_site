-- Strona miejscówki pokazuje teraz, kto ją założył (edytować może wyłącznie ta
-- osoba, nawet gdy miejscówka jest publiczna - pilnuje tego locations_update_own).
-- get_location zwracało samo user_id, więc dokładamy join do profiles.
drop function if exists get_location(uuid);

create or replace function get_location(target_id uuid)
returns table (
  id uuid,
  user_id uuid,
  owner_username text,
  owner_avatar_url text,
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
    l.id,
    l.user_id,
    pr.username,
    pr.avatar_url,
    l.note,
    l.visibility,
    l.access_info,
    st_y(l.geom) as lat,
    st_x(l.geom) as lng,
    l.photos,
    l.water_body_id,
    l.created_at
  from locations l
  join profiles pr on pr.id = l.user_id
  where l.id = target_id;
$$;
