# CareSignal synthetic data package

**Everything in this folder is fictional.** No real people, patients, records, clinicians or organizations. These are classroom demonstration scenarios — not validated medical scenarios and not clinical guidance. Every patient, observation, check-in, handoff and receiver response carries `"synthetic": true`.

This folder is data only. The app loads and validates it through `src/lib/fixtures.ts`; it is kept separate from application code so it can be reviewed on its own.

## Contents

| File | What it is |
|---|---|
| `cases/case-1-cancer.json` | `PAT-CANCER-001` Jordan Lee — cancer treatment at home; multi-day pattern; fictional clinician response |
| `cases/case-2-surgery.json` | `PAT-SURGERY-002` Morgan Patel — post-surgery; predefined urgent test scenario (`OBS-C2-08`) |
| `cases/case-3-recovery.json` | `PAT-RECOVERY-003` Alex Rivera — gradual change; conflicting meal reports; missing context |
| `evaluation/evaluation-cases.json` | Evaluation cases with expected outcomes (incl. prompt-injection and medication-causality bait) |

25 seeded observations across the three cases cover all seven categories (eating & drinking, energy & sleep, mobility & daily function, symptoms & comfort, mood & thinking, medications & treatment, care coordination).

| Note type | Examples |
|---|---|
| Ordinary | `OBS-C1-01`, `OBS-C2-03`, `OBS-C3-01` |
| Multi-category | `OBS-C1-02`, `OBS-C1-03`, `OBS-C1-06` |
| Ambiguous | `OBS-C1-07` (not sure whether evening medicines were taken) |
| Conflicting reports | `OBS-C3-06` vs `OBS-C3-07` (two family members) |
| Missing context | `OBS-C3-07` (which dinner?), `OBS-C1-04` (no event time) |
| Missing day | Case 1, day −2 (no note → "not reported") |
| Routine safety examples | `OBS-C2-02` (no rule), `OBS-C2-04` (review), `OBS-C1-07` (review) |
| Predefined urgent scenario | `OBS-C2-08` (`isTestScenario: true`) |
| Prompt injection | `EVAL-INJECT-01`, `EVAL-INJECT-02` (evaluation set; can also be typed into any case) |

## Timestamps

Fixture times are written as `{ "dayOffset": -3, "time": "18:45" }`: days before the seed anchor, and wall-clock time in `America/New_York`. When a case is seeded or reset, one **anchor** (the current time) is captured and every time in that copy is resolved from it, so:

- the week view is always populated whenever the demo is opened;
- all times in one copy are consistent with each other and reproducible from the anchor;
- **resetting or reseeding regenerates the dates relative to the new anchor** (the gaps between notes stay the same).

All seeded notes have `dayOffset <= -1`, so none are in the future. `eventTime: null` means the caregiver did not say when it happened — it is stored as "not provided", never guessed.

## Seeded handoffs

The example handoffs in each case are marked `"draftedBy": "seed_fixture"` — they were written for the scenario, not generated live by AI, and the app labels them that way. Case 1's handoff has been received and acknowledged and has a **fictional clinician response** ("In this fictional scenario, the care team reviewed the handoff and adjusted the plan."), labeled *Simulated scenario outcome — not an AI recommendation or a real clinical event.* Case 2's handoff is a draft (never sent automatically). Case 3's is reviewed and ready to submit.
