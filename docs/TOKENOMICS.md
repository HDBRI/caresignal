# CareSignal — tokenomics: measured usage and illustrative cost estimates

Generated 2026-10-26T15:04:20.803Z by `npm run tokenomics`. Assumptions: [`config/cost-assumptions.json`](../config/cost-assumptions.json) (edit and re-run).

> **Read this first.** Section 1 is **measured**: token counts exactly as the provider returned them. Section 2 is an **illustrative estimate** built from stated assumptions and an **unverified** price. The provider did not return a cost for any call, so no measured cost exists. None of this is a bill.

## 1. Measured usage (provider-reported)

| Source | Task | Requests | Requests with usage | Input tokens (sum) | Output tokens (sum) | Avg input / call | Avg output / call | Provider-returned cost |
|---|---|---|---|---|---|---|---|---|
| Evaluation run (2026-10-26) | categorization | 36 | 35 | 14,280 | 5,229 | 408 | 149 | not returned |
| Evaluation run (2026-10-26) | insight summary | 4 | 4 | 4,201 | 9,304 | 1,050 | 2,326 | not returned |
| Demo preparation, `npm run seed:ai` (2026-10-26) | categorization | 25 | 25 | 10,207 | 3,964 | 408 | 159 | not returned |
| Demo preparation, `npm run seed:ai` (2026-10-26) | insight summary | 3 | 3 | 3,374 | 7,848 | 1,125 | 2,616 | not returned |
| Live app (hosted database, all users, 2026-10-26 – 2026-10-26) | insight summary | 2 | 2 | 2,261 | 4,649 | 1,131 | 2,325 | not returned |
| Live app (hosted database, all users, 2026-10-26 – 2026-10-26) | categorization | 1 | 1 | 280 | 59 | 280 | 59 | not returned |

- "Requests" counts every attempted request; requests where the provider returned no usage are counted but their tokens are **not** guessed (shown as not reported, never 0).
- Output tokens include the model's reasoning tokens, which are billed as output.
- Task types are recorded with each request: categorization, insight summary, handoff draft (a weekly draft that needed a new insight call), and evaluation (kept in the evaluation results file). Only counts, token numbers, model name, status and timestamps are stored — never note text, prompts or keys.

## 2. Illustrative cost estimate (assumptions, not measurements)

**Price used: ILLUSTRATIVE.** Assumption, not a verified price. Stand-in values equal to OpenAI's published GPT-5 API list price as remembered from its August 2025 launch (US$1.25 per 1M input tokens, US$0.125 per 1M cached input tokens, US$10 per 1M output tokens). No price for gpt-6-luna, for the course's Portkey account, or for any discount could be verified. Date checked: Not verified. Assumption recorded 2026-10-26.

| Price assumption | US$ per 1M tokens |
|---|---|
| Input | 1.25 |
| Cached input | 0.125 |
| Output | 10 |

**Calculation:** cost of one call = (input tokens × input price + output tokens × output price) ÷ 1,000,000. Cached input is priced lower but none was reported in the measured calls, so the estimate assumes no cached input.

| Per call (illustrative) | Input tokens | Output tokens | Cost |
|---|---|---|---|
| Categorize one note | 408 | 149 | $0.0020 |
| Insight summary / handoff draft | 1050 | 2326 | $0.02 |

### Usage assumptions (per active user, per month)

| Assumption | Value | Why |
|---|---|---|
| observationsPerUserPerMonth | 40 | About 10 notes a week from an active caregiver. |
| categorizationCallsPerObservation | 1 |  |
| insightRequestsPerUserPerMonth | 4 | About one 'Generate AI analysis' per week. |
| insightCacheHitShare | 0.25 | Share of insight requests answered from a saved run because the notes had not changed (no AI call). |
| handoffDraftsPerUserPerMonth | 4 |  |
| handoffDraftsNeedingNewAiCall | 0.5 | Share of weekly handoff drafts that need a new insight call; the rest reuse a validated run for the same notes. |
| retryRate | 0.05 | Extra calls from failed requests that are retried (timeouts, rejected output). |
| tokensPerCall | categorize 408 in / 149 out; insights 1050 in / 2326 out | Taken from the measured averages in section 1 (evaluation run). |

| Task | AI calls / user / month (incl. retries) | Cost / user / month |
|---|---|---|
| categorization | 42.00 | $0.08 |
| insight summary | 3.15 | $0.08 |
| handoff draft | 2.10 | $0.05 |
| **Total** | **47.25** | **$0.21** |

### Report-ready table

| | 100 users / month | 10,000 users / month |
|---|---|---|
| AI calls | 4,725 | 472,500 |
| Input tokens | 2,264,850 | 226,485,000 |
| Output tokens | 1,846,950 | 184,695,000 |
| Cost: categorization | $8.40 | $840 |
| Cost: insight summary | $7.74 | $774 |
| Cost: handoff draft | $5.16 | $516 |
| **Estimated cost (illustrative)** | **$21.30** | **$2,130** |

Model API cost only — hosting, database, storage and staff time are not included. Estimates scale linearly with users; real usage varies by person and would need to be measured.

## 3. Cost controls in the app

- **Bounded input:** each note is at most 4,000 characters; one insights request includes at most 24,000 characters of note text (the most recent notes; the model is told how many older notes were left out).
- **Bounded output:** at most 1,500 output tokens per categorization and 6,000 per insight request (measured maximums: 295 and 3,199). A response cut off by the limit is treated as a failure, never as a partial answer.
- **No repeat analysis:** a note's original text never changes, so it is categorized once; retries happen only after a failure.
- **Caching by note version, per patient:** an insight request whose exact input (messages, model, prompt version and each note's wording version) matches a saved run for the **same case** reuses that run with no AI call. Adding a note, correcting a note's wording, or any change to the input makes a new request. Lookups are filtered by case and owner, so results are never shared across patients.
- **Explicit regeneration:** "Regenerate anyway" on the Insights page makes a new request on purpose; weekly handoff drafts reuse a validated run for the same notes.
- **Concise outputs:** prompts ask for short JSON with at most 5 facts per note and at most 8 insights / 6 questions per summary.
- **Daily caps:** 25 AI requests per user and 500 overall per day (configurable).

## 4. Measured vs estimated — in one paragraph

Measured: request counts and input/output token counts returned by the provider for the evaluation run, the demo preparation and (when available) the live app. Not measured: cost — the provider returned none. Estimated: everything in section 2, from an unverified stand-in price and assumed usage per user. Change `config/cost-assumptions.json` and re-run `npm run tokenomics` to test other assumptions.
