-- Kompresja po stronie przeglądarki (src/lib/compress-image.ts) da się ominąć -
-- anon keyem można wrzucić plik prosto do Storage. Twardy limit w bucketach
-- jest jedynym realnym zabezpieczeniem przed zapchaniem storage.
update storage.buckets
set file_size_limit = 5242880
where id in ('location-photos', 'post-photos', 'avatars', 'group-photos', 'catch-photos');
