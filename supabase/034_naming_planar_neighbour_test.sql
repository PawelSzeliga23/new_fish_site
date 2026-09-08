-- Przebieg nazywania wywracał się na PostGIS-owym "lwgeom_distance_spheroid
-- returned negative!" - numerycznym przypadku brzegowym przy liczeniu odległości
-- między dwoma wielokątami na sferoidzie. Nie jest to wina konkretnej geometrii:
-- sprawdzenie odległości od punktu przeszło przez wszystkie 103 tys. obiektów
-- bez błędu, problem pojawia się dopiero dla pewnych par wielokąt-wielokąt.
--
-- Do wykrycia "fragment przylegający do jeziora" precyzja sferoidy jest zbędna -
-- wystarczy test płaski w stopniach. 0.0004 stopnia to ok. 30 m na naszej
-- szerokości geograficznej. Reguła 50 m przy dodawaniu miejscówki nadal liczy w
-- metrach na geography, bo tam dokładność ma znaczenie.
--
-- Treść funkcji jest w 032_infer_water_body_names.sql (zaktualizowana o ten
-- test); ta migracja istnieje, żeby zmiana trafiła też do baz już postawionych.
create or replace function name_unnamed_water_bodies(batch_size integer default 1000)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with kandydaci as (
    select id, geom, area_ha
    from water_bodies
    where name = 'Zbiornik bez nazwy'
      and area_ha is not null
      and name_source = 'osm'
    limit batch_size
  ),
  dopasowania as (
    select
      k.id,
      coalesce(
        -- 1. Nazwana linia cieku przechodząca przez obrys. Przy kilku wybieramy
        --    tę, która biegnie przez niego najdłużej - dopływ przecinający róg
        --    nie powinien przebić rzeki głównej.
        (
          select r.name
          from water_bodies r
          where r.area_ha is null
            and r.name <> 'Zbiornik bez nazwy'
            and st_intersects(k.geom, r.geom)
          order by st_length(st_intersection(k.geom, r.geom)) desc
          limit 1
        ),
        -- 2. Duży nazwany akwen tuż obok. Wymagamy co najmniej dwukrotnie
        --    większej powierzchni, żeby nie skleić dwóch osobnych stawów o
        --    zbliżonej wielkości pod jedną nazwą.
        (
          select w.name
          from water_bodies w
          where w.area_ha is not null
            and w.name <> 'Zbiornik bez nazwy'
            and w.area_ha >= k.area_ha * 2
            and st_dwithin(w.geom, k.geom, 0.0004)
          order by w.area_ha desc
          limit 1
        )
      ) as nazwa
    from kandydaci k
  )
  update water_bodies w
  set name = coalesce(d.nazwa, w.name),
      name_source = case when d.nazwa is null then 'unnamed' else 'inferred' end
  from dopasowania d
  where w.id = d.id;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function name_unnamed_water_bodies(integer) from public;
revoke execute on function name_unnamed_water_bodies(integer) from anon, authenticated;
grant execute on function name_unnamed_water_bodies(integer) to service_role;
