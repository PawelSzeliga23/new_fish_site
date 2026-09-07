create or replace function is_group_admin(target_group_id uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = target_group_id and user_id = uid and role = 'admin'
  );
$$;

drop policy "groups_update_own" on groups;
create policy "groups_update_own" on groups
  for update using (is_group_admin(id, auth.uid()));

-- upload zdjęć grupy - tylko admin, spójnie z uprawnieniem do edycji samej grupy
drop policy "group_photos_insert" on storage.objects;
create policy "group_photos_insert" on storage.objects
  for insert with check (
    bucket_id = 'group-photos'
    and is_group_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );

drop policy "group_photos_update" on storage.objects;
create policy "group_photos_update" on storage.objects
  for update using (
    bucket_id = 'group-photos'
    and is_group_admin((storage.foldername(name))[1]::uuid, auth.uid())
  );
