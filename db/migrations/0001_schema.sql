-- CareSignal schema (Postgres). Runs unchanged on Supabase (hosted) and PGlite (local).
-- See docs/DATA_MODEL.md for the data dictionary.
--
-- Rules baked into the schema:
--   * Every user-owned row has owner_id -> auth.users(id) and (where case-scoped) case_id.
--   * observations.original_text is immutable (trigger); edits go to observation_edits.
--   * Absent values are NULL and are shown as "not reported" — never as normal.
--   * No API keys or secrets are stored anywhere in the database.

-- ---------- Accounts ----------
create table if not exists profiles (
  user_id      uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 60),
  account_kind text not null check (account_kind in ('registered', 'demo')),
  created_at   timestamptz not null default now()
);

create table if not exists terms_acceptances (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  terms_version           text not null,
  privacy_version         text not null,
  fictional_data_affirmed boolean not null check (fictional_data_affirmed),
  accepted_at             timestamptz not null default now()
);

-- One row per visitor exploring a shared demo login. Isolates each visitor's copy.
create table if not exists demo_sessions (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users(id) on delete cascade,
  seed_key     text not null,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

-- ---------- Cases (one fictional patient each) ----------
create table if not exists cases (
  id                    uuid primary key default gen_random_uuid(),
  owner_id              uuid not null references auth.users(id) on delete cascade,
  kind                  text not null check (kind in ('demo_copy', 'user')),
  demo_session_id       uuid references demo_sessions(id) on delete cascade,
  patient_ref           text not null,              -- PAT-CANCER-001, or PAT-USER-xxxxxx
  seed_key              text,                       -- set when copied from a fixture case
  pseudonym             text not null check (char_length(pseudonym) between 1 and 60),
  care_context          text,
  caregiver_name        text,
  caregiver_relationship text,
  reminder_pref         text not null default 'off' check (reminder_pref in ('off', 'in_app_daily')),
  synthetic             boolean not null default true check (synthetic),
  seed_anchor           timestamptz,
  created_at            timestamptz not null default now(),
  check ((kind = 'demo_copy') = (demo_session_id is not null))
);
create index if not exists idx_cases_owner on cases(owner_id, demo_session_id);

-- Caregiver-reported baseline, one row per category. No row = not reported.
create table if not exists baselines (
  id          uuid primary key default gen_random_uuid(),
  case_id     uuid not null references cases(id) on delete cascade,
  owner_id    uuid not null references auth.users(id) on delete cascade,
  category    text not null,
  description text not null,
  origin      text not null check (origin in ('seeded', 'session')),
  synthetic   boolean not null default true,
  reported_at timestamptz not null default now(),
  unique (case_id, category)
);

-- ---------- Observations ----------
create table if not exists observations (
  id                  uuid primary key default gen_random_uuid(),
  case_id             uuid not null references cases(id) on delete cascade,
  owner_id            uuid not null references auth.users(id) on delete cascade,
  display_id          text not null,                -- stable, human-readable: OBS-C1-03, OBS-0012
  original_text       text not null check (char_length(original_text) between 1 and 4000),
  entered_at          timestamptz not null default now(),
  event_time          timestamptz,                  -- optional "When did this happen?"; NULL = not provided
  author_label        text,                         -- optional, e.g. "Jamie (brother)"
  origin              text not null check (origin in ('seeded', 'session')),
  synthetic           boolean not null default true,
  is_test_scenario    boolean not null default false, -- predefined synthetic test scenario (Case 2 urgent note)
  safety_tier         text not null check (safety_tier in ('emergency', 'contact_care_team', 'review', 'none')),
  safety_rule_ids     jsonb not null default '[]'::jsonb,
  safety_rules_version text not null,
  ai_state            text not null default 'pending'
                      check (ai_state in ('pending','complete','failed','failed_validation','unavailable_error','unavailable_limit','not_run')),
  unique (case_id, display_id)
);
create index if not exists idx_obs_case on observations(case_id, entered_at);

create or replace function observations_original_immutable() returns trigger language plpgsql as $$
begin
  if new.original_text is distinct from old.original_text
     or new.entered_at is distinct from old.entered_at
     or new.event_time is distinct from old.event_time
     or new.case_id is distinct from old.case_id
     or new.owner_id is distinct from old.owner_id
     or new.display_id is distinct from old.display_id then
    raise exception 'original observation is immutable';
  end if;
  return new;
end $$;
drop trigger if exists observations_original_immutable on observations;
create trigger observations_original_immutable before update on observations
  for each row execute function observations_original_immutable();

create table if not exists observation_edits (
  id             uuid primary key default gen_random_uuid(),
  observation_id uuid not null references observations(id) on delete cascade,
  case_id        uuid not null references cases(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  version        integer not null check (version >= 2),
  edited_text    text not null check (char_length(edited_text) between 1 and 4000),
  edited_at      timestamptz not null default now(),
  unique (observation_id, version)
);

-- AI-derived labels. Stored separately; never overwrite the original note.
create table if not exists observation_analyses (
  id                   uuid primary key default gen_random_uuid(),
  observation_id       uuid not null references observations(id) on delete cascade,
  case_id              uuid not null references cases(id) on delete cascade,
  owner_id             uuid not null references auth.users(id) on delete cascade,
  primary_category     text not null,
  secondary_categories jsonb not null default '[]'::jsonb,
  summary              text,
  model_reported       text,
  usage_log_id         uuid,
  created_at           timestamptz not null default now()
);

create table if not exists safety_alerts (
  id             uuid primary key default gen_random_uuid(),
  observation_id uuid not null references observations(id) on delete cascade,
  case_id        uuid not null references cases(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  tier           text not null check (tier in ('emergency', 'contact_care_team', 'review')),
  rule_ids       jsonb not null,
  matched_text   jsonb not null,
  rules_version  text not null,
  is_test_scenario boolean not null default false,
  created_at     timestamptz not null default now(),
  seen_at        timestamptz,                       -- "I've seen this" — NOT "resolved"
  unique (observation_id)
);

-- ---------- Daily check-ins ----------
-- responses: {"<category>": {"state": "answered"|"skipped", "value": "..."}}. Missing key = not reported.
-- No row for a day = check-in not reported for that day (never "fine").
create table if not exists checkins (
  id         uuid primary key default gen_random_uuid(),
  case_id    uuid not null references cases(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  day        date not null,
  responses  jsonb not null,
  origin     text not null check (origin in ('seeded', 'session')),
  synthetic  boolean not null default true,
  created_at timestamptz not null default now(),
  unique (case_id, day)
);

-- ---------- AI insights ----------
create table if not exists insight_runs (
  id             uuid primary key default gen_random_uuid(),
  case_id        uuid not null references cases(id) on delete cascade,
  owner_id       uuid not null references auth.users(id) on delete cascade,
  status         text not null check (status in ('complete','failed','failed_validation','unavailable_error','unavailable_limit')),
  period_start   timestamptz,
  period_end     timestamptz,
  origin         text not null check (origin in ('seeded', 'session')),
  model_reported text,
  generated_at   timestamptz,                       -- when the model produced it (seeded runs keep the original time)
  usage_log_id   uuid,
  error_reason   text,
  created_at     timestamptz not null default now()
);

create table if not exists insights (
  id           uuid primary key default gen_random_uuid(),
  run_id       uuid not null references insight_runs(id) on delete cascade,
  case_id      uuid not null references cases(id) on delete cascade,
  owner_id     uuid not null references auth.users(id) on delete cascade,
  position     integer not null,
  kind         text not null check (kind in ('pattern','change','possible_pattern','conflict','missing_info','question')),
  statement    text not null,
  support      text not null check (support in ('supported','possible_unconfirmed','conflicting','unknown')),
  source_ids   jsonb not null check (jsonb_array_length(source_ids) >= 1), -- observation display_ids
  evidence     jsonb not null default '[]'::jsonb,  -- [{"source_id": "...", "quote": "..."}]
  uncertainty  text
);

-- ---------- Handoffs and simulated receiver ----------
-- Status flow: draft -> reviewed (caregiver reviewed + approved) -> submitted -> received -> acknowledged; failed is retryable.
create table if not exists handoffs (
  id               uuid primary key default gen_random_uuid(),
  display_id       text not null unique,            -- HO-XXXXXXXX
  case_id          uuid not null references cases(id) on delete cascade,
  owner_id         uuid not null references auth.users(id) on delete cascade,
  status           text not null check (status in ('draft','reviewed','submitted','received','acknowledged','failed')),
  period_start     timestamptz,
  period_end       timestamptz,
  draft            jsonb not null,                  -- editable draft content
  drafted_by       text not null check (drafted_by in ('ai', 'caregiver', 'seed_fixture')),
  approved_payload jsonb,                           -- frozen at review/approval
  source_ids       jsonb not null default '[]'::jsonb,
  idempotency_key  text unique,
  origin           text not null check (origin in ('seeded', 'session')),
  synthetic        boolean not null default true,
  reviewed_at      timestamptz,
  submitted_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  check (status = 'draft' or approved_payload is not null)
);

create table if not exists handoff_status_history (
  id         uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references handoffs(id) on delete cascade,
  case_id    uuid not null references cases(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  status     text not null,
  note       text,
  at         timestamptz not null default now()
);

-- Delivery receipt: exists only once the simulated backend has persisted the approved payload.
create table if not exists receiver_records (
  id              uuid primary key default gen_random_uuid(),
  handoff_id      uuid not null unique references handoffs(id) on delete cascade,
  case_id         uuid not null references cases(id) on delete cascade,
  owner_id        uuid not null references auth.users(id) on delete cascade,
  payload         jsonb not null,                   -- exact submitted payload
  received_at     timestamptz not null default now(),
  acknowledged_at timestamptz,
  synthetic       boolean not null default true
);

-- Simulated receiver responses (e.g. Case 1's fictional clinician response). Always synthetic.
create table if not exists receiver_responses (
  id         uuid primary key default gen_random_uuid(),
  handoff_id uuid not null references handoffs(id) on delete cascade,
  case_id    uuid not null references cases(id) on delete cascade,
  owner_id   uuid not null references auth.users(id) on delete cascade,
  kind       text not null check (kind in ('fictional_clinician_response')),
  text       text not null,
  label      text not null,
  synthetic  boolean not null default true check (synthetic),
  at         timestamptz not null default now()
);

-- ---------- AI usage (tokenomics) ----------
-- Provider-returned numbers only; NULL when the provider did not return a field.
create table if not exists usage_log (
  id                  uuid primary key default gen_random_uuid(),
  owner_id            uuid references auth.users(id) on delete set null,
  case_id             uuid references cases(id) on delete set null,
  purpose             text not null check (purpose in ('observation_analysis','insights','handoff_draft','seed_insights','evaluation')),
  status              text not null check (status in ('complete','failed','rejected')),
  model_requested     text not null,
  model_reported      text,
  provider_request_id text,
  prompt_tokens       integer,
  cached_tokens       integer,
  completion_tokens   integer,
  total_tokens        integer,
  latency_ms          integer,
  created_at          timestamptz not null default now()
);
create index if not exists idx_usage_day on usage_log(created_at, owner_id);

-- ---------- Evaluation ----------
-- Evaluation cases live in synthetic-data/evaluation (versioned fixtures); results are stored here.
create table if not exists eval_results (
  id             uuid primary key default gen_random_uuid(),
  eval_case_id   text not null,
  run_label      text not null,
  check_name     text not null,
  passed         boolean not null,
  details        jsonb not null default '{}'::jsonb,
  model_reported text,
  usage_log_id   uuid references usage_log(id) on delete set null,
  created_at     timestamptz not null default now()
);
