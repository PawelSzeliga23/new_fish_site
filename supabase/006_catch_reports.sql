create table catch_reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) not null,
  location_id uuid references locations(id),
  species text not null,
  weight_kg float,
  length_cm float,
  caught_at timestamptz not null default now(),
  conditions_snapshot jsonb,
  created_at timestamptz default now()
);

alter table catch_reports enable row level security;

create policy "catch_reports_select_own" on catch_reports
  for select using (auth.uid() = user_id);
create policy "catch_reports_insert_own" on catch_reports
  for insert with check (auth.uid() = user_id);
create policy "catch_reports_delete_own" on catch_reports
  for delete using (auth.uid() = user_id);

-- Połowy dla danej miejscówki (do wyświetlenia w popupie mapy)
create or replace function list_catches_for_location(target_location_id uuid)
returns setof catch_reports
language sql
stable
as $$
  select * from catch_reports
  where location_id = target_location_id and user_id = auth.uid()
  order by caught_at desc;
$$;
