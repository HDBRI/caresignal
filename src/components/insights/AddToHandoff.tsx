"use client";
import Link from "next/link";
import { useActionState } from "react";
import { addFindingToHandoffAction, type HandoffFormState } from "@/app/actions/handoffs";
import { SubmitButton } from "../forms";

export interface HandoffFinding {
  statement: string;
  support: "supported" | "possible_unconfirmed" | "conflicting" | "unknown";
  kind: "pattern" | "change" | "possible_pattern" | "conflict" | "recording_activity";
  uncertainty?: string | null;
  sourceIds: string[];
}

/**
 * "Add to this week's handoff" — the caregiver's explicit choice. Appends to the open draft (no AI call, never sent).
 * Shown only when an open draft exists and every supporting note is inside that draft's period.
 */
export function AddToHandoff({ caseId, finding, draft }: { caseId: string; finding: HandoffFinding; draft: { displayId: string; sourceIds: string[] } | null }) {
  const [state, action] = useActionState<HandoffFormState, FormData>(addFindingToHandoffAction, {});
  if (!draft) return null;
  if (!finding.sourceIds.every((id) => draft.sourceIds.includes(id))) {
    return <span className="secondary">Notes outside this week&apos;s handoff period — can&apos;t be added.</span>;
  }
  if (state.ok) {
    return (
      <span className="secondary" role="status">
        {state.ok} <Link href={`/cases/${caseId}/handoffs/${draft.displayId}`}>Open the draft</Link>
      </span>
    );
  }
  return (
    <form action={action} style={{ display: "inline-flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="finding" value={JSON.stringify(finding)} />
      <SubmitButton pendingText="Adding…" className="btn btn-ghost evidence-btn">
        Add to this week&apos;s handoff
      </SubmitButton>
      {state.error && (
        <span className="field-error" role="alert">
          {state.error}
        </span>
      )}
    </form>
  );
}
