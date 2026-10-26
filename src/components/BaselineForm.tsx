"use client";
import { useActionState } from "react";
import { saveBaselineAction } from "@/app/actions/cases";
import type { FormState } from "@/app/actions/auth";
import { BASELINE_DOMAINS } from "@/lib/onboarding";
import { FormSuccess, SubmitButton } from "./forms";

export function BaselineForm({ caseId, values }: { caseId: string; values: Record<string, string> }) {
  const [state, action] = useActionState<FormState, FormData>(saveBaselineAction, {});
  return (
    <form action={action} className="form card">
      <FormSuccess message={state.message} />
      <input type="hidden" name="caseId" value={caseId} />
      <p className="secondary">What is usual for this person, in your words? Leave an area blank if you don&apos;t know — it will show as “Not provided”.</p>
      {BASELINE_DOMAINS.map((d) => (
        <div className="field" key={d.id}>
          <label htmlFor={`b-${d.id}`}>{d.label}</label>
          <textarea id={`b-${d.id}`} name={`baseline_${d.id}`} className="textarea" style={{ minHeight: 60 }} maxLength={500} defaultValue={values[d.id] ?? ""} placeholder={d.placeholder} />
        </div>
      ))}
      <div>
        <SubmitButton pendingText="Saving…">Save baseline</SubmitButton>
      </div>
    </form>
  );
}
