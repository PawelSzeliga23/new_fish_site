-- Usunięcie posta musi kasować jego komentarze i lajki, inaczej klucz obcy blokuje delete
alter table comments drop constraint comments_post_id_fkey;
alter table comments add constraint comments_post_id_fkey
  foreign key (post_id) references posts(id) on delete cascade;

alter table likes drop constraint likes_post_id_fkey;
alter table likes add constraint likes_post_id_fkey
  foreign key (post_id) references posts(id) on delete cascade;

-- Komentarze z avatarem autora (drop wymagany - zmienia się struktura returns table)
drop function if exists list_comments(uuid);

create or replace function list_comments(target_post_id uuid)
returns table (
  id uuid,
  user_id uuid,
  username text,
  avatar_url text,
  content text,
  created_at timestamptz
)
language sql
stable
as $$
  select c.id, c.user_id, pr.username, pr.avatar_url, c.content, c.created_at
  from comments c
  join profiles pr on pr.id = c.user_id
  where c.post_id = target_post_id
  order by c.created_at asc;
$$;
