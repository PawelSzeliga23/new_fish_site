-- water_body_near i link_location_water_body liczą odległość w metrach, więc
-- rzutują geometrię na geography. To inny typ niż indeksowany geom, przez co
-- planer nie mógł użyć water_bodies_geom_idx i skanował całą tabelę: po imporcie
-- 204 tys. obiektów sprawdzenie "czy to nad wodą" trwało 31 sekund przy każdym
-- kliknięciu w mapę. Indeks funkcyjny na tym samym wyrażeniu, którego używają
-- zapytania, przywraca wyszukiwanie po indeksie (31 s -> 53 ms).
create index if not exists water_bodies_geography_idx
  on water_bodies using gist ((geom::geography));

analyze water_bodies;
