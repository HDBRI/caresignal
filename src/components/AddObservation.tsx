"use client";
/**
 * "Add observation" — available from every case screen. Uses a native <dialog> (focus trap, Esc to close).
 * Any button with data-open-add-observation opens it. After saving, if a predefined emergency or
 * contact-care-team rule fired, an interruptive guidance panel replaces the form immediately.
 */
import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addObservationAction, type AddObservationState } from "@/app/actions/observations";
import { markSeen } from "@/app/actions/alerts";
import { SAFETY_LIMITATION } from "@/lib/safety/rules";
import { AlertIcon, CheckIcon, InfoIcon } from "./icons";
import { FormError, SubmitButton } from "./forms";

export const OPEN_EVENT = "caresignal:add-observation";

export function AddObservationButton({ label = "Add observation", className = "btn btn-primary" }: { label?: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(OPEN_EVENT))}>
      + {label}
    </button>
  );
}

export function AddObservationDialog({ caseId, pseudonym }: { caseId: string; pseudonym: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const [formKey, setFormKey] = useState(0);
  const [state, action] = useActionState<AddObservationState, FormData>(addObservationAction, {});
  const [eventLocal, setEventLocal] = useState("");
  const [maxLocal, setMaxLocal] = useState<string | undefined>(undefined);

  useEffect(() => {
    const open = () => {
      setFormKey((k) => k + 1);
      setEventLocal("");
      const now = new Date();
      setMaxLocal(new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
      ref.current?.showModal();
    };
    window.addEventListener(OPEN_EVENT, open);
    return () => window.removeEventListener(OPEN_EVENT, open);
  }, []);

  useEffect(() => {
    if (state.ok) router.refresh();
  }, [state, router]);

  const close = () => ref.current?.close();
  const saved = formKey > 0 && state.ok ? state.saved : undefined;
  const urgent = saved && (saved.tier === "emergency" || saved.tier === "contact_care_team");
  const eventIso = eventLocal ? new Date(eventLocal).toISOString() : "";

  return (
    <dialog ref={ref} className="cs-dialog" aria-labelledby="add-obs-title" onClose={() => setFormKey(0)}>
      {saved && urgent ? (
        <div role="alertdialog" aria-labelledby="urgent-title" className="form" style={{ gap: 14 }}>
          <h2
            id="urgent-title"
            style={{ display: "flex", gap: 10, alignItems: "center", color: saved.tier === "emergency" ? "var(--emergency)" : "var(--attention)", fontSize: 24 }}
          >
            <AlertIcon size={28} /> {saved.guidanceTitle}
          </h2>
          <p style={{ fontSize: 19, fontWeight: 600 }}>{saved.guidanceBody}</p>
          <blockquote className="quote">
            <span className="secondary">{saved.displayId} · your note, saved exactly as written: </span>“{saved.originalText}”
          </blockquote>
          <p className="secondary">
            Prototype rule{saved.ruleLabels.length > 1 ? "s" : ""} that fired: {saved.ruleLabels.join(", ")} (matched “{saved.matched.join("”, “")}”).{" "}
            {SAFETY_LIMITATION}
          </p>
          <p className="secondary">This notice also stays at the top of every screen until you mark it as seen.</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {saved.alertId && (
              <form action={markSeen} onSubmit={() => setTimeout(close, 50)}>
                <input type="hidden" name="alertId" value={saved.alertId} />
                <input type="hidden" name="caseId" value={caseId} />
                <button className="btn btn-primary" type="submit">
                  I&apos;ve seen this
                </button>
              </form>
            )}
            <button className="btn btn-secondary" type="button" onClick={close}>
              Close (keep the notice showing)
            </button>
          </div>
        </div>
      ) : saved ? (
        <div className="form" style={{ gap: 12 }}>
          <h2 id="add-obs-title" style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <CheckIcon size={22} /> Observation saved
          </h2>
          <p>
            Saved as <strong>{saved.displayId}</strong>, exactly as you wrote it.
          </p>
          {saved.tier === "review" && (
            <p className="pill pill-attention" style={{ alignSelf: "flex-start" }}>
              <AlertIcon size={14} /> Marked “please review” by a prototype rule ({saved.ruleLabels.join(", ")})
            </p>
          )}
          {!saved.tier && <p className="secondary">No predefined safety rule matched — this does not mean the situation is safe.</p>}
          <p className="secondary" style={{ display: "flex", gap: 6 }}>
            <InfoIcon size={15} /> {saved.aiMessage}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary" type="button" onClick={() => setFormKey((k) => k + 1)}>
              Add another
            </button>
            <button className="btn btn-secondary" type="button" onClick={close}>
              Done
            </button>
          </div>
        </div>
      ) : (
        <form key={formKey} action={action} className="form">
          <h2 id="add-obs-title">Add an observation</h2>
          <p className="secondary">
            For <strong>{pseudonym}</strong> (fictional). Write it in your own words — it will be saved exactly as typed. No
            category needed, no limit on how many notes you add.
          </p>
          <FormError message={formKey > 0 ? state.error : undefined} />
          <input type="hidden" name="caseId" value={caseId} />
          <div className="field">
            <label htmlFor="obs-text">What did you notice?</label>
            <p id="obs-text-hint" className="hint">
              Examples: “Ate half his lunch and said he wasn’t hungry.” · “Needed help getting up the stairs this afternoon.” ·
              “Seemed more confused than usual after his nap.”
            </p>
            <textarea
              id="obs-text"
              name="text"
              className="textarea"
              style={{ minHeight: 140 }}
              maxLength={4000}
              required
              autoFocus
              aria-describedby="obs-text-hint obs-privacy"
            />
          </div>
          <div className="field">
            <label htmlFor="obs-author">Who noticed this? (optional)</label>
            <input
              id="obs-author"
              name="authorLabel"
              className="input"
              maxLength={60}
              placeholder="e.g. Me, a family member, the visiting nurse (as told to me)"
            />
          </div>
          <div className="field">
            <label htmlFor="obs-when">When did this happen? (optional)</label>
            <p className="hint">Leave blank if you&apos;re not sure — we&apos;ll record it as “not provided”, never guess.</p>
            <input
              id="obs-when"
              type="datetime-local"
              className="input"
              value={eventLocal}
              max={maxLocal}
              onChange={(e) => setEventLocal(e.target.value)}
            />
            <input type="hidden" name="eventTimeIso" value={eventIso} />
          </div>
          <p id="obs-privacy" className="secondary">
            Classroom demo: use fictional details only — no real names, dates of birth, addresses, phone numbers or medical record
            numbers. In an emergency, call 911 — don&apos;t wait to log it here.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <SubmitButton pendingText="Saving…">Save observation</SubmitButton>
            <button className="btn btn-secondary" type="button" onClick={close}>
              Cancel
            </button>
          </div>
        </form>
      )}
    </dialog>
  );
}
