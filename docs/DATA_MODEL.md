# CareSignal data model and data dictionary

Classroom prototype. **Synthetic data only** — no real people, PHI or medical records. No API keys or secrets are stored in the database.

## 1. Storage design

| | Hosted (public link) | Local (fresh clone, graders) |
|---|---|---|
| Engine | Supabase **Postgres** | **PGlite** — real Postgres compiled to WASM, runs inside Node, saved to `data/pgdata/` |
| Selected by | `DATABASE_URL` is set | `DATABASE_URL` is empty |
| Schema | `db/migrations/*.sql` | same files, plus `db/local/0000_local_auth.sql` (stand-in for Supabase's `auth` schema) |
| Access control | Row Level Security (RLS) | same RLS policies |

One schema, one set of RLS policies and one repository layer serve both modes, so the access rules tested locally are the ones that run in production. User records are never written to the hosting platform's disk.

**How ownership is enforced (two layers):**
1. **RLS.** Every user request runs in a transaction that sets `request.jwt.claims = {sub: <user id>, demo_session: <id or "">}` and switches to the `authenticated` role. Policies allow a row only if `owner_id = auth.uid()` and the parent case is visible. Demo copies are additionally limited to the visitor's own `demo_session`.
2. **Repository checks.** Every repository function (`src/lib/repo/*`) also filters by `owner_id` and first loads the case (throws *not found* if it is not the caller's). Client-supplied IDs and statuses are never trusted.

Admin access (migrations, seeding, usage accounting) uses the owner connection and is never exposed to the browser.

**Demo isolation.** Each demo login is shared, but every visitor gets a **demo session** and a **private copy** of the seeded case. Visitors cannot see, acknowledge or reset another visitor's copy, and nobody can modify the fixture files. Registered users can never see demo copies and vice versa.

## 2. Entity overview

```
auth.users ─┬─ profiles (display name, registered|demo)
            ├─ terms_acceptances (user, terms version, privacy version, timestamp)
            ├─ demo_sessions (one per demo visitor)
            └─ cases (one fictional patient)
                 ├─ baselines (caregiver-reported, per category)
                 ├─ observations ── observation_edits (versions 2..n)
                 │        ├──────── observation_analyses (AI labels, separate)
                 │        └──────── safety_alerts (deterministic rules)
                 ├─ checkins (one per day)
                 ├─ insight_runs ── insights (each with ≥1 source observation)
                 └─ handoffs ── handoff_status_history
                          ├──── receiver_records (delivery receipt, simulated)
                          └──── receiver_responses (fictional clinician response)
usage_log (AI token usage, server-only)        eval_results (server-only)
```

## 3. Data dictionary

Conventions: all timestamps are `timestamptz`, stored in UTC and returned as ISO-8601. **`NULL` means "not provided / not reported" — never "normal".** `synthetic` is `true` on every row in this prototype.

### profiles
| Column | Type | Meaning |
|---|---|---|
| user_id | uuid PK → auth.users | The account |
| display_name | text (1–60) | Name shown in the app (username / display name) |
| account_kind | `registered` \| `demo` | Demo accounts are shared and labeled "not a private account" |

### terms_acceptances
| Column | Type | Meaning |
|---|---|---|
| user_id | uuid | Who accepted |
| terms_version, privacy_version | text | Versions of the prototype notices accepted |
| fictional_data_affirmed | boolean, must be true | User affirmed they will use fictional data only |
| accepted_at | timestamptz | When |

### demo_sessions — *Caregiver/demo session*
| Column | Type | Meaning |
|---|---|---|
| id | uuid | Session id (kept in the visitor's session cookie) |
| owner_id | uuid | The shared demo account |
| seed_key | text | Which fixture case this visitor is exploring |
| created_at, last_seen_at | timestamptz | Lifecycle |

### cases — *Patient profile and care context*
| Column | Type | Meaning |
|---|---|---|
| id | uuid | Internal id |
| owner_id | uuid | Owning account |
| kind | `demo_copy` \| `user` | Demo copy (needs `demo_session_id`) or a registered user's own case |
| patient_ref | text | `PAT-CANCER-001` etc., or `PAT-USER-XXXXXX` for new cases |
| seed_key | text, nullable | Fixture it was copied from |
| pseudonym | text (1–60) | Fictional name only |
| care_context | text, nullable | Free-text context (fictional) |
| caregiver_name, caregiver_relationship | text, nullable | Optional |
| reminder_pref | `off` \| `in_app_daily` | Default **off**; in-app only, no email/SMS/push |
| synthetic | boolean, must be true | |
| seed_anchor | timestamptz, nullable | Anchor used to resolve relative seed dates |

### baselines — *Caregiver-reported baseline*
One row per category the caregiver described. **A missing category = baseline not reported.** `category` is one of the seven ids below; `origin` is `seeded` or `session`.

### observations
| Column | Type | Meaning |
|---|---|---|
| id | uuid | Internal id |
| case_id, owner_id | uuid | Patient case + owner |
| display_id | text, unique per case | **Stable ID** shown to users and used as the source ID: `OBS-C1-03` (seeded), `OBS-0001` (added this session) |
| original_text | text (1–4000) | **Exactly as entered. Immutable** (database trigger rejects changes) |
| entered_at | timestamptz | Set by the server when saved |
| event_time | timestamptz, nullable | Optional "When did this happen?". `NULL` = not provided; never guessed |
| author_label | text, nullable | Optional author/source, e.g. "Jamie (brother)" |
| origin | `seeded` \| `session` | Seeded example vs. added by the current visitor/user |
| synthetic | boolean | |
| is_test_scenario | boolean | Predefined synthetic test scenario (Case 2 urgent note) |
| safety_tier | `emergency` \| `contact_care_team` \| `review` \| `none` | Result of the deterministic rules at save time |
| safety_rule_ids, safety_rules_version | jsonb, text | Which rules fired, which rule version |
| ai_state | see below | Analysis status — never implies analysis that did not happen |

`ai_state`: `pending` (queued) · `complete` · `failed` (provider error/timeout) · `failed_validation` (output rejected) · `unavailable_error` (no key / AI down) · `unavailable_limit` (daily AI cap reached) · `not_run` (seeded; no live analysis yet).

### observation_edits
Version history. The original is version 1 (in `observations`); each edit adds version 2, 3, … The original is never changed.

### observation_analyses — *AI-derived labels*
`primary_category`, `secondary_categories` (allowlisted ids), optional `summary`, `model_reported`, `usage_log_id`. Stored separately from the note.

### safety_alerts
`tier`, `rule_ids`, `matched_text`, `rules_version`, `is_test_scenario`, `created_at`, `seen_at`. `seen_at` records "I've seen this" — it does **not** mean resolved, and the note is never deleted.

### checkins — *Daily check-in and response state*
One row per case per day. `responses` is `{ "<category>": {"state": "answered", "value": "..."} | {"state": "skipped"} }`. A category missing from `responses`, or a day with no row, is **not reported**. Asked categories: eating & drinking, energy & sleep, mobility & daily function, mood & thinking.

### insight_runs and insights — *AI insights*
`insight_runs`: one AI generation (`status`, `period_start/end`, `origin`, `model_reported`, `generated_at`, `usage_log_id`, `error_reason`). Only validated output is stored.

`insights`: `kind` (`pattern` · `change` · `possible_pattern` · `conflict` · `missing_info` · `question`), `statement`, `support` (`supported` · `possible_unconfirmed` · `conflicting` · `unknown`), `source_ids` (**at least one**, observation `display_id`s in the same case), `evidence` (`[{source_id, quote}]`, quotes are exact substrings of the original note), `uncertainty`.

### handoffs — *Weekly handoff*
| Column | Meaning |
|---|---|
| display_id | Unique `HO-XXXXXXXX`, shown to users and stored with the receipt |
| status | `draft` → `reviewed` (caregiver reviewed **and approved**) → `submitted` → `received` → `acknowledged`; `failed` is retryable |
| draft | Editable content: `summary`, `items[{statement, support, sourceIds}]`, `questions[{text, sourceIds}]`, `missingInfo[]` |
| drafted_by | `ai` · `caregiver` · `seed_fixture` (example written for a synthetic scenario — labeled as such) |
| approved_payload | Frozen payload at approval (required for every status after draft) |
| source_ids | All observations referenced |
| idempotency_key | Unique; retries return the original receipt instead of creating duplicates |

### handoff_status_history
Every status change with timestamp and optional note.

### receiver_records — *Delivery receipt (simulated receiver)*
Exists only once the simulated backend has persisted the approved payload. `payload` is the exact submitted JSON; `received_at`; `acknowledged_at` (separate explicit action). No real care team is contacted.

### receiver_responses — *Simulated receiver response*
Only `fictional_clinician_response`, always `synthetic = true`, with a `label` such as "Simulated scenario outcome — not an AI recommendation or a real clinical event."

### usage_log — *Tokenomics (server-only)*
`purpose`, `status` (`complete` · `failed` · `rejected`), `model_requested` (`gpt-6-luna`), `model_reported`, `provider_request_id`, `prompt_tokens`, `cached_tokens`, `completion_tokens`, `total_tokens`, `latency_ms`. Values are copied from the provider's response; fields the provider did not return stay `NULL` (never 0). No row is written when the provider returned no usage.

### eval_results — *Evaluation result (server-only)*
`eval_case_id` (from `synthetic-data/evaluation/evaluation-cases.json`), `run_label`, `check_name`, `passed`, `details`, `model_reported`, `usage_log_id`. **Evaluation cases** themselves are versioned fixtures, not database rows.

## 4. Observation categories (allowlist)

| id | Label |
|---|---|
| `eating_drinking` | Eating & drinking |
| `energy_sleep` | Energy & sleep |
| `mobility_function` | Mobility & daily function |
| `symptoms_comfort` | Symptoms & comfort |
| `mood_cognition` | Mood & thinking |
| `medications_treatment` | Medications & treatment (as reported — never advice) |
| `care_coordination` | Care coordination |

## 5. Synthetic data package

See `synthetic-data/README.md`. Three locked cases (25 observations), evaluation cases, relative timestamps resolved from one anchor per copy.

## 6. Commands

| Command | What it does |
|---|---|
| `npm run db:setup` | Apply migrations; in local mode also create the three demo accounts. Safe to re-run. |
| `npm run db:reset` | **Local only.** Delete `data/pgdata` and rebuild the known starting state. Stop `npm run dev` first. |
| `npm run db:status` | Driver, applied migrations, row counts. |

Demo copies are created when a visitor opens a demo case; a visitor's **Reset demo** (in the app) deletes only their own copy — its notes, alerts and acknowledgements, check-ins, insights, handoffs and receipts — and re-seeds it with dates relative to that moment.
