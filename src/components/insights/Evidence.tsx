"use client";
/**
 * Evidence drawer: opens the ORIGINAL caregiver notes behind any number, finding or AI statement.
 * Native <dialog> (focus trapped, Esc closes); focus returns to the button that opened it.
 * Only notes already loaded for this authorized case are shown — nothing is fetched by ID from the client.
 */
import Link from "next/link";
import { createContext, useCallback, useContext, useRef, useState } from "react";
import { categoryLabel } from "@/lib/categories";
import { fmtShortDay, type DashboardObservation } from "@/lib/dashboard";

type Open = (title: string, ids: string[], context?: string) => void;
const Ctx = createContext<Open>(() => {});

const TIER: Record<string, { text: string; cls: string }> = {
  emergency: { text: "Matched an emergency safety rule", cls: "pill-emergency" },
  contact_care_team: { text: "Matched a contact-the-care-team rule", cls: "pill-attention" },
  review: { text: "Flagged for review by a safety rule", cls: "pill-attention" },
};

const fmtWhen = (iso: string) =>
  new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(iso));

export function EvidenceProvider({
  caseId,
  observations,
  children,
}: {
  caseId: string;
  observations: Record<string, DashboardObservation>;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [state, setState] = useState<{ title: string; ids: string[]; context?: string }>({ title: "", ids: [] });

  const open = useCallback<Open>((title, ids, context) => {
    opener.current = document.activeElement as HTMLElement | null;
    setState({ title, ids, context });
    ref.current?.showModal();
  }, []);

  const notes = state.ids.map((id) => observations[id]).filter((o): o is DashboardObservation => Boolean(o));
  const missing = state.ids.length - notes.length;

  return (
    <Ctx.Provider value={open}>
      {children}
      <dialog
        ref={ref}
        className="cs-dialog evidence-drawer"
        aria-labelledby="evidence-title"
        onClose={() => opener.current?.focus()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
          <div>
            <h2 id="evidence-title" style={{ fontSize: 20 }}>
              {state.title}
            </h2>
            <p className="secondary">
              {notes.length} supporting observation{notes.length === 1 ? "" : "s"} · original caregiver notes, unchanged
              {state.context ? ` · ${state.context}` : ""}
            </p>
          </div>
          <button type="button" className="btn btn-secondary" onClick={() => ref.current?.close()} autoFocus>
            Close
          </button>
        </div>
        {missing > 0 && <p className="secondary">{missing} referenced note(s) are not available in this case and are not shown.</p>}
        <ol className="list-plain" style={{ marginTop: 12 }}>
          {notes.map((o) => (
            <li key={o.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <p className="meta">
                <strong style={{ color: "var(--text)" }}>{fmtShortDay(o.day)}</strong>
                <span>{o.eventTime ? `happened ${fmtWhen(o.eventTime)}` : "time it happened not provided"}</span>
                <span>· logged {fmtWhen(o.enteredAt)}</span>
                {o.author && <span>· by {o.author}</span>}
              </p>
              <blockquote className="quote">“{o.text}”</blockquote>
              {o.editedText && <p className="secondary">Corrected wording (newer version): “{o.editedText}”</p>}
              <div className="chip-row">
                {o.categories.length ? (
                  o.categories.map((c) => (
                    <span key={c} className="chip">
                      {categoryLabel(c)}
                    </span>
                  ))
                ) : (
                  <span className="pill pill-unknown">Not yet categorized</span>
                )}
                {o.categorySource === "caregiver" && <span className="secondary">categories set by caregiver</span>}
                {o.categorySource === "scenario" && <span className="secondary">categories from the synthetic scenario dataset</span>}
                {TIER[o.safetyTier] && (
                  <span className={`pill ${TIER[o.safetyTier].cls}`}>
                    {TIER[o.safetyTier].text}
                    {o.alertUnseen ? " · not yet marked seen" : ""}
                  </span>
                )}
                {o.origin === "seeded" && <span className="pill pill-unknown">Synthetic example</span>}
              </div>
              <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
                <Link href={`/cases/${caseId}/observations/${o.displayId}`}>Open the full record</Link>
                <details>
                  <summary className="muted-link" style={{ cursor: "pointer" }}>
                    Technical details
                  </summary>
                  <code className="cred">{o.displayId}</code>
                </details>
              </div>
            </li>
          ))}
        </ol>
      </dialog>
    </Ctx.Provider>
  );
}

/** "Review supporting notes (3)" — opens the drawer with exactly these notes. */
export function EvidenceButton({
  ids,
  title,
  label,
  context,
  className = "btn btn-ghost evidence-btn",
}: {
  ids: string[];
  title: string;
  label?: string;
  context?: string;
  className?: string;
}) {
  const open = useContext(Ctx);
  if (ids.length === 0) return null;
  return (
    <button type="button" className={className} onClick={() => open(title, ids, context)}>
      {label ?? `Review supporting notes (${ids.length})`}
    </button>
  );
}

export function useEvidence() {
  return useContext(Ctx);
}
