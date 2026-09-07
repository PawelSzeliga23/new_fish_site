alter table locations add column access_info text;
alter table catch_reports add column photos text[];

-- Bucket na zdjęcia połowów (własny folder = user_id, tak jak location-photos)
insert into storage.buckets (id, name, public)
values ('catch-photos', 'catch-photos', true)
on conflict (id) do nothing;

create policy "catch_photos_read" on storage.objects
  for select using (bucket_id = 'catch-photos');

create policy "catch_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "catch_photos_delete" on storage.objects
  for delete using (
    bucket_id = 'catch-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Szczegóły jednej miejscówki (RLS z locations_select filtruje widoczność automatycznie)
create or replace function get_location(target_id uuid)
returns table (
  id uuid,
  user_id uuid,
  note text,
  visibility text,
  access_info text,
  lat float,
  lng float,
  photos text[],
  created_at timestamptz
)
language sql
stable
as $$
  select id, user_id, note, visibility, access_info, st_y(geom) as lat, st_x(geom) as lng, photos, created_at
  from locations
  where id = target_id;
$$;
