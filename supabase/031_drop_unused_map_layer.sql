-- Po imporcie 204 tys. obiektów mapa dostawała od PostgREST błąd
-- "canceling statement due to statement timeout": zapytanie o kadr przy zoomie
-- 10 obejmowało ponad 4 tys. kandydatów, a tabela (198 MB) nie mieściła się w
-- pamięci podręcznej darmowej instancji - 3,6 s na zimno.
--
-- Rozwiązaniem okazało się usunięcie danych, których i tak nikt nie użyje:
-- bezimiennych zbiorników poniżej 0,5 ha (rowy, osadniki, oczka melioracyjne).
-- Zostały cieki liniowe, zbiorniki od 0,5 ha i wszystkie nazwane niezależnie od
-- wielkości. 204 tys. -> 103 tys. obiektów, 198 -> 138 MB, zapytanie 3,6 s -> 440 ms.
--
--   delete from water_bodies
--   where area_ha < 0.5 and name = 'Zbiornik bez nazwy';
--   vacuum full analyze water_bodies;
--
-- (Czyszczenie to operacja na danych, nie na schemacie - powtarza je próg
-- DEFAULT_MIN_AREA_HA w scripts/import-water-bodies.mjs.)

-- Indeks po powierzchni: używa go czyszczenie małych obiektów i sortowanie
-- "od największych" przy pobieraniu kadru mapy.
create index if not exists water_bodies_area_ha_idx
  on water_bodies (area_ha)
  where area_ha is not null;
