create table friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid references auth.users(id) not null,
  addressee_id uuid references auth.users(id) not null,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz default now(),
  unique (requester_id, addressee_id)
);

alter table friendships enable row level security;

create policy "friendships_select" on friendships
  for select using (auth.uid() = requester_id or auth.uid() = addressee_id);

create policy "friendships_insert" on friendships
  for insert with check (auth.uid() = requester_id and requester_id != addressee_id);

-- tylko zaproszony może zaakceptować (zmienić status na 'accepted')
create policy "friendships_update" on friendships
  for update using (auth.uid() = addressee_id);

-- każda ze stron może usunąć/cofnąć/odrzucić
create policy "friendships_delete" on friendships
  for delete using (auth.uid() = requester_id or auth.uid() = addressee_id);

create or replace function list_friends()
returns table (friendship_id uuid, friend_id uuid, username text, avatar_url text)
language sql
stable
as $$
  select
    f.id as friendship_id,
    case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end as friend_id,
    pr.username,
    pr.avatar_url
  from friendships f
  join profiles pr
    on pr.id = case when f.requester_id = auth.uid() then f.addressee_id else f.requester_id end
  where f.status = 'accepted'
    and (f.requester_id = auth.uid() or f.addressee_id = auth.uid());
$$;

create or replace function list_incoming_requests()
returns table (friendship_id uuid, requester_id uuid, username text, avatar_url text)
language sql
stable
as $$
  select f.id, f.requester_id, pr.username, pr.avatar_url
  from friendships f
  join profiles pr on pr.id = f.requester_id
  where f.status = 'pending' and f.addressee_id = auth.uid();
$$;

create or replace function list_outgoing_requests()
returns table (friendship_id uuid, addressee_id uuid, username text, avatar_url text)
language sql
stable
as $$
  select f.id, f.addressee_id, pr.username, pr.avatar_url
  from friendships f
  join profiles pr on pr.id = f.addressee_id
  where f.status = 'pending' and f.requester_id = auth.uid();
$$;
