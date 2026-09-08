-- Popup na mapie pokazuje teraz nazwę akwenu i liczbę zapisanych połowów, więc
-- lista miejscówek musi je zwracać. Wcześniej trzeba by po nie strzelać osobno
-- dla każdej pinezki.
--
-- Uwaga na widoczność: liczymy tylko te połowy, które i tak wolno zobaczyć
-- (catch_reports_select), dlatego zwykłe podzapytanie pod RLS wywołującego, a
-- nie security definer.
drop function if exists list_my_locations();

create or replace function list_my_locations()
returns table (
  id uuid,
  note text,
  visibility text,
  lat double precision,
  lng double precision,
  photos text[],
  water_body_name text,
  catch_count bigint,
  created_at timestamptz
)
language sql
stable
set search_path = public
as $$
  select
    l.id,
    l.note,
    l.visibility,
    st_y(l.geom) as lat,
    st_x(l.geom) as lng,
    l.photos,
    w.name,
    (select count(*) from catch_reports c where c.location_id = l.id),
    l.created_at
  from locations l
  left join water_bodies w on w.id = l.water_body_id
  where l.user_id = auth.uid() or l.visibility = 'public'
  order by l.created_at desc;
$$;

notify pgrst, 'reload schema';
