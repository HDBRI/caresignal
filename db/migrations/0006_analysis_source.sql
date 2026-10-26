-- Category labels can come from the AI or from a caregiver correction.
-- A correction is a NEW row; the AI's row is kept, and the original note is never touched.
alter table observation_analyses add column if not exists source text not null default 'ai';
alter table observation_analyses drop constraint if exists observation_analyses_source_check;
alter table observation_analyses add constraint observation_analyses_source_check check (source in ('ai', 'caregiver'));

-- Safety result of an edited version (the original's result stays on the observation row).
alter table observation_edits add column if not exists safety_tier text;
