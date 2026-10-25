-- Supabase grants table privileges to its `anon` and `authenticated` roles by default.
-- CareSignal never lets the browser query the database directly, so:
--   * `anon` gets nothing on our tables;
--   * server-only tables (usage_log, eval_results, schema_migrations) are refused outright to `authenticated`.
-- (Row Level Security already returned zero rows; this makes the refusal explicit, matching local mode.)
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    execute 'revoke all on all tables in schema public from anon';
    execute 'alter default privileges in schema public revoke all on tables from anon';
  end if;
end $$;

revoke all on usage_log, eval_results, schema_migrations from authenticated;
