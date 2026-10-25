-- LOCAL MODE ONLY (PGlite). Never run against Supabase.
-- Recreates the small part of Supabase's auth layer that the schema and RLS policies rely on:
--   * auth.users        (Supabase manages this table in hosted mode)
--   * auth.uid()        (reads the `sub` claim the server sets per transaction)
--   * role authenticated (the role RLS policies apply to)
-- Local mode has NO password accounts: registration/sign-in use Supabase Auth only.
-- Locally, only the three shared demo accounts exist (they have no passwords stored anywhere in the DB).

create schema if not exists auth;

create table if not exists auth.users (
  id         uuid primary key default gen_random_uuid(),
  email      text unique,
  created_at timestamptz not null default now()
);

create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'sub', '')::uuid
$$;

do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end $$;

grant usage on schema auth to authenticated;
grant execute on function auth.uid() to authenticated;
