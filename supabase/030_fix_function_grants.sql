-- Błąd w migracji 025/026: REVOKE ... FROM anon, authenticated nie odbiera nic,
-- dopóki funkcja ma domyślne nadanie dla PUBLIC (w ACL widoczne jako "=X/...").
-- Obie role dziedziczą uprawnienie przez PUBLIC, więc masowy wsad omijający RLS
-- był wywoływalny kluczem anon. Odbieramy od PUBLIC i nadajemy imiennie.
revoke execute on function bulk_upsert_osm_water_bodies(jsonb) from public;
grant execute on function bulk_upsert_osm_water_bodies(jsonb) to service_role;

-- upsert_osm_water_body wywołuje zalogowany użytkownik (przycisk na miejscówce)
-- i funkcja sama odrzuca brak auth.uid(), ale nie ma powodu wystawiać jej anonom.
revoke execute on function upsert_osm_water_body(bigint, text, text, jsonb, text[]) from public;
grant execute on function upsert_osm_water_body(bigint, text, text, jsonb, text[]) to authenticated, service_role;

-- Supabase domyślnie nadaje EXECUTE rolom anon i authenticated na wszystkie
-- funkcje w schemacie public, więc samo odebranie PUBLIC nie wystarcza.
revoke execute on function upsert_osm_water_body(bigint, text, text, jsonb, text[]) from anon;
