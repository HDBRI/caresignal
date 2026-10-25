-- Row Level Security. The server runs every user request inside a transaction that does:
--   select set_config('request.jwt.claims', '{"sub": <user id>, "demo_session": <id or "">}', true);
--   set local role authenticated;
-- so these policies apply to the server's own queries (in Supabase and in local PGlite alike).
-- Admin work (migrations, seeding, usage accounting) uses the owner connection and bypasses RLS.

create or replace function public.current_demo_session() returns uuid
language sql stable as $$
  select nullif(current_setting('request.jwt.claims', true)::json ->> 'demo_session', '')::uuid
$$;

grant usage on schema public to authenticated;
grant execute on function public.current_demo_session() to authenticated;

-- Cases: owner AND (registered case, or the demo copy that belongs to this visitor's demo session).
alter table cases enable row level security;
drop policy if exists case_owner on cases;
create policy case_owner on cases for all to authenticated
  using (
    owner_id = auth.uid()
    and (demo_session_id is null and current_demo_session() is null
         or demo_session_id = current_demo_session())
  )
  with check (
    owner_id = auth.uid()
    and (demo_session_id is null and current_demo_session() is null
         or demo_session_id = current_demo_session())
  );
grant select, insert, update, delete on cases to authenticated;

-- Case-scoped tables: owner AND the parent case is visible under the case policy above.
do $$
declare t text;
begin
  foreach t in array array[
    'baselines','observations','observation_edits','observation_analyses','safety_alerts','checkins',
    'insight_runs','insights','handoffs','handoff_status_history','receiver_records','receiver_responses'
  ] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists case_scoped on %I', t);
    execute format($p$
      create policy case_scoped on %I for all to authenticated
        using (owner_id = auth.uid() and exists (select 1 from cases c where c.id = case_id))
        with check (owner_id = auth.uid() and exists (select 1 from cases c where c.id = case_id))
    $p$, t);
    execute format('grant select, insert, update, delete on %I to authenticated', t);
  end loop;
end $$;

-- Demo sessions: visible only to the matching session.
alter table demo_sessions enable row level security;
drop policy if exists own_demo_session on demo_sessions;
create policy own_demo_session on demo_sessions for select to authenticated
  using (owner_id = auth.uid() and id = current_demo_session());
grant select on demo_sessions to authenticated;

alter table profiles enable row level security;
drop policy if exists own_profile on profiles;
create policy own_profile on profiles for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
grant select, insert, update on profiles to authenticated;

alter table terms_acceptances enable row level security;
drop policy if exists own_terms on terms_acceptances;
create policy own_terms on terms_acceptances for select to authenticated using (user_id = auth.uid());
drop policy if exists own_terms_insert on terms_acceptances;
create policy own_terms_insert on terms_acceptances for insert to authenticated with check (user_id = auth.uid());
grant select, insert on terms_acceptances to authenticated;

-- Server-only tables: RLS on, no policies, no grants -> invisible to the authenticated role.
alter table usage_log enable row level security;
alter table eval_results enable row level security;
