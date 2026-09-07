-- group_members_select/insert odwoływały się do group_members wewnątrz własnej
-- polityki na tej samej tabeli, co Postgres zgłasza jako nieskończoną rekurencję.
-- Fix: sprawdzanie członkostwa przez funkcję security definer (omija RLS przy tym sprawdzeniu).

create or replace function is_group_member(target_group_id uuid, uid uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from group_members
    where group_id = target_group_id and user_id = uid
  );
$$;

drop policy "group_members_select" on group_members;
create policy "group_members_select" on group_members
  for select using (is_group_member(group_id, auth.uid()));

drop policy "group_members_insert" on group_members;
create policy "group_members_insert" on group_members
  for insert with check (
    (
      user_id = auth.uid()
      and exists (select 1 from groups g where g.id = group_id and g.is_private = false)
    )
    or is_group_member(group_id, auth.uid())
  );
