"use client";
import { useActionState } from "react";
import {
  approveHandoffAction,
  draftHandoffAction,
  editHandoffAction,
  submitHandoffAction,
  type HandoffFormState,
} from "@/app/actions/handoffs";
import type { HandoffContent } from "@/lib/models";
import { FormError, FormSuccess, SubmitButton } from "../forms";
import { AlertIcon } from "../icons";

export function DraftButton({ caseId, label, secondary }: { caseId: string; label: string; secondary?: boolean }) {
  const [state, action] = useActionState<HandoffFormState, FormData>(draftHandoffAction, {});
  return (
    <form action={action} className="form" style={{ gap: 8 }}>
      <input type="hidden" name="caseId" value={caseId} />
      <FormError message={state.error} />
      <div>
        <SubmitButton pendingText="Drafting from your notes… (up to a minute)" className={`btn ${secondary ? "btn-secondary" : "btn-primary"}`}>
          {label}
        </SubmitButton>
      </div>
    </form>
  );
}

function SafetyNotice({ s }: { s: NonNullable<HandoffFormState["safety"]> }) {
  return (
    <div role="alert" className={`safety-banner ${s.tier === "emergency" ? "safety-emergency" : "safety-contact"}`}>
      <h3 className="safety-title">
        <AlertIcon size={22} /> {s.title}
      </h3>
      <p className={s.tier === "emergency" ? "safety-instruction" : undefined}>{s.body}</p>
      <p className="secondary">
        About the text you just typed into the handoff. {s.why} Don&apos;t wait for this weekly handoff — add it as an observation so it stays
        visible. Limited prototype rules; no alert would not mean the situation is safe.
      </p>
    </div>
  );
}

/** Caregiver edits: wording only. Sources stay attached to each statement and can't be changed here. */
export function EditForm({ caseId, handoffId, draft }: { caseId: string; handoffId: string; draft: HandoffContent }) {
  const [state, action] = useActionState<HandoffFormState, FormData>(editHandoffAction, {});
  return (
    <form action={action} className="form" style={{ gap: 14 }}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="handoffId" value={handoffId} />
      <input type="hidden" name="itemCount" value={draft.items.length} />
      <input type="hidden" name="questionCount" value={draft.questions.length} />
      <FormError message={state.error} />
      <FormSuccess message={state.ok} />
      {state.safety && <SafetyNotice s={state.safety} />}
      <div className="field">
        <label htmlFor="edit-summary">Summary</label>
        <textarea id="edit-summary" name="summary" className="textarea" defaultValue={draft.summary} maxLength={2000} required />
      </div>
      {draft.items.map((it, i) => (
        <div className="field" key={`${i}-${it.statement.slice(0, 20)}`}>
          <label htmlFor={`edit-item-${i}`}>
            Statement {i + 1} <span className="secondary">· sources {it.sourceIds.join(", ")} (kept)</span>
          </label>
          <textarea id={`edit-item-${i}`} name={`item-${i}`} className="textarea" style={{ minHeight: 64 }} defaultValue={it.statement} maxLength={800} />
          <div className="check-row">
            <input type="checkbox" id={`edit-item-${i}-remove`} name={`item-${i}-remove`} />
            <label htmlFor={`edit-item-${i}-remove`}>Remove this statement from the handoff</label>
          </div>
        </div>
      ))}
      {draft.questions.map((q, i) => (
        <div className="field" key={`q-${i}-${q.text.slice(0, 20)}`}>
          <label htmlFor={`edit-question-${i}`}>Question {i + 1}</label>
          <input id={`edit-question-${i}`} name={`question-${i}`} className="input" defaultValue={q.text} maxLength={400} />
          <div className="check-row">
            <input type="checkbox" id={`edit-question-${i}-remove`} name={`question-${i}-remove`} />
            <label htmlFor={`edit-question-${i}-remove`}>Remove this question</label>
          </div>
        </div>
      ))}
      <div className="field">
        <label htmlFor="edit-new-questions">Add your own questions (one per line, up to 5)</label>
        <textarea id="edit-new-questions" name="newQuestions" className="textarea" style={{ minHeight: 64 }} />
      </div>
      <div className="field">
        <label htmlFor="edit-missing">Missing or unknown information (one per line)</label>
        <textarea id="edit-missing" name="missingInfo" className="textarea" defaultValue={draft.missingInfo.join("\n")} />
      </div>
      <div>
        <SubmitButton pendingText="Saving…" className="btn btn-secondary">
          Save edits
        </SubmitButton>
      </div>
    </form>
  );
}

export function ApproveForm({ caseId, handoffId }: { caseId: string; handoffId: string }) {
  const [state, action] = useActionState<HandoffFormState, FormData>(approveHandoffAction, {});
  return (
    <form action={action} className="form" style={{ gap: 10 }}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="handoffId" value={handoffId} />
      <FormError message={state.error} />
      <FormSuccess message={state.ok} />
      <div className="check-row">
        <input type="checkbox" id="confirm-reviewed" name="confirmReviewed" required />
        <label htmlFor="confirm-reviewed">I have read this draft and checked it against the source notes.</label>
      </div>
      <div>
        <SubmitButton pendingText="Approving…" className="btn btn-primary">
          Approve handoff (does not send it)
        </SubmitButton>
      </div>
    </form>
  );
}

export function SubmitForm({ caseId, handoffId, displayId, idempotencyKey }: { caseId: string; handoffId: string; displayId: string; idempotencyKey: string }) {
  const [state, action] = useActionState<HandoffFormState, FormData>(submitHandoffAction, {});
  return (
    <form action={action} className="form" style={{ gap: 10 }}>
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="handoffId" value={handoffId} />
      <input type="hidden" name="displayId" value={displayId} />
      <input type="hidden" name="idempotencyKey" value={idempotencyKey} />
      <FormError message={state.error} />
      <p className="secondary">Submitting sends the approved version to the simulated receiver in this demo. No real care team is contacted.</p>
      <div>
        <SubmitButton pendingText="Submitting…" className="btn btn-primary">
          Submit to the simulated receiver
        </SubmitButton>
      </div>
    </form>
  );
}
