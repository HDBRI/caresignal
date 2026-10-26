# CareSignal — evidence for "What is new here?" and "Impact"

Prepared 2026-10-26 for the MGT 409 final report. External sources were accessed on **2026-10-26**; every external claim below is limited to what the cited page says. Prototype numbers come from this repository's own synthetic evaluation (`docs/EVALUATION.md`, `docs/evaluation/results.json`, run 2026-10-26, expectations committed in `48c0aaf` before the run) and safety evaluation (`docs/SAFETY_EVALUATION.md`).

> **Scope of the evidence.** No user research, interviews, usability sessions or clinical studies were conducted. All prototype results are from **synthetic data written by the developer**. Nothing here shows real patient benefit, clinical effectiveness or real-world safety.

---

## 1. The gap CareSignal is designed for

**Context (cited).**
- About **63 million** U.S. adults (one in four) were family caregivers in *Caregiving in the US 2025*; over 40% provide high-intensity care, and only **22%** report having received training. (AARP & National Alliance for Caregiving, published 2025-07-24 [S1].)
- Handoffs — transfers of information and responsibility — "have been linked to adverse clinical events", and structured handoff tools exist for clinicians: **I-PASS** (illness severity, patient summary, action list, situation awareness, synthesis by receiver) has the strongest evidence as a *bundle*; **SBAR** evidence is mixed. (AHRQ PSNet primer on handoffs, last reviewed 2024 [S2].)

**The gap (our framing, not a cited finding).** Family caregivers observe change at home in their own words, often across several people and days, but the tools reviewed below either *store* those words (journals, trackers), *carry messages* to a clinic (portals), or *answer questions* (chatbots). We did not find, among the small set reviewed, a tool that describes doing all of the following together:

1. turning scattered free-text caregiver notes into a **caregiver-reviewed handoff** for a care team,
2. where **every AI statement links to the exact source notes** (and is removed if it can't),
3. where **uncertainty, conflicting reports and missing information are kept** rather than smoothed over, and
4. where **urgent-safety guidance comes from fixed rules that run before and independently of AI**.

This is a statement about the products and pages we checked, **not** evidence that no such tool exists. We make no "first" or "only" claim.

---

## 2. Comparison with existing tool categories

"Not described" means the cited page we reviewed did not describe it — not that the product lacks it.

| Category | Example reviewed | What the cited source describes | Not described on the reviewed page | How CareSignal differs (prototype) |
|---|---|---|---|---|
| Patient portal | **Epic MyChart** [S3] | View medications, test results, bills; "Manage care for you and your family"; connect with a doctor virtually; one login across organizations. | Turning caregiver observations into a structured summary; AI features. | Not a portal and not connected to any EHR. Focuses on the step *before* messaging a care team: organizing home observations into a reviewed, source-linked handoff (sent only to a simulated receiver). |
| Symptom / mood tracker | **Bearable** (App Store listing) [S4] | Customizable tracking of symptoms, mood, sleep, medication, habits; shows "correlations between your symptoms and your sleep, food, weather, stress, medication and habits"; export; reminders; Apple Health / Fitbit sync. | AI features; caregiver-to-care-team handoff. | Free-text notes in the caregiver's words instead of structured scales; no correlation or severity scores; counts are labeled as recording activity, not health. |
| Caregiver journal / support site | **CaringBridge** [S5] | Share health updates with friends and family; comments; meal and care calendars; free; nonprofit; "private, protected, and ad-free". | Clinician handoffs, structured symptom tracking, AI. | Audience is a (simulated) care team, not a friends-and-family circle; content is organized and evidence-linked rather than broadcast. |
| Caregiver coordination app with AI | **Caring Village** [S6] | Shared calendar, medication reminders, **wellness journal** for recording updates and symptoms (paraphrased from the page), private messaging, document storage, and an **AI assistant ("Julia")** offering "personalized insights". | Sharing with clinicians/providers. | Shows that caregiver journals with AI already exist. CareSignal's difference is narrower: source-quoted AI output with automatic removal of unsupported statements, preserved conflicts/unknowns, rule-based urgent guidance independent of AI, and a frozen, caregiver-approved handoff snapshot. |
| General-purpose AI chatbot | **ChatGPT Health** (announced Jan 2026) [S7] | A health space in ChatGPT; users can connect medical records (via b.well) and wellness apps; OpenAI says it is "not intended for diagnosis or treatment"; health conversations stored separately and not used to train foundation models. | Caregiver-to-care-team handoff workflow; citation of exact source notes for every statement. | CareSignal is a narrow, single-purpose workflow with deterministic checks on every AI statement; it does not answer open health questions. |
| Clinical handoff standard (method, not product) | **I-PASS / SBAR** [S2] | Structured verbal/written handoff formats for clinicians; I-PASS bundle reduced preventable adverse events in a teaching hospital. | Use by family caregivers. | CareSignal **borrows** the idea of a structured handoff (summary, supported items, uncertainty, questions), adapted for caregivers; it is not an implementation of I-PASS or SBAR, and its simulated "acknowledgement" is not I-PASS receiver synthesis. |

---

## 3. What is genuinely new in this prototype — and what is standard or borrowed

**New in this prototype (design choices, verified by tests in this repo):**
- **Evidence gate on every AI statement.** Each statement must cite stored notes from the same patient and quote them exactly; statements with invented numbers, dates, trends, conditions, medication advice or safety claims are removed before storage (`src/lib/ai/guards.ts`, `insights.ts`; deterministic case DET-GUARDS 7/7).
- **Urgent guidance independent of AI.** Fixed rules run on the original note in the same database transaction that saves it, before any AI call; the urgent demo scenario triggers with no API key, a timeout, or malformed AI output (`tests/safety-layer.test.ts`; DET-AI-UNAVAILABLE/TIMEOUT/MALFORMED).
- **Uncertainty as content, not noise.** Conflicting reports are kept as an explicit "conflict" item citing both notes; "not reported" is never shown as "fine"; period comparisons are refused when data are sparse.
- **Caregiver-reviewed, frozen handoff.** Nothing is sent automatically; approval freezes an exact text snapshot with a SHA-256 fingerprint; the receiver stores the same bytes; edits create a new version.
- **Honest measurement built in.** Every AI request is logged with provider-reported tokens by task; costs are never invented.

**Standard or borrowed (not novel):**
- LLM summarization and JSON-schema output validation; keyword/phrase-based safety rules with negation handling; structured handoff idea (SBAR / I-PASS); symptom journaling and category tagging; patient-portal-style messaging concept; Postgres row-level security, idempotency keys, receipts and status histories; accessibility practices (WCAG checks with axe-core).

The novelty is the **combination and the strictness of the rules**, not any single technique.

---

## 4. Impact framework

### 4a. Intended impact (what the product is *for*; not demonstrated)
Help a family caregiver bring a clear, honest, source-linked summary of home observations to a care conversation — with conflicts and gaps visible and urgent concerns routed to immediate guidance rather than a weekly report.

### 4b. Indicators, prototype evidence and status

| Indicator | Definition | Prototype evidence (synthetic; n; method) | Status |
|---|---|---|---|
| Source traceability | Share of displayed AI statements that cite existing notes of the same patient with exact quotes | Enforced by validation for every stored statement; guard test removed 7/7 seeded bad statements (DET-GUARDS); in the live run 1 insight statement was removed (unsupported condition) | **Measured** (deterministic + 1 live run) |
| Key-fact preservation | Expected key phrases quoted exactly in extracted facts | **50/50** key facts across 31 categorization cases (live run, gpt-6-luna, 2026-10-26) | **Measured**, strict definition, one run |
| Categorization accuracy | Primary category exact match | **25/31 (81%)**; secondary micro precision 10/14, recall 10/16 | **Measured**, developer-defined labels |
| Uncertainty / conflict retention | Conflict kept as one item citing both notes; unknowns listed | Recovery case conflict kept (1/1); 3/3 case-level insight runs met their expectations | **Measured**, n = 3 cases |
| Safe handling of predefined urgent scenarios | Expected rule level fires on the original note, independent of AI | **46/49** alert phrases caught (3 documented misses); **2/41** false positives; urgent demo triggers with no key / timeout / malformed output (3/3) | **Measured** on a small predefined set |
| Prompt-injection resistance | Notes cannot disable rules; no secrets or fabricated sources in output | 5/5 rule-level injection notes; 4/4 model-based injection cases | **Measured**, small set |
| Caregiver review before sending | Handoffs submitted only after explicit approval | Enforced: submitting an unapproved draft is refused (409) (DET-HANDOFF-APPROVAL) | **Design property verified**; real completion rates not measured |
| Delivery integrity | Exact approved bytes received; no duplicates; failures marked Failed | 5/5 delivery cases (receipt, duplicate, failure, acknowledgement, persistence) | **Measured** (deterministic) |
| Time to assemble a handoff | Caregiver minutes from notes to approved handoff | — | **Not measured.** Proposed: timed task with synthetic cases, manual summary vs CareSignal, ≥ 5 participants, report median and range |
| Caregiver-perceived usefulness / burden | Survey or interview | — | **Not measured.** No user research was conducted |
| Cost per handoff | Provider-reported tokens per insight call | Mean 1,050 input / 2,326 output tokens per insight call (n = 4); cost **not returned by provider**; illustrative estimate in `docs/TOKENOMICS.md` | Tokens **measured**; cost **illustrative only** |

### 4c. Future hypotheses (to test, not claims)
- H1: Caregivers assemble a handoff faster with CareSignal than by hand, without losing key facts.
- H2: Care teams find source-linked handoffs easier to verify than free-text messages.
- H3: Explicitly preserved conflicts and gaps lead to more targeted clarifying questions.
- H4: Rule-based urgent guidance is noticed and acted on more reliably when it is separate from AI summaries.
Each would need real (consented) users, ethics review, and — for anything clinical — clinician involvement.

---

## 5. Limitations

- **Narrow deterministic safety coverage:** a small predefined phrase set; 3 known misses and 2 known false positives on the developer's own test set; no alert does not mean safe.
- **Synthetic-only data:** three fictional cases and developer-written evaluation notes; no real caregiver language.
- **No clinical validation:** labels and expectations are the developer's, not clinicians'.
- **No real EHR or care-team integration:** the receiver is simulated; nothing reaches a real clinic.
- **Dependence on model/API availability:** AI features stop when the key, provider or daily cap is unavailable (notes, charts and safety rules continue).
- **Possible model errors:** 6/40 live model cases failed; outputs vary between runs; validation removes some but not all errors (e.g., wrong category choices are not caught).
- **Small evaluation set and single run:** tens of cases, one live run; no confidence intervals; results may not reproduce exactly.
- **No user research:** usefulness, time savings and burden are untested.
- **Comparison is limited:** six examples, checked from public pages on one date; features described elsewhere or added later were not captured.

---

## Sources (accessed 2026-10-26)

- [S1] AARP & National Alliance for Caregiving, *Caregiving in the US 2025* — key findings page (published 2025-07-24): https://www.aarp.org/pri/topics/ltss/family-caregiving/caregiving-in-the-us-2025/ ; press release: https://www.aarp.org/press/releases/2025-07-24-new-report-reveals-crisis-point-for-americas-63-million-family-caregivers.html
- [S2] AHRQ Patient Safety Network, "Handoffs and Signouts" primer (last reviewed 2024): https://psnet.ahrq.gov/primer/handoffs
- [S3] Epic, MyChart homepage: https://www.mychart.org/
- [S4] Bearable – Symptom Tracker, Apple App Store listing: https://apps.apple.com/app/bearable/id1482581097
- [S5] CaringBridge, "Join" page: https://join.caringbridge.org/
- [S6] Caring Village homepage: https://caringvillage.com/
- [S7] HLTH, "OpenAI launches ChatGPT Health with b.well to connect medical records and wellness apps" (2026-01-08): https://hlth.com/insights/news/openai-launches-chatgpt-health-with-b-well-to-connect-medical-records-and-wellness-apps-2026-01-08 — OpenAI's own page (https://openai.com/index/health-in-chatgpt/) returned HTTP 403 to automated access and was not read directly.

Internal evidence: `docs/EVALUATION.md`, `docs/evaluation/results.json`, `docs/SAFETY_EVALUATION.md`, `docs/TOKENOMICS.md`, `synthetic-data/evaluation/eval-suite.json`.
