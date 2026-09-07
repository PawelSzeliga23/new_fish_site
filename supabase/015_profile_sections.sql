-- Listy znajomych są publiczne (jak na FB): każdy zalogowany widzi zaakceptowane
-- znajomości, ale oczekujące zaproszenia zostają prywatne dla obu stron.
drop policy "friendships_select" on friendships;

create policy "friendships_select" on friendships
  for select using (
    status = 'accepted'
    or auth.uid() = requester_id
    or auth.uid() = addressee_id
  );

-- Miejscówki danej osoby - RLS na locations decyduje co widzę
-- (publiczne dla każdego, 'friends' dla znajomych, prywatne tylko dla właściciela)
create or replace function list_user_locations(target_user_id uuid)
returns table (
  id uuid,
  note text,
  visibility text,
  lat float,
  lng float,
  photos text[],
  created_at timestamptz
)
language sql
stable
as $$
  select id, note, visibility, st_y(geom) as lat, st_x(geom) as lng, photos, created_at
  from locations
  where user_id = target_user_id
  order by created_at desc;
$$;

-- Grupy danej osoby - RLS na group_members pokazuje tylko te, w których sam jestem
-- (dla własnego profilu: wszystkie moje)
create or replace function list_user_groups(target_user_id uuid)
returns table (
  id uuid,
  name text,
  description text,
  is_private boolean,
  avatar_url text
)
language sql
stable
as $$
  select g.id, g.name, g.description, g.is_private, g.avatar_url
  from group_members gm
  join groups g on g.id = gm.group_id
  where gm.user_id = target_user_id;
$$;

-- Znajomi danej osoby
create or replace function list_user_friends(target_user_id uuid)
returns table (
  friend_id uuid,
  username text,
  avatar_url text
)
language sql
stable
as $$
  select
    case when f.requester_id = target_user_id then f.addressee_id else f.requester_id end,
    pr.username,
    pr.avatar_url
  from friendships f
  join profiles pr
    on pr.id = case when f.requester_id = target_user_id then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = target_user_id or f.addressee_id = target_user_id);
$$;
