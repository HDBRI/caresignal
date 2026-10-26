-- Task 13: weekly handoff drafts, caregiver edits, versions and a fuller status history.

-- Version number per case (1, 2, 3...). A submitted handoff is never changed; new information makes a new version.
alter table handoffs add column if not exists version integer not null default 1;
-- The draft exactly as CareSignal generated it (before caregiver edits), so edits can be shown as "edited by you".
alter table handoffs add column if not exists generated_content jsonb;
-- How the draft was produced: AI insight run used (validated), or notes only when AI was unavailable.
alter table handoffs add column if not exists generation jsonb not null default '{}'::jsonb;
alter table handoffs add column if not exists edited_at timestamptz;

-- 'records' = drafted from the stored notes only (no AI available / no notes).
alter table handoffs drop constraint if exists handoffs_drafted_by_check;
alter table handoffs add constraint handoffs_drafted_by_check check (drafted_by in ('ai', 'caregiver', 'seed_fixture', 'records'));

-- At most one open (draft or reviewed, not yet submitted) handoff per case: the routine weekly draft.
create unique index if not exists handoffs_one_open_per_case on handoffs (case_id) where status in ('draft', 'reviewed');

-- History rows record status changes and other events (edits, regeneration, simulated response).
alter table handoff_status_history add column if not exists event text not null default 'status';
alter table handoff_status_history drop constraint if exists handoff_status_history_event_check;
alter table handoff_status_history add constraint handoff_status_history_event_check
  check (event in ('status', 'edited', 'regenerated', 'response_added'));
