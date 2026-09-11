-- 039: ręczne usuwanie zbiorników przez administratora
--
-- Automatyczne czyszczenie warstwy wód zostało odrzucone. Nie ma kryterium,
-- które odróżni rozlewisko od starorzecza bez sięgnięcia po tagi z OSM, a
-- kasowanie obiektów bez nazwy wycięłoby połowę warstwy (51 893 ze 103 336)
-- razem z bezimiennymi starorzeczami przy rzekach, czyli jednymi z lepszych
-- łowisk. Zamiast tego admin usuwa pojedynczy obiekt z mapy, świadomie.

-- Lista adminów trzymana po mailu, a nie po uuid: drugie konto właściciela
-- może jeszcze nie istnieć w auth.users, a tak wystarczy je tu dopisać
-- i zadziała od pierwszego logowania - bez kolejnej migracji.
create table if not exists admin_emails (
  email text primary key,
  added_at timestamptz not null default now()
);

alter table admin_emails enable row level security;

insert into admin_emails (email) values
  ('paweszeliga@gmail.com'),
  ('p.szeliga.dev@gmail.com')
on conflict (email) do nothing;

-- security definer, bo zwykły użytkownik nie ma wglądu ani w auth.users,
-- ani w admin_emails. Obejście RLS jest tu celowe i zamknięte w jednym miejscu.
create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from auth.users u
    join admin_emails a on lower(a.email) = lower(u.email)
    where u.id = (select auth.uid())
  );
$$;

drop policy if exists admin_emails_select on admin_emails;
create policy admin_emails_select on admin_emails
  for select using (is_admin());

grant select on admin_emails to authenticated;

/**
 * Usuwa zbiornik razem z jego wierszem w warstwie mapowej.
 *
 * Zwraca nazwę i liczbę odpiętych miejscówek, żeby interfejs mógł napisać
 * konkretnie, co się stało - "usunięto" bez liczby odpiętych miejscówek
 * ukrywałoby skutek uboczny.
 */
create or replace function delete_water_body(target_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  body_name text;
  detached int;
begin
  if not is_admin() then
    raise exception 'Brak uprawnień do usuwania zbiorników';
  end if;

  select name into body_name from water_bodies where id = target_id;

  if not found then
    raise exception 'Zbiornik nie istnieje';
  end if;

  -- locations_water_body_id_fkey nie ma ON DELETE, więc bez tego DELETE
  -- padłby na naruszeniu klucza obcego. Miejscówka zostaje, traci tylko akwen.
  update locations set water_body_id = null where water_body_id = target_id;
  get diagnostics detached = row_count;

  delete from water_bodies where id = target_id;

  return jsonb_build_object('name', body_name, 'detached', detached);
end;
$$;

-- Trigger synchronizujący warstwę mapową pokrywał tylko INSERT i UPDATE.
-- Bez tego usunięty zbiornik zniknąłby z water_bodies, ale mapa czyta
-- z water_bodies_map - i dalej by go rysowała.
create or replace function sync_water_body_map_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from water_bodies_map where id = old.id;
  return old;
end;
$$;

drop trigger if exists water_bodies_map_sync_delete on water_bodies;
create trigger water_bodies_map_sync_delete
  after delete on water_bodies
  for each row execute function sync_water_body_map_delete();

revoke all on function is_admin() from public;
revoke all on function delete_water_body(uuid) from public;
grant execute on function is_admin() to authenticated;
grant execute on function delete_water_body(uuid) to authenticated;

notify pgrst, 'reload schema';
