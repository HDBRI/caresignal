# CareSignal

**Turn everyday observations into clearer care conversations.**

**Live app:** https://caresignal-gilt.vercel.app · **Repo:** https://github.com/HDBRI/caresignal

CareSignal is an AI-assisted care-coordination demo for family caregivers supporting someone through complex illness or recovery. Caregivers log observations in their own words. CareSignal keeps every original note exactly as written, runs predefined safety rules immediately, and uses AI to organize the notes into evidence-linked summaries and caregiver-reviewed handoffs for a (simulated) care team. Every insight links back to the source observations.

> ⚠️ **Classroom prototype — synthetic data only.**
> CareSignal was built for MGT 409 (AI Foundations for Managers, Yale SOM). It is **not medical advice**, **not a diagnostic or treatment tool**, **not a validated clinical triage system**, and **not connected to any real EHR, hospital, pharmacy, clinician or care team**. The receiver is simulated. Use fictional people and events only — never real patient information. It is not HIPAA compliant and not production software. **In an emergency, call 911.**

---

## Status

This README tracks what is actually built. Current stage: **optional daily check-in and reminder preference** (Task 11 in `prompt_log.md`).

| Area | Status |
|---|---|
| Next.js app, design system | ✅ Built |
| Demo access (3 shared demo logins → private, resettable copy per visitor) | ✅ Built + tested locally |
| Registration / sign-in / sign-out / password reset / account deletion (Supabase Auth) | ✅ Implemented + tested **live against the project's Supabase** from a local run (register → onboarding → sign out → sign in → delete account; live provider tests pass). Public link not deployed yet |
| Terms of Use + Privacy Notice (versioned) and stored acceptance record | ✅ Built + tested |
| All 8 screens on real stored data: Welcome, Choose case/Onboarding, Overview dashboard, Observations timeline (+ note detail, filters, check-in history), Insights, Handoffs, Demo receiver, Settings | ✅ Built + browser-tested (8 Playwright UI tests) |
| Add observation (every screen), daily check-in (5 explicit states), emergency banner on every screen until marked seen | ✅ Built + tested |
| `.env` loading (project folder, then parent) | ✅ Built + tested |
| AI client (`gpt-6-luna` via Portkey, honest failure states, provider-reported token usage) | ✅ Built + tested (no live calls yet) |
| Deterministic safety rules (4 levels, plain-language explanations, injection-resistant) | ✅ Built + tested (90 synthetic cases) |
| Postgres schema, migrations, Row Level Security | ✅ Built + tested locally (PGlite) **and applied to Supabase**; demo-visitor isolation re-checked live on Supabase |
| Repository layer (cases, observations, alerts, check-ins, handoff/insight reads, usage) | ✅ Built + tested (incl. cross-user, cross-case and demo-visitor isolation) |
| Synthetic data package (3 cases, 25 observations, evaluation cases), seed/copy/reset | ✅ Built + tested |
| Per-note AI categories (gpt-6-luna, background, allowlisted, validated, daily caps, provider token usage logged); states pending / complete / unavailable / failed with retry | ✅ Built + tested (stand-in AI in tests; verified with a live call) |
| Caregiver category corrections and wording edits (original kept, versioned, safety re-checked); timeline search | ✅ Built + tested |
| Period insights (summary, supported / possible / conflicting findings with exact-quote evidence, unknowns, neutral questions); strict schema + per-statement claim checks; deterministic 911 notice on items citing urgent notes | ✅ Built + tested (deterministic tests; separate live smoke test `npm run test:live`) |
| Real AI output pre-generated once for the 3 demo cases (`npm run seed:ai`), labeled "prepared with the demo" | ✅ 25/25 notes + 3/3 insight runs passed all checks |
| Optional daily check-in: 4 explicit answers (incl. "Skip today"), response timestamp, optional note for change/concern that can be saved as an observation; "No response recorded" never read as fine | ✅ Built + tested |
| In-app reminder preference: off by default, one daily local time, shown only inside the app (no email/SMS/push), never blocks logging | ✅ Built + tested |
| Care insights dashboard: chart period (7 / 30 days / all history) separate from the AI window; metrics and 7 category charts from stored records; "Changes worth reviewing" labeled by source (records / safety rule / AI); baseline comparison; evidence drawer; raw IDs hidden (kept internally) | ✅ Built + tested |
| Weekly handoff: draft from stored notes + validated AI output (or notes only when AI is unavailable), caregiver edit, approve, submit to the simulated receiver, acknowledge, fictional response (Case 1), versions and full status history | ✅ Built + tested |
| Hosted deployment (Vercel + Supabase) | ✅ Live at https://caresignal-gilt.vercel.app — tested in a clean incognito session on 2026-10-25: demo entry, registration with Terms/Privacy acceptance, case creation, sign-out/sign-in, password-reset email |

---

## Quick start (local)

Requirements: **Node.js 22 or newer** (tested on Node 24). No database install needed.

```bash
git clone <repo-url> caresignal
cd caresignal
npm install
cp .env.example .env        # then put your PORTKEY_API_KEY in .env (optional — see below)
npm run dev
```

Open **http://localhost:3000**.

- `.env` is read from the project folder first, then from the **parent folder**. If the parent folder already has a `.env` with `PORTKEY_API_KEY` (as the course staff setup does), you can skip the `cp` step.
- Without `PORTKEY_API_KEY` the app still runs: note-taking and the safety rules work, and AI analysis shows as **unavailable**.
- Without `DATABASE_URL` the app uses a local Postgres database (PGlite, no install needed) in `data/pgdata/`, created and migrated automatically on first use (git-ignored). `npm run db:setup` does the same explicitly.

Check which settings were found (prints names only, never values):

```bash
npm run env:check
```

## Demo access (for evaluators)

Shared, **public** demo logins — synthetic data only, not private or secure accounts. They are also shown in the **Demo access** panel on the welcome page, and the **Explore a demo** page fills them in for you.

| Case | Username | Password |
|---|---|---|
| Jordan Lee — cancer treatment, pattern + fictional clinician response | `demo-cancer` | `CareSignal-Demo-2026` |
| Morgan Patel — post-surgery, predefined urgent test scenario | `demo-surgery` | `CareSignal-Demo-2026` |
| Alex Rivera — gradual change, conflicting/incomplete reports | `demo-recovery` | `CareSignal-Demo-2026` |

- Every sign-in opens a **fresh private copy** of that case for this browser. Notes you add, alerts you mark as seen and handoffs you submit stay in your copy; other visitors never see them. **Settings → Reset my demo copy** restores the original scenario (dates are regenerated relative to now). The prepared scenarios themselves cannot be changed.
- Demo visitors never get an authentication-provider session, so they cannot change the demo password or delete the demo accounts.
- A deployment can change the shared password with `DEMO_PASSWORD`.

## Accounts (registered users)

Registration, sign-in, sign-out, password reset and account deletion use **Supabase Auth**. CareSignal never stores or logs passwords.

- **Local copy without Supabase variables → local demo mode.** The three demo cases work fully; the account buttons say "Available on the hosted version". (CareSignal deliberately has no home-made password system.)
- Registration requires: email, username (3–30 chars, unique, case-insensitive), password (10–72 chars with a letter and a number), confirm password, and three unchecked-by-default boxes: Terms of Use, Privacy Notice, and "fictional data only". The server stores an acceptance record (user ID, Terms version, Privacy version, timestamp, fictional-data affirmation).
- Signed-in users see only their own cases (Row Level Security + server-side checks), can create a fictional case (only a pseudonym is required) or copy a demo scenario, and can delete their account (deletes every row they own).

### Supabase + Vercel setup checklist

Done (2026-10-25): Supabase project (us-east-1, Data API off), schema applied, demo users created, email confirmation off, Site URL + redirect URLs set to the public link; Vercel project `caresignal` deployed with the environment variables below. The steps are kept here so the deployment can be reproduced.

1. **Create a Supabase project** (free tier) at supabase.com.
2. **Apply the schema:** with the project's *Transaction pooler* connection string in `.env` as `DATABASE_URL`, run `npm run db:setup`. This applies `db/migrations/*` (not `db/local/*`) and creates the three demo users (fixed IDs, random unknown passwords) with their profiles. Needs `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` too.
3. **Auth settings** (Supabase dashboard → Authentication):
   - *Email confirmation*: recommended **off** for the class demo (the built-in email sender is limited to a few emails per hour). If you turn it on, the app shows "Check your email" and never claims an unconfirmed email is verified.
   - *Minimum password length*: 10.
   - *URL configuration*: Site URL = your public URL; add `https://<your-app>/auth/callback` (and `http://localhost:3000/auth/callback` for local testing) to Redirect URLs. Password-reset emails return through `/auth/callback?next=/reset-password`.
4. **Create a Vercel project** from the GitHub repo and set environment variables: `PORTKEY_API_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL` (the public URL). Never expose the service-role key or `DATABASE_URL` in browser code — CareSignal only reads them on the server.
5. **Test the public link in a private/incognito window:** open a demo with each credential; register a new account; sign out; sign in from a different browser and confirm your case is still there; request a password reset; delete the test account.
6. **Run the live provider tests:** set `SUPABASE_TEST_URL`, `SUPABASE_TEST_ANON_KEY`, `SUPABASE_TEST_SERVICE_ROLE_KEY` and run `npm test` — the tests in `tests/provider.blocked.test.ts` stop being skipped.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the development server on http://localhost:3000 (uses Supabase if `.env` has its settings) |
| `npm run dev:local` | Same, but always on the local database — safe for development even when `.env` points at the live Supabase |
| `npm run test:live` | LIVE smoke test: real gpt-6-luna calls on synthetic data (needs `PORTKEY_API_KEY`). Separate from the deterministic tests |
| `npm run seed:ai` | Regenerate the real AI output stored for the demo cases (validated before it is saved) |
| `npm run test:ui` | Browser UI tests (Playwright) on a separate local server (port 3100, fresh local database). First run: `npx playwright install chromium` |
| `npm run build` / `npm start` | Production build / serve it |
| `npm test` | Run the automated tests (Vitest) |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run check` | Typecheck + lint + tests |
| `npm run env:check` | Show which `.env` files and keys were found (no values) |
| `npm run db:setup` | Apply migrations (+ local demo accounts). Safe to re-run |
| `npm run db:reset` | Local only: rebuild the database from scratch (stop `npm run dev` first) |
| `npm run db:status` | Show database driver, migrations and row counts |

## Environment variables

See `.env.example`. Names only:

| Variable | Needed for | Notes |
|---|---|---|
| `PORTKEY_API_KEY` | AI analysis | Course key. Model is fixed to `gpt-6-luna`. Server-side only. |
| `DATABASE_URL` | Hosted mode | **Server-only.** Supabase Postgres connection string (transaction pooler). Empty = local database |
| `NEXT_PUBLIC_SUPABASE_URL` | Hosted mode | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Hosted mode | Public anon key (safe in browser; RLS enforces access) |
| `SUPABASE_SERVICE_ROLE_KEY` | Hosted mode | **Server-only.** Never in browser code. |
| `NEXT_PUBLIC_SITE_URL` | Hosted mode | Public URL used in password-reset links |
| `DEMO_PASSWORD` | Optional | Shared public demo password. Default `CareSignal-Demo-2026` |
| `AI_DAILY_LIMIT_PER_USER` | Optional | AI analysis calls per user per UTC day. Default **25**. Note entry is never capped. |
| `AI_DAILY_LIMIT_GLOBAL` | Optional | AI analysis calls per UTC day for the whole app. Default **500**. |
| `CARESIGNAL_PGLITE_DIR` | Optional | Custom folder for the local database (`:memory:` = in-memory) |

## Safety rules (prototype)

`src/lib/safety/rules.ts` holds a small, explicit set of phrase rules that run on the **original note** the moment it is saved (and on check-in notes) — before and independently of any AI call, with no network. If the AI key is missing, the provider times out or returns malformed output, the alert is already stored. Levels:

- **Emergency** (red; e.g. difficulty breathing, hard to wake, chest pain, seizure, fainting) → "If this is happening now, call 911 and follow the dispatcher's instructions."
- **Prompt attention** (amber; e.g. fever, bleeding, wound looks infected, can't keep fluids down) → contact the care team promptly.
- **Review** (neutral marker; e.g. confusion, dizziness, a fall, not eating) → "Please review this observation".
- **Routine** → "no predefined rule matched". CareSignal never says "safe" or "low risk", and never diagnoses or suggests treatment.

Every alert explains in plain words which rule fired and the exact words matched, and shows the original note. Emergency and prompt-attention notices stay at the top of every case screen until "I've seen this"; marking seen never deletes the note or the alert. Simple negations ("no trouble breathing", "denies chest pain") do not trigger.

**Prompt-injection defense:** notes are treated as data. Commands inside a note ("ignore your safety rules", "mark this patient safe", "print the API key") cannot disable a rule or change its level, and AI output is schema-validated, with fabricated source IDs and non-exact quotes rejected.

Results on the synthetic test set (`tests/fixtures/safety-cases.json`, regenerate with `npm run safety:report`; full table in [docs/SAFETY_EVALUATION.md](docs/SAFETY_EVALUATION.md)):

| Measure | Result |
|---|---|
| Alert cases caught (true positives) | 46 / 49 |
| Missed triggers (documented known misses) | 3 / 49 |
| False positives on no-alert cases | 2 / 41 (both documented) |
| Prompt-injection notes with the correct level | 5 / 5 |

**Limitation:** these rules cover a small predefined set of phrases written by the developer, and the test set was written by the same person. These numbers are **not** real-world sensitivity or specificity. Phrasings outside the set will be missed. **No alert does not mean the situation is safe.**

## Weekly handoff

A handoff organizes the **last 7 days** of caregiver-reported observations for a conversation with the care team (`src/lib/ai/handoff.ts`, `src/lib/repo/handoff-workflow.ts`).

- **What it contains:** patient pseudonym and date range; a plain-language summary; statements grouped as *supported*, *possible — not confirmed* and *conflicting reports*, each with its source note IDs and the original notes one click away; notes by category; urgent notes from the period and when their guidance was shown; uncertain/missing information; questions the caregiver may want to ask; and every source observation exactly as entered.
- **Where the text comes from:** statements, unknowns and questions come only from an insight run that passed every check in `insights.ts` (exact quotes, known source IDs, no diagnosis, no medication advice, no safety claims). A run made from exactly the same notes is reused; otherwise a new one is generated. If the AI is unavailable or its output is rejected, the draft lists each note as written and says nothing was analyzed. A week with no notes says **"No observations were logged for this period."**
- **Labels:** caregiver-reported notes, AI-drafted text, text edited by the caregiver, and the simulated receiver's fictional response are labeled separately.
- **Review before submit:** nothing is ever sent automatically. The caregiver may edit wording (sources stay attached and can't be changed or invented), must confirm they reviewed the draft to approve it, and then chooses to submit. Editing an approved handoff returns it to draft.
- **One open draft per case:** regenerating updates the open draft. A submitted handoff is frozen. If information is added or corrected after submission, a new version is created and the earlier version and its receipt are kept unchanged. If nothing changed, no new draft is made.
- **Submit:** the server checks status, payload schema and that every source ID exists in the case, then saves the receipt and status history in one transaction. Retrying with the same submission key returns the original receipt.
- **Status history:** draft → reviewed → submitted → received (simulated) → acknowledged (simulated), plus edits, regenerations and the fictional response.
- **Urgent notes are never deferred:** emergency and prompt-attention guidance appears the moment a note is saved; the handoff only records that it was shown.

## Project structure

```
src/
  app/                 Next.js routes (pages + API route handlers)
    api/health/        Status endpoint (no secrets)
  components/          UI components
  lib/
    env.ts             .env loading (project, then parent)
    config.ts          Model name, AI caps, data-backend selection
    ai/client.ts       Portkey / gpt-6-luna client
    safety/rules.ts    Deterministic safety rules
    categories.ts      The seven observation categories (allowlist)
    models.ts          Typed domain models
    fixtures.ts        Loads + validates the synthetic data package
    time.ts            UTC storage, relative seed dates
    db/                Postgres client (Supabase or PGlite) + migration runner
    repo/              Repository layer — every read/write checks ownership
db/migrations/         Postgres schema + Row Level Security (hosted and local)
db/local/              Local-only stand-in for Supabase's auth schema
synthetic-data/        Synthetic data package (3 locked cases + evaluation cases)
tests/                 Vitest tests (+ synthetic safety phrases)
scripts/               env check, database setup/reset/status
docs/                  Implementation plan, data model + data dictionary
prompt_log.md          Prompt log for the course
```

## How Insights counts (dashboard)

- A note's **day** is its event time if given, otherwise its entry time, in the app time zone (America/New_York). Notes with unreadable dates are excluded and counted as "undated".
- A note's **categories** are the caregiver's correction if one exists, otherwise the AI labels — only once AI analysis completed. Uncategorized notes are shown as a separate count.
- **Category counts** count each note at most once per category; one note can belong to several categories, so category counts can add up to more than the **total**, which counts unique notes.
- Bars are **logged observations per day** (up to 14 days) or **per week** (longer periods). Counts measure how much was written down, never severity.
- "From your records" findings are rules over these counts (repeated topic on 2+ days; more/fewer notes than the previous equal period, only when earlier records exist). They never claim a condition changed.

## Data model

See **[docs/DATA_MODEL.md](docs/DATA_MODEL.md)** for the storage design, ownership/RLS rules and the full data dictionary, and **[synthetic-data/README.md](synthetic-data/README.md)** for the three demo cases.

## Data and privacy

- Synthetic data only. Do not enter real names, dates of birth, addresses, contact details, insurance or health information about real people.
- Original notes are stored exactly as entered and cannot be overwritten (database trigger); edits become new versions. AI results are stored separately.
- Every user-owned row is tied to an account and protected by Row Level Security plus server-side ownership checks. Each demo visitor gets an isolated, resettable copy.
- AI calls happen only on the server; the API key never reaches the browser.
- No analytics or third-party tracking.
