-- Zapytanie o kadr mapy dostawało od PostgREST "canceling statement due to
-- statement timeout". Powód: upraszczało geometrię przy każdym żądaniu i żeby
-- odsiać po powierzchni oraz posortować, musiało czytać pełne wiersze
-- water_bodies (~1,4 kB każdy, tabela 138 MB). Na darmowej instancji to były
-- setki bloków z dysku na jedno przesunięcie mapy.
--
-- Warstwa do rysowania dostaje więc własną, chudą tabelę: uproszczona geometria
-- i cztery pola, których potrzebuje mapa. Pełna geometria zostaje w
-- water_bodies i obsługuje regułę 50 m oraz wiązanie miejscówek - tam liczy się
-- dokładność, a zapytania są punktowe i tanie.
--
-- Efekt: 3,6 s -> 13 ms, przy 41 MB zamiast 138 MB czytanych danych.

-- Tolerancja ok. 20 m. Przy zoomie, przy którym rysujemy obrysy, jest
-- niewidoczna, a tnie liczbę wierzchołków kilkukrotnie. PreserveTopology, żeby
-- nie porozrywać wielokątów z wyspami ani nie zgubić cienkiej rzeki.
create or replace function simplify_for_map(g geometry)
returns geometry
language sql
immutable
as $$ select st_simplifypreservetopology(g, 0.0002) $$;

create table if not exists water_bodies_map (
  id uuid primary key references water_bodies(id) on delete cascade,
  name text not null,
  type text not null,
  area_ha double precision,
  geom geometry(Geometry, 4326) not null
);

alter table water_bodies_map enable row level security;

drop policy if exists "water_bodies_map_select" on water_bodies_map;
create policy "water_bodies_map_select" on water_bodies_map
  for select using ((select auth.role()) = 'authenticated');

-- Świadomie tylko indeks przestrzenny. Indeks po area_ha okazał się szkodliwy:
-- planer używał go do gałęzi "area_ha is null" i skanował wszystkie 27 tys.
-- cieków w kraju (654 ms zamiast 13 ms). Filtr po powierzchni jest tani, gdy
-- robi się go w stercie na kilkuset wierszach wybranych przestrzennie.
create index if not exists water_bodies_map_geom_idx on water_bodies_map using gist (geom);

-- Trigger trzyma warstwę w zgodzie z tabelą główną, więc import i przycisk
-- "Wykryj zbiornik" nie muszą o niej pamiętać.
create or replace function sync_water_body_map()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into water_bodies_map (id, name, type, area_ha, geom)
  values (new.id, new.name, new.type, new.area_ha, simplify_for_map(new.geom))
  on conflict (id) do update
    set name = excluded.name,
        type = excluded.type,
        area_ha = excluded.area_ha,
        geom = excluded.geom;

  return new;
end;
$$;

drop trigger if exists water_bodies_map_sync on water_bodies;
create trigger water_bodies_map_sync
  after insert or update on water_bodies
  for each row execute function sync_water_body_map();

-- Uzupełnienie warstwy dla danych zaimportowanych przed powstaniem triggera.
-- Na dużej tabeli trzeba to zrobić partiami - jednorazowo, przez psql lub panel:
--
--   insert into water_bodies_map (id, name, type, area_ha, geom)
--   select id, name, type, area_ha, simplify_for_map(geom) from water_bodies
--   on conflict (id) do nothing;
