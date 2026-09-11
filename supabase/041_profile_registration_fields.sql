-- 041: dane z rejestracji w profilu
--
-- Do tej pory rejestracja brała wyłącznie email i hasło, a handle_new_user
-- sklejał nazwę użytkownika z adresu ("jan_a1b2c3"). Formularz zbiera teraz
-- imię, nazwisko, własną nazwę użytkownika, datę urodzenia i płeć, więc trigger
-- musi je przepisać z raw_user_meta_data do profilu.

alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists last_name text;
alter table profiles add column if not exists birth_date date;
alter table profiles add column if not exists gender text;
alter table profiles add column if not exists terms_accepted_at timestamptz;

-- Data urodzenia zamiast liczby lat: wiek policzony z daty jest zawsze
-- aktualny, a zapisany raz "27" po roku kłamie i nie ma jak tego wykryć.
alter table profiles drop constraint if exists profiles_birth_date_check;
alter table profiles add constraint profiles_birth_date_check
  check (birth_date is null or birth_date between date '1900-01-01' and current_date);

alter table profiles drop constraint if exists profiles_gender_check;
alter table profiles add constraint profiles_gender_check
  check (gender is null or gender in ('male', 'female', 'other', 'undisclosed'));

-- UNIQUE(username) rozróżniał wielkość liter, więc "Szczupak" i "szczupak"
-- mogły istnieć obok siebie i podszywać się pod siebie nawzajem w /u/[username].
create unique index if not exists profiles_username_lower_key
  on profiles (lower(username));

/**
 * Czy nazwa użytkownika jest wolna.
 *
 * security definer, bo formularz rejestracji pyta o to przed założeniem konta,
 * czyli jako anon - a profiles nie są czytelne dla niezalogowanych. Zwraca samo
 * "wolna/zajęta", więc nie wycieka listy kont.
 */
create or replace function username_available(candidate text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1 from profiles where lower(username) = lower(trim(candidate))
  );
$$;

revoke all on function username_available(text) from public;
grant execute on function username_available(text) to anon, authenticated;

/**
 * Zakłada profil dla nowego konta, przepisując dane z formularza rejestracji.
 *
 * Wszystkie pola są brane z raw_user_meta_data, bo to jedyny kanał, którym
 * signUp() przekazuje cokolwiek poza mailem i hasłem. Gdy ich nie ma (konto
 * założone z panelu Supabase albo starym formularzem), nazwa użytkownika leci
 * po staremu z adresu - inaczej trigger wywaliłby się na NOT NULL.
 */
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  wanted text := nullif(trim(meta->>'username'), '');
  final_username text;
  suffix int := 0;
begin
  final_username := coalesce(
    wanted,
    split_part(new.email, '@', 1) || '_' || substr(new.id::text, 1, 6)
  );

  -- Wyścig między dwiema rejestracjami na tę samą nazwę: username_available
  -- mogło odpowiedzieć "wolna" obu naraz. Doklejamy licznik zamiast wywalać
  -- rejestrację błędem unikalności.
  while exists (select 1 from profiles where lower(username) = lower(final_username)) loop
    suffix := suffix + 1;
    final_username := coalesce(wanted, split_part(new.email, '@', 1)) || suffix::text;
  end loop;

  insert into public.profiles (
    id, username, first_name, last_name, birth_date, gender, terms_accepted_at
  )
  values (
    new.id,
    final_username,
    nullif(trim(meta->>'first_name'), ''),
    nullif(trim(meta->>'last_name'), ''),
    -- Data z formularza jest tekstem; błędny format nie może wywrócić
    -- zakładania konta, więc w razie czego zostaje NULL.
    case
      when meta->>'birth_date' ~ '^\d{4}-\d{2}-\d{2}$'
        then (meta->>'birth_date')::date
      else null
    end,
    nullif(trim(meta->>'gender'), ''),
    case when meta->>'terms_accepted' = 'true' then now() else null end
  );

  return new;
end;
$$;

notify pgrst, 'reload schema';
