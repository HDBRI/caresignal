-- Task 17: usage accounting and cost controls.
-- Every attempted AI request gets a usage_log row, even when the provider returned no usage
-- (then usage_reported = false and the token columns stay null — never 0, never estimated).
alter table usage_log add column if not exists usage_reported boolean not null default true;
alter table usage_log add column if not exists reasoning_tokens integer;
-- Only filled if the provider/gateway itself returns a cost. CareSignal never computes this column.
alter table usage_log add column if not exists provider_cost_usd numeric(12, 6);
alter table usage_log add column if not exists failure_reason text;
create index if not exists idx_usage_owner_case on usage_log (owner_id, case_id, purpose);

-- Insight runs remember a fingerprint of their exact input (messages, model, prompt version, note versions),
-- so the same request for the same patient is answered from the stored run instead of a new AI call.
alter table insight_runs add column if not exists input_fingerprint text;
create index if not exists idx_insight_runs_fingerprint on insight_runs (case_id, owner_id, input_fingerprint);
