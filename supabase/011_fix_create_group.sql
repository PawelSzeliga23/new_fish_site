-- sprzątanie funkcji diagnostycznej użytej do namierzenia buga
drop function if exists debug_auth_context();

-- security invoker powodował błąd RLS przy tworzeniu grup PRYWATNYCH:
-- "insert into groups ... returning *" musi spełnić politykę groups_select,
-- która dla is_private=true sprawdza członkostwo w group_members - a ten wiersz
-- dodajemy dopiero w drugim insercie, więc w momencie RETURNING jeszcze go nie ma.
-- security definer omija RLS wewnątrz funkcji (auth.uid() nadal poprawnie
-- identyfikuje wywołującego, więc bezpieczeństwo jest zachowane).
create or replace function create_group(name text, description text, is_private boolean)
returns groups
language plpgsql
security definer
set search_path = public
as $$
declare
  new_group groups;
  v_uid uuid := auth.uid();
begin
  insert into groups (name, description, is_private, created_by)
  values (name, description, is_private, v_uid)
  returning * into new_group;

  insert into group_members (group_id, user_id, role)
  values (new_group.id, v_uid, 'admin');

  return new_group;
end;
$$;
