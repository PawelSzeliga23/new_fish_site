create table groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  is_private boolean not null default false,
  created_by uuid references auth.users(id) not null,
  created_at timestamptz default now()
);

create table group_members (
  group_id uuid references groups(id) on delete cascade not null,
  user_id uuid references auth.users(id) not null,
  role text not null default 'member',
  joined_at timestamptz default now(),
  primary key (group_id, user_id)
);

alter table groups enable row level security;
alter table group_members enable row level security;

create policy "groups_select" on groups
  for select using (
    is_private = false
    or exists (
      select 1 from group_members gm
      where gm.group_id = groups.id and gm.user_id = auth.uid()
    )
  );

create policy "groups_insert" on groups
  for insert with check (auth.uid() = created_by);

create policy "groups_update_own" on groups
  for update using (auth.uid() = created_by);

create policy "groups_delete_own" on groups
  for delete using (auth.uid() = created_by);

create policy "group_members_select" on group_members
  for select using (
    exists (
      select 1 from group_members gm2
      where gm2.group_id = group_members.group_id and gm2.user_id = auth.uid()
    )
  );

-- dołączenie: samemu do grupy publicznej, albo dowolny istniejący członek dodaje kogoś (w tym do prywatnej)
create policy "group_members_insert" on group_members
  for insert with check (
    (
      user_id = auth.uid()
      and exists (select 1 from groups g where g.id = group_id and g.is_private = false)
    )
    or exists (
      select 1 from group_members gm
      where gm.group_id = group_members.group_id and gm.user_id = auth.uid()
    )
  );

create policy "group_members_delete_own" on group_members
  for delete using (auth.uid() = user_id);

create or replace function list_my_groups()
returns table (id uuid, name text, description text, is_private boolean)
language sql
stable
as $$
  select g.id, g.name, g.description, g.is_private
  from groups g
  join group_members gm on gm.group_id = g.id
  where gm.user_id = auth.uid();
$$;

create or replace function list_group_members(target_group_id uuid)
returns table (user_id uuid, username text, avatar_url text, role text)
language sql
stable
as $$
  select gm.user_id, pr.username, pr.avatar_url, gm.role
  from group_members gm
  join profiles pr on pr.id = gm.user_id
  where gm.group_id = target_group_id;
$$;

-- tworzenie grupy: dodaje ją i od razu robi twórcę adminem
create or replace function create_group(name text, description text, is_private boolean)
returns groups
language plpgsql
security invoker
as $$
declare
  new_group groups;
begin
  insert into groups (name, description, is_private, created_by)
  values (name, description, is_private, auth.uid())
  returning * into new_group;

  insert into group_members (group_id, user_id, role)
  values (new_group.id, auth.uid(), 'admin');

  return new_group;
end;
$$;
