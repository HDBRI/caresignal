# CareSignal — final audit (2026-10-26)

Every item below was actually run on 2026-10-26 unless marked otherwise. "Pass" means the command or test ran and passed.

## 1. Commands run and results

| Check | Command | Result |
|---|---|---|
| Type check | `npm run typecheck` (via `npm run check`) | ✅ pass |
| Lint | `npm run lint` (ESLint, via `npm run check`) | ✅ pass |
| Formatting | — | ⚠️ not run — no formatter (e.g. Prettier) is configured in this project; ESLint is the only style check |
| Unit + integration tests (Vitest, real Postgres via PGlite) | `npm run test` (via `npm run check`) | ✅ 348 passed · 8 skipped (the opt-in live-AI smoke tests, `npm run test:live`) — after the fixes in §4 |
| Browser tests (Playwright, AI key removed) | `npx playwright test` | ✅ 40 passed in one run (5.1 min) after both fixes in §4 |
| Production build | `npm run build` | ✅ compiled successfully |
| Clean setup from README | `git clone` → `npm ci` → `npm run dev` equivalent (`next dev`) with **no `.env`** in the folder or its parent | ✅ installed in 52 s; `/api/health` 200 (local database OK, AI "unavailable_missing_key"); `/demo` 200; all three demo cases opened and all six case screens returned 200; Morgan's emergency banner shown with AI offline |
| Report page count | `node scripts/report-pdf.mjs` (Chromium print to US-Letter PDF, `preferCSSPageSize`) + page objects counted; cross-checked with `pypdf` | ✅ **14 pages**, 612×792 pt, 0 broken images |
| Slide count | `node scripts/slides-check.mjs` (opens `slides.html` from disk with **all network requests blocked**, counts with `Reveal.getTotalSlides()`) | ✅ **10 slides**, 0 network requests, 0 broken images, 0 slides overflowing, 0 script errors |
| Secrets in tracked files | regex scan of `git ls-files` (API keys, JWTs, DB URLs with passwords, service-role keys) + check that each real `.env` value (4 values ≥ 12 chars) appears in no tracked file | ✅ only the `.env.example` placeholder and a dummy value in `tests/env.test.ts`; real values found: none |
| `.env` handling | `git check-ignore .env`; `git log --all -- .env` | ✅ ignored by `.gitignore` (`.env*`, with `!.env.example`); never committed |
| `.env.example` | read | ✅ placeholders/blank values only (`your-portkey-api-key-here`) |
| Evaluation / tokenomics evidence | sha256 of 6 evidence files vs. fingerprints taken before Task 18 | ✅ unchanged (checked in Task 20; no evidence files were edited in Task 21) |

## 2. Locked visual design and safety behavior

| Requirement | How verified | Result |
|---|---|---|
| All 8 screens / routes work | `audit.spec.ts` "all eight screens open"; clean-clone check | ✅ |
| Welcome asks for no real identifiers | Welcome has no inputs; new-case form has no DOB/SSN/MRN/insurance/address/phone fields (`audit.spec.ts`) | ✅ |
| Persistent "Synthetic demo data" label | Every case screen, all 3 cases (`audit.spec.ts`; also at 375 px in `a11y.spec.ts`) | ✅ |
| AI content distinguished from original notes | Observation detail: "Caregiver's note — original…" vs "Categories (separate from the original note)"; handoff: "Caregiver's original notes" tag, AI-drafted dashed frame | ✅ |
| Emergency guidance immediately, AI offline | Test server has no AI key: seeded urgent note banner + a newly added urgent note opens the 911 dialog at once (`audit.spec.ts`, `navigation.spec.ts`); unit tests with timeout / malformed output | ✅ |
| Status never by color alone | Every `.pill`, `.hs-badge`, `.kind-tag`, `.source-tag` on every case screen has words (`audit.spec.ts`); axe WCAG 2.1 A/AA on every screen (`a11y.spec.ts`) | ✅ |
| Demo receiver clearly simulated | Persistent banner "Simulated receiver — no real care team is connected." + not-connected text (`audit.spec.ts`) | ✅ |
| No "patient safe / all clear" or fake health scores | Text of every case screen for all 3 cases scanned; such words appear only in negated disclaimers ("never says 'all clear'") (`audit.spec.ts`) | ✅ |

## 3. Behavior checks

| Requirement | Evidence | Result |
|---|---|---|
| All three synthetic cases | `audit.spec.ts` per-case tests; clean-clone check | ✅ |
| Original notes unchanged | Every fixture note's text appears verbatim on Observations for each case (`audit.spec.ts`); wording corrections keep the original (`observations.spec.ts`, unit tests) | ✅ |
| Source IDs resolve | Every source chip in each case's handoff opens a record whose original text matches the fixture (`audit.spec.ts`) | ✅ |
| No handoff sent before review | Submitting a draft → 409; approve requires confirmation (`handoffs.test.ts`, `handoff-delivery.test.ts`, eval DET-HANDOFF-APPROVAL) | ✅ |
| Receipts only after persistence | Received written in the same transaction as the receipt; failure → Failed, no receipt (`handoff-delivery.test.ts`) | ✅ |
| Duplicate retries | Same key (incl. concurrent) → one receipt; other key → 409 | ✅ |
| Acknowledgement is separate | Received ≠ acknowledged until the explicit action (`handoff-delivery.test.ts`, `handoff.spec.ts`) | ✅ |
| Patient isolation | `isolation.test.ts`, `handoff-delivery.test.ts` (another user → 404), demo visitors isolated (`seed`/eval DET-SEPARATION) | ✅ |
| Synthetic flags | `fixtures.test.ts`, eval DET-SYNTHETIC | ✅ |
| Reset behavior | Added note removed after "Reset my demo copy"; seeded notes restored (`audit.spec.ts`) | ✅ |
| Genuine screenshots | Captured from the running app on 2026-10-26 by `scripts/report-capture.mjs` / `report-capture-static.mjs`; used in report and slides | ✅ |
| README setup + links | Clean-clone run followed the README; README now links `report.html`, `slides.html`, this file | ✅ |

## 4. Failed / open items

1. **Safety-rule gap found in this audit — FIXED (your decision: Option A).** "He is not breathing" was not covered, and "He is not breathing normally and won't wake up" gave no alert because a "not" in an earlier clause cancelled the later match. Fix (rules `2026-10-26.1`): a "not / isn't / stopped breathing" pattern (excluding "not breathing hard"), and negation now stops at punctuation and at "and / but / then / so". Added 4 emergency phrases, 1 false-trigger probe and 2 negated phrases to the test set and regression tests. Safety results now **50/53 caught, 2/44 false alerts** (before: 46/49, 2/41 — the evaluation run in `docs/EVALUATION.md` used the earlier rules and is left unchanged as a dated record). Report, slides, README and `docs/NOVELTY_AND_IMPACT.md` updated; `docs/SAFETY_EVALUATION.md` regenerated with a change log.
   **Second bug found while re-testing — FIXED:** on the detail page of a note whose AI is unavailable, the "Try AI again" form was nested inside a `<p>`, which is invalid HTML and caused a React hydration error that re-rendered the page (collapsing "Set the categories yourself"). Changed the container to a `<div>`.
2. **Impact has no real-user evidence** (quote, screenshot or before/after time). The rubric caps that row at half credit without it; the report says so honestly.
3. Formatting check not run (no formatter configured).

## 4b. Pattern detection added after the audit (2026-10-26)

Deterministic pattern engine, treatment/care timeline from note-documented events, Insights "What appears to be changing", and the structured handoff (A–F) rendered identically on the receiver. Tests: 17 pattern scenarios + 4 structured-handoff tests + 1 browser test. No AI contract change and no new AI calls (patterns are computed from stored notes). Not covered by the earlier live model evaluation. Smallest data-model extension still needed: a `care_events` table (date, kind, date certainty, medication status).

## 4c. Monthly synthetic dataset import (2026-10-26)

- The demo cases now hold ~30 days of synthetic notes each (import script `scripts/import-monthly.ts`, deterministic and idempotent; migration `0013` adds the `scenario` category source).
- Safety tiers come from the app's rules, not the dataset labels (4 disagreements reported by the import; the rules win).
- No AI calls were made for the import or the new screenshots; the AI output generated for the earlier notes is not attached to the new notes.
- Evaluation, tokenomics and the traced run are unchanged and refer to the earlier notes, kept in `synthetic-data/evaluation/legacy-v1/` (tests that need those notes use them).
- Fixed while importing: an Insights finding with no notes in the current week showed an "Add to this week's handoff" button that could not succeed; long finding text was rejected (limit raised).
- Verification: 376 unit tests, 41 e2e tests, build OK; report 15 pages, slides 10.

## 5. Known limitations (unchanged)

Small predefined safety rule set (3 documented misses, 2 false positives on the set; other paraphrases will be missed); synthetic data only; no clinical validation; no real EHR/care team (receiver simulated; not HIPAA compliant); AI depends on the Portkey/API availability and daily caps; model errors remain (6/40 model cases failed); one live evaluation run; no user research; cost estimates use an unverified stand-in price; Handoffs and observation detail still show internal note IDs; the "open demo" step occasionally stalls in automated tests on a slow machine (passed in the final full run).

## 6. Decisions still needed from you

- ~~Fix the safety-rule gap?~~ Done (Option A), see §4.
- ~~Push and redeploy~~ — approved; done after this checklist was updated (see the commit history and the live `/api/health` rules version `2026-10-26.1`).
- Whether to add real-user Impact evidence (e.g., time yourself assembling a handoff by hand vs. with CareSignal on a synthetic case).

## 7. Commands to reproduce

```bash
npm ci
npm run check                 # typecheck + lint + unit/integration tests
npx playwright test           # browser tests (starts its own server without an AI key)
npm run build
npm run eval                  # deterministic evaluation (no network)
python scripts/build-report.py && node scripts/report-pdf.mjs     # rebuild report + page count
python scripts/build-slides.py && node scripts/slides-check.mjs   # rebuild slides + slide count
npm run dev                   # run locally at http://localhost:3000
```
