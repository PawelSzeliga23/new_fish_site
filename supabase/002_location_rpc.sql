-- Dodawanie nowej lokalizacji (punktu) przez zalogowanego użytkownika
create or replace function add_location(lat float, lng float, note text, visibility text)
returns locations
language plpgsql
security invoker
as $$
declare
  new_location locations;
begin
  insert into locations (user_id, geom, note, visibility)
  values (auth.uid(), st_setsrid(st_makepoint(lng, lat), 4326), note, visibility)
  returning * into new_location;
  return new_location;
end;
$$;

-- Lista lokalizacji widocznych dla zalogowanego użytkownika (własne + publiczne)
-- zwraca lat/lng jako zwykłe liczby zamiast surowej geometrii
create or replace function list_my_locations()
returns table (
  id uuid,
  note text,
  visibility text,
  lat float,
  lng float,
  created_at timestamptz
)
language sql
stable
as $$
  select id, note, visibility, st_y(geom) as lat, st_x(geom) as lng, created_at
  from locations
  where user_id = auth.uid() or visibility = 'public'
  order by created_at desc;
$$;
