import Link from "next/link";
import { handoffCategoryLabel } from "@/lib/ai/handoff";
import type { Handoff, HandoffItem, HandoffStatus, HandoffStatusEvent, Observation } from "@/lib/models";
import { localDate } from "@/lib/time";
import { fmtDateTime, fmtDay } from "../display";
import { AlertIcon, CheckIcon, InfoIcon } from "../icons";

export const RECEIVER_BANNER = "Simulated receiver — no real care team is connected.";

/** Plain status words. "Received"/"Acknowledged" belong to the SIMULATED receiver; no clinician acts here. */
export const HANDOFF_STATUS: Record<HandoffStatus, string> = {
  draft: "Draft — not sent",
  reviewed: "Reviewed and approved by you — not sent yet",
  submitted: "Submitted — waiting for the simulated receiver to confirm",
  received: "Received — saved by the simulated receiver",
  acknowledged: "Acknowledged in the simulated receiver (no clinician acted)",
  failed: "Failed — nothing was received; safe to retry",
};

/** Six visually distinct statuses: each has its own shape/glyph AND word, not color alone. */
const BADGE: Record<HandoffStatus, { label: string; glyph: string }> = {
  draft: { label: "Draft", glyph: "✎" },
  reviewed: { label: "Reviewed", glyph: "☑" },
  submitted: { label: "Submitted", glyph: "↑" },
  received: { label: "Received", glyph: "✓" },
  acknowledged: { label: "Acknowledged", glyph: "✓✓" },
  failed: { label: "Failed", glyph: "!" },
};

export function StatusBadge({ status }: { status: HandoffStatus }) {
  const b = BADGE[status];
  return (
    <span className={`hs-badge hs-${status}`} title={HANDOFF_STATUS[status]}>
      <span aria-hidden="true" className="hs-glyph">
        {b.glyph}
      </span>
      {b.label}
    </span>
  );
}

const STEPS: { status: HandoffStatus; label: string }[] = [
  { status: "draft", label: "Draft" },
  { status: "reviewed", label: "Reviewed & approved by you" },
  { status: "submitted", label: "Submitted by you" },
  { status: "received", label: "Received (simulated)" },
  { status: "acknowledged", label: "Acknowledged (simulated)" },
];

export function StatusPath({ status }: { status: HandoffStatus }) {
  const failed = status === "failed";
  const reached = failed ? 2 : STEPS.findIndex((s) => s.status === status);
  return (
    <ol className="status-path" aria-label="Handoff status">
      {STEPS.map((s, i) => {
        const state =
          failed && i === 2 ? "failed" : i < reached || (i === reached && status === "acknowledged") ? "done" : i === reached ? "current" : "todo";
        return (
          <li key={s.status} className={`status-step status-${state}`} aria-current={state === "current" ? "step" : undefined}>
            <span className="status-dot" aria-hidden="true">
              {state === "done" ? <CheckIcon size={12} /> : state === "failed" ? "!" : i + 1}
            </span>
            {state === "failed" ? "Submission failed — not received" : s.label}
            <span className="sr-only">
              {state === "done" ? " (done)" : state === "current" ? " (current step)" : state === "failed" ? " (failed — retry is safe)" : " (not yet)"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function periodLabel(h: Pick<Handoff, "periodStart" | "periodEnd">) {
  if (!h.periodStart || !h.periodEnd) return "Period not set";
  return `${fmtDay(localDate(new Date(h.periodStart)))} – ${fmtDay(localDate(new Date(h.periodEnd)))}`;
}

export function provenance(h: Handoff): string {
  if (h.draftedBy === "seed_fixture") return "Example handoff written for this synthetic scenario";
  if (h.generation.method === "empty") return "No notes in this period — nothing for the AI to summarize";
  if (h.draftedBy === "records") return "Drafted from your notes only — AI summary unavailable";
  return `AI-drafted from your notes (${h.generation.modelReported ?? "model not reported"}), checked by CareSignal's rules`;
}

const SUPPORT: Record<string, { label: string; cls: string }> = {
  supported: { label: "Supported by the notes", cls: "pill-calm" },
  possible_unconfirmed: { label: "Possible — not confirmed", cls: "pill-review" },
  conflicting: { label: "Conflicting reports", cls: "pill-attention" },
  unknown: { label: "Unknown", cls: "pill-unknown" },
};

export function SourceChips({ caseId, ids }: { caseId: string; ids: string[] }) {
  return (
    <span className="chip-row" style={{ display: "inline-flex" }}>
      {ids.map((s) => (
        <Link key={s} className="chip" href={`/cases/${caseId}/observations/${s}`}>
          {s}
        </Link>
      ))}
    </span>
  );
}

/** The exact caregiver notes behind a statement — always one click away. */
export function OriginalNotes({ caseId, ids, notes }: { caseId: string; ids: string[]; notes: Map<string, Observation> }) {
  if (!ids.length) return null;
  return (
    <details>
      <summary className="muted-link" style={{ cursor: "pointer" }}>
        Show the original note{ids.length > 1 ? "s" : ""} ({ids.length})
      </summary>
      <ul className="list-plain" style={{ gap: 6, marginTop: 6 }}>
        {ids.map((id) => {
          const o = notes.get(id);
          return (
            <li key={id}>
              <blockquote className="quote">
                <Link href={`/cases/${caseId}/observations/${id}`}>{id}</Link>
                <span className="secondary"> · caregiver&apos;s words, exactly as entered: </span>
                {o ? `“${o.originalText}”` : <em>note not found in this case</em>}
              </blockquote>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

export function ItemRow({ caseId, item, notes, edited }: { caseId: string; item: HandoffItem; notes: Map<string, Observation>; edited: boolean }) {
  const s = SUPPORT[item.support] ?? SUPPORT.unknown;
  return (
    <li className="finding">
      <div className="chip-row" style={{ alignItems: "center" }}>
        {item.kind !== "note" && <span className={`pill ${s.cls}`}>{s.label}</span>}
        {item.comparesToBaseline && <span className="pill pill-unknown">Compared with the baseline you reported</span>}
        {edited && <span className="pill pill-unknown">Edited by you</span>}
      </div>
      <p>{item.statement}</p>
      {item.uncertainty && (
        <p className="secondary" style={{ display: "flex", gap: 6 }}>
          <InfoIcon size={14} /> What is uncertain: {item.uncertainty}
        </p>
      )}
      <div className="meta">
        <span>Sources:</span> <SourceChips caseId={caseId} ids={item.sourceIds} />
      </div>
      <OriginalNotes caseId={caseId} ids={item.sourceIds} notes={notes} />
    </li>
  );
}

export function CategoryGroups({ caseId, groups }: { caseId: string; groups: { category: string; sourceIds: string[] }[] }) {
  return (
    <ul className="list-plain" style={{ gap: 8 }}>
      {groups.map((g) => (
        <li key={g.category} style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <strong style={{ minWidth: 220 }}>{handoffCategoryLabel(g.category)}</strong>
          <SourceChips caseId={caseId} ids={g.sourceIds} />
        </li>
      ))}
    </ul>
  );
}

export function UrgentList({ caseId, urgent, notes }: { caseId: string; urgent: NonNullable<Handoff["draft"]["urgent"]>; notes: Map<string, Observation> }) {
  return (
    <ul className="list-plain" style={{ gap: 8 }}>
      {urgent.map((u) => (
        <li key={u.sourceId} className={`safety-banner ${u.tier === "emergency" ? "safety-emergency" : "safety-contact"}`} style={{ padding: "10px 14px" }}>
          <strong style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <AlertIcon size={18} /> {u.tier === "emergency" ? "Emergency guidance" : "Prompt-attention guidance"} was shown immediately when{" "}
            <Link href={`/cases/${caseId}/observations/${u.sourceId}`}>{u.sourceId}</Link> was saved ({fmtDateTime(u.alertedAt)}).
          </strong>
          <span>“{notes.get(u.sourceId)?.originalText ?? "note not found"}”</span>
          <span className="secondary">
            {u.seenAt ? `You marked the notice as seen ${fmtDateTime(u.seenAt)}.` : "The notice is still showing at the top of every screen."} It was not held for this
            weekly handoff, and this handoff is not how urgent concerns are handled.
          </span>
        </li>
      ))}
    </ul>
  );
}

const EVENT_LABEL: Record<HandoffStatusEvent["event"], string> = {
  status: "",
  edited: "Edited",
  regenerated: "Regenerated",
  response_added: "Synthetic scenario outcome",
};

export function HistoryList({ history }: { history: HandoffStatusEvent[] }) {
  return (
    <ol style={{ margin: "6px 0 0", paddingLeft: 20, display: "flex", flexDirection: "column", gap: 4 }}>
      {history.map((e) => (
        <li key={e.id}>
          {e.event === "status" ? <StatusBadge status={e.status} /> : <strong>{EVENT_LABEL[e.event]}</strong>}{" "}
          <span className="secondary">· {fmtDateTime(e.at)}</span>
          {e.note ? <span className="secondary"> — {e.note}</span> : null}
        </li>
      ))}
    </ol>
  );
}

/** A scenario artifact written in advance for Case 1 — never AI output, never a real clinical action. */
export function FictionalResponse({ text, label, at }: { text: string; label: string; at: string }) {
  return (
    <div className="card" style={{ background: "var(--unknown-bg)", borderStyle: "dashed" }}>
      <p className="stat-label" style={{ fontWeight: 600, display: "flex", gap: 6, alignItems: "center" }}>
        <InfoIcon size={14} /> Synthetic scenario outcome — fictional
      </p>
      <p style={{ marginTop: 4 }}>{text}</p>
      <p className="secondary" style={{ fontWeight: 600 }}>{label}</p>
      <p className="secondary">Written in advance for this synthetic scenario — not generated by AI, and no clinician or care team took any action. · {fmtDateTime(at)}</p>
    </div>
  );
}
