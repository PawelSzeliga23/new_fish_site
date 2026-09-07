-- Bucket na zdjęcia miejscówek (publiczny odczyt, zapis tylko we własnym folderze)
insert into storage.buckets (id, name, public)
values ('location-photos', 'location-photos', true)
on conflict (id) do nothing;

create policy "location_photos_read" on storage.objects
  for select using (bucket_id = 'location-photos');

create policy "location_photos_insert_own" on storage.objects
  for insert with check (
    bucket_id = 'location-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "location_photos_delete_own" on storage.objects
  for delete using (
    bucket_id = 'location-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- add_location: dodajemy opcjonalny parametr photos
create or replace function add_location(
  lat float,
  lng float,
  note text,
  visibility text,
  photos text[] default null
)
returns locations
language plpgsql
security invoker
as $$
declare
  new_location locations;
begin
  insert into locations (user_id, geom, note, visibility, photos)
  values (auth.uid(), st_setsrid(st_makepoint(lng, lat), 4326), note, visibility, photos)
  returning * into new_location;
  return new_location;
end;
$$;

-- list_my_locations: dorzucamy photos do wyniku
-- (drop wymagany, bo zmienia się struktura returns table)
drop function if exists list_my_locations();

create or replace function list_my_locations()
returns table (
  id uuid,
  note text,
  visibility text,
  lat float,
  lng float,
  photos text[],
  created_at timestamptz
)
language sql
stable
as $$
  select id, note, visibility, st_y(geom) as lat, st_x(geom) as lng, photos, created_at
  from locations
  where user_id = auth.uid() or visibility = 'public'
  order by created_at desc;
$$;
