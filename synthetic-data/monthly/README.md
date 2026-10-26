# CareSignal synthetic monthly dataset

**All data is fictional and for classroom demonstration only. Not clinical data, a care protocol, or validated clinical decision support.**

Window: 2026-09-26 through 2026-10-25 inclusive.

- Jordan Lee: fictional active cancer treatment; repeated fatigue, variable/reduced intake, new need for dressing help, and a documented fictional treatment visit for temporal comparison only.
- Morgan Patel: fictional post-operative recovery; variable but generally improving function; sudden confusion plus difficulty waking is an emergency-rule test and must trigger immediately, independent of AI.
- Alex Rivera: fictional gradual recovery; fluctuating activity, uncertain event timing, conflicting reports, and a missing check-in.

Files:
- `caresignal_monthly_synthetic_dataset.json`: canonical dataset.
- `observations.csv`: observation rows.
- `profiles_and_timeline.json`: profile baselines, fictional timeline events and check-ins.
- `CLAUDE_IMPORT_PROMPT.txt`: Claude Code import instructions.

Keep original notes verbatim; stable IDs are for internal traceability and should not clutter the caregiver UI. Missing check-in or absent symptom mention means unknown, not well. Do not infer causation, diagnose, recommend treatment, fabricate numeric severity, or treat note counts as symptom severity. Existing deterministic safety logic must inspect the actual note, not trust a seed label. Import must be idempotent and must not trigger bulk AI calls or invalidate prior token/cost measurements.
