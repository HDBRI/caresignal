"use client";
import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { correctCategoriesAction, editObservationAction, type SimpleState } from "@/app/actions/observations";
import { CATEGORIES } from "@/lib/categories";
import { FormError, FormSuccess, SubmitButton } from "./forms";

/** While any note is "pending", re-check every 3 s (up to ~90 s). Stops as soon as nothing is pending. */
export function AutoRefreshWhilePending({ pending }: { pending: boolean }) {
  const router = useRouter();
  const ticks = useRef(0);
  useEffect(() => {
    if (!pending) {
      ticks.current = 0;
      return;
    }
    const id = setInterval(() => {
      ticks.current += 1;
      if (ticks.current > 30) clearInterval(id);
      else router.refresh();
    }, 3000);
    return () => clearInterval(id);
  }, [pending, router]);
  return pending ? (
    <p className="sr-only" role="status">
      AI categorization in progress. This page updates automatically.
    </p>
  ) : null;
}

export function CategoryCorrectionForm({
  caseId,
  observationId,
  primary,
  secondary,
}: {
  caseId: string;
  observationId: string;
  primary: string | null;
  secondary: string[];
}) {
  const [state, action] = useActionState<SimpleState, FormData>(correctCategoriesAction, {});
  return (
    <form action={action} className="form" style={{ gap: 10 }}>
      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="observationId" value={observationId} />
      <fieldset>
        <legend style={{ fontSize: 15 }}>Main category</legend>
        <div className="radio-row">
          {CATEGORIES.map((c) => (
            <label key={c.id}>
              <input type="radio" name="primary" value={c.id} defaultChecked={primary === c.id} required /> {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend style={{ fontSize: 15 }}>Also about (optional)</legend>
        <div className="radio-row">
          {CATEGORIES.map((c) => (
            <label key={c.id}>
              <input type="checkbox" name="secondary" value={c.id} defaultChecked={secondary.includes(c.id)} /> {c.label}
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <SubmitButton pendingText="Saving…" className="btn btn-secondary">
          Save my categories
        </SubmitButton>
      </div>
    </form>
  );
}

export function EditWordingForm({ caseId, observationId, current }: { caseId: string; observationId: string; current: string }) {
  const [state, action] = useActionState<SimpleState, FormData>(editObservationAction, {});
  return (
    <form action={action} className="form" style={{ gap: 10 }}>
      <FormError message={state.error} />
      <FormSuccess message={state.message} />
      <input type="hidden" name="caseId" value={caseId} />
      <input type="hidden" name="observationId" value={observationId} />
      <div className="field">
        <label htmlFor="edit-text">Corrected wording</label>
        <p className="hint">Saved as a new version with its own time. Version 1 (the original) is kept and stays visible.</p>
        <textarea id="edit-text" name="text" className="textarea" defaultValue={current} maxLength={4000} />
      </div>
      <div>
        <SubmitButton pendingText="Saving…" className="btn btn-secondary">
          Save as new version
        </SubmitButton>
      </div>
    </form>
  );
}
