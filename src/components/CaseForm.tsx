"use client";
import { useActionState } from "react";
import { createCase, saveCaseDetails } from "@/app/actions/cases";
import type { FormState } from "@/app/actions/auth";
import { AGE_RANGES, BASELINE_DOMAINS, CARE_PHASES, CARE_SETTINGS } from "@/lib/onboarding";
import type { Baseline, PatientCase } from "@/lib/models";
import { FieldError, FormError, FormSuccess, SubmitButton, TextField } from "./forms";

function Select({
  name,
  label,
  options,
  defaultValue,
  error,
}: {
  name: string;
  label: string;
  options: readonly { id: string; label: string }[];
  defaultValue?: string | null;
  error?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={`f-${name}`}>{label}</label>
      <select id={`f-${name}`} name={name} className="select" defaultValue={defaultValue ?? ""} aria-invalid={error ? true : undefined}>
        <option value="">Not provided</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.label}
          </option>
        ))}
      </select>
      <FieldError id={`f-${name}-err`} message={error} />
    </div>
  );
}

function TextArea({ name, label, hint, defaultValue, placeholder, maxLength }: { name: string; label: string; hint?: string; defaultValue?: string | null; placeholder?: string; maxLength: number }) {
  return (
    <div className="field">
      <label htmlFor={`f-${name}`}>{label}</label>
      {hint && <p className="hint">{hint}</p>}
      <textarea id={`f-${name}`} name={name} className="textarea" defaultValue={defaultValue ?? ""} placeholder={placeholder} maxLength={maxLength} />
    </div>
  );
}

export function CaseForm({ mode, existing, baselines }: { mode: "create" | "edit"; existing?: PatientCase; baselines?: Baseline[] }) {
  const [state, action] = useActionState<FormState, FormData>(mode === "create" ? createCase : saveCaseDetails, {});
  const e = state.errors ?? {};
  const v = state.values ?? {};
  const val = (k: string, fallback?: string | null) => v[k] ?? fallback ?? "";
  const baselineFor = (id: string) => baselines?.find((b) => b.category === id)?.description ?? "";

  return (
    <form action={action} className="form card" noValidate>
      <FormError message={e.form} />
      <FormSuccess message={state.message} />
      {existing && <input type="hidden" name="caseId" value={existing.id} />}

      <fieldset>
        <legend>The fictional person</legend>
        <TextField
          name="pseudonym"
          label="Fictional name or nickname (required)"
          hint="Use a made-up name, e.g. “Grandpa J.” or “Pat (fictional)”."
          required
          maxLength={60}
          defaultValue={val("pseudonym", existing?.pseudonym)}
          error={e.pseudonym}
        />
        <div className="grid-2">
          <Select name="ageRange" label="Age range (optional)" options={AGE_RANGES} defaultValue={val("ageRange", existing?.ageRange)} />
          <div className="field">
            <label htmlFor="f-primaryCondition">Main condition (optional)</label>
            <input
              id="f-primaryCondition"
              name="primaryCondition"
              className="input"
              maxLength={80}
              placeholder="e.g. recovering from surgery"
              defaultValue={val("primaryCondition", existing?.primaryCondition === "Not sure" ? "" : existing?.primaryCondition)}
            />
            <div className="check-row">
              <input type="checkbox" id="f-conditionNotSure" name="conditionNotSure" defaultChecked={existing?.primaryCondition === "Not sure"} />
              <label htmlFor="f-conditionNotSure">Not sure</label>
            </div>
          </div>
        </div>
        <div className="grid-2">
          <Select name="carePhase" label="Care phase (optional)" options={CARE_PHASES} defaultValue={val("carePhase", existing?.carePhase)} />
          <Select name="careSetting" label="Care setting (optional)" options={CARE_SETTINGS} defaultValue={val("careSetting", existing?.careSetting)} />
        </div>
        <TextArea name="careContext" label="Care context (optional)" maxLength={1000} placeholder="A sentence or two about the situation (fictional)." defaultValue={val("careContext", existing?.careContext)} />
        <TextArea name="milestones" label="Milestones, appointments or care-plan changes (optional)" maxLength={1000} placeholder="e.g. follow-up visit next week" defaultValue={val("milestones", existing?.milestones)} />
      </fieldset>

      <fieldset>
        <legend>You, the caregiver (optional)</legend>
        <div className="grid-2">
          <TextField name="caregiverName" label="Your display name" maxLength={60} defaultValue={val("caregiverName", existing?.caregiverName)} />
          <TextField name="caregiverRelationship" label="Relationship to the person" placeholder="e.g. daughter, partner, friend" maxLength={60} defaultValue={val("caregiverRelationship", existing?.caregiverRelationship)} />
        </div>
      </fieldset>

      {mode === "create" && (
        <details>
          <summary style={{ cursor: "pointer", fontWeight: 500, color: "var(--primary)" }}>
            Add a usual baseline (optional — you can skip this)
          </summary>
          <fieldset style={{ marginTop: 12 }}>
            <legend className="sr-only">Caregiver-reported baseline</legend>
            <p className="secondary">
              What is usual for this person, in your words? Blank areas are saved as “Not provided”.
            </p>
            {BASELINE_DOMAINS.map((d) => (
              <TextArea key={d.id} name={`baseline_${d.id}`} label={d.label} maxLength={500} placeholder={d.placeholder} defaultValue={val(`baseline_${d.id}`, baselineFor(d.id))} />
            ))}
          </fieldset>
        </details>
      )}

      <SubmitButton pendingText="Saving…">{mode === "create" ? "Create case" : "Save changes"}</SubmitButton>
    </form>
  );
}
