import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireActor, principalOf } from "@/lib/auth/session";
import { getCase, NotFoundError } from "@/lib/repo/cases";
import { getDb } from "@/lib/repo/db";
import { fictionalResponseFor, getHandoffByDisplayId } from "@/lib/repo/handoff-workflow";
import { listHandoffs } from "@/lib/repo/handoffs";
import { latestEdits, listObservations } from "@/lib/repo/observations";
import { fmtDateTime, KindTag } from "@/components/display";
import { ApproveForm, DraftButton, EditForm, SubmitForm } from "@/components/handoff/HandoffForms";
import {
  CategoryGroups,
  FictionalResponse,
  StatusBadge,
  HANDOFF_STATUS,
  HistoryList,
  ItemRow,
  periodLabel,
  provenance,
  SourceChips,
  StatusPath,
  UrgentList,
} from "@/components/handoff/HandoffView";
import { CheckIcon } from "@/components/icons";
import { addFictionalResponseAction } from "@/app/actions/handoffs";

export const dynamic = "force-dynamic";

const GROUPS = [
  { title: "Changes and patterns supported by the notes", match: (s: string, k?: string) => s === "supported" && k !== "note" },
  { title: "Possible — not confirmed", match: (s: string) => s === "possible_unconfirmed" },
  { title: "Conflicting reports (kept as reported — CareSignal does not pick one)", match: (s: string) => s === "conflicting" },
  { title: "Notes as written", match: (_s: string, k?: string) => k === "note" },
  { title: "Other", match: (s: string) => s === "unknown" },
];

/** Screen 6 (detail) — one handoff: what it says, where every claim comes from, and its status path. */
export default async function HandoffDetail({
  params,
  searchParams,
}: {
  params: Promise<{ caseId: string; displayId: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { caseId, displayId } = await params;
  const sp = await searchParams;
  const actor = await requireActor();
  const db = await getDb();
  const p = principalOf(actor);
  let h;
  try {
    h = await getHandoffByDisplayId(db, p, caseId, decodeURIComponent(displayId));
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  const [c, observations, edits, bundles] = await Promise.all([getCase(db, p, caseId), listObservations(db, p, caseId), latestEdits(db, p, caseId), listHandoffs(db, p, caseId)]);
  const bundle = bundles.find((b) => b.handoff.id === h.id)!;
  const notes = new Map(observations.map((o) => [o.displayId, o]));
  const d = h.status === "draft" || h.status === "reviewed" ? h.draft : (h.approvedPayload ?? h.draft);
  const gen = h.generatedContent;
  const generatedStatements = new Set(gen?.items.map((i) => i.statement) ?? []);
  const isEdited = (s: string) => Boolean(gen) && !generatedStatements.has(s);
  const sources = h.sourceIds.length ? h.sourceIds : [...new Set(d.items.flatMap((i) => i.sourceIds))];
  const open = h.status === "draft" || h.status === "reviewed";
  const canRespond = !!fictionalResponseFor(c.seedKey) && h.status === "acknowledged" && bundle.responses.length === 0;
  const receipt = bundle.receipt;

  return (
    <>
      <Link href={`/cases/${caseId}/handoffs`} className="muted-link">
        ← All handoffs
      </Link>
      <header style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <span className="stat-label">Weekly care-coordination handoff · version {h.version}</span>
        <h1>
          {c.pseudonym} · {periodLabel(h)}
        </h1>
        <p className="meta">
          <span>Handoff ID {h.displayId}</span>
          <StatusBadge status={h.status} />
          <span>{HANDOFF_STATUS[h.status]}</span>
          <span>· Synthetic data — classroom prototype</span>
        </p>
      </header>

      {sp.created && <p className="form-success" role="status"><CheckIcon size={17} /> Draft created. Nothing has been sent — review it below.</p>}
      {sp.regenerated && <p className="form-success" role="status"><CheckIcon size={17} /> Draft regenerated from your latest notes. Nothing has been sent — review it again.</p>}
      {sp.submitted && bundle.receipt && (
        <p className="form-success" role="status">
          <CheckIcon size={17} /> Handoff received by the simulated receiver. The approved handoff was saved in this demo. No real care team was contacted.
        </p>
      )}

      <section className="card" aria-label="Status" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <StatusPath status={h.status} />
        <p className="secondary">
          CareSignal never sends a handoff automatically. You review it, may edit it, approve it, and then choose to submit it. The receiver is
          simulated: no clinician sees or acts on it.
        </p>
      </section>

      {(d.urgent ?? []).length > 0 && (
        <section className="card" aria-labelledby="urgent-h">
          <KindTag kind="safety" />
          <h2 id="urgent-h" style={{ fontSize: 19, marginBottom: 8 }}>
            Urgent notes in this period
          </h2>
          <UrgentList caseId={caseId} urgent={d.urgent!} notes={notes} />
        </section>
      )}

      <section className={`card ${h.draftedBy === "ai" && !(gen && d.summary !== gen.summary) ? "ai-surface" : ""}`} aria-labelledby="summary-h" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div className="section-head" style={{ marginBottom: 0 }}>
          <h2 id="summary-h" style={{ fontSize: 19 }}>Summary</h2>
          <span className={`source-tag ${h.draftedBy === "ai" ? "source-ai" : "source-records"}`}>
            {gen && d.summary !== gen.summary ? "Written / edited by you" : provenance(h)}
          </span>
        </div>
        <p style={{ fontSize: 16 }}>{d.summary}</p>
        {h.generation.rejectedItems ? (
          <p className="secondary">{h.generation.rejectedItems} AI statement(s) failed CareSignal&apos;s checks and were left out.</p>
        ) : null}
      </section>

      {d.items.length > 0 && (
        <section className={`card ${h.draftedBy === "ai" ? "ai-surface" : ""}`} aria-labelledby="items-h">
          {h.draftedBy === "ai" && <KindTag kind="ai" />}
          <h2 id="items-h" style={{ fontSize: 19 }}>What the notes show</h2>
          <p className="secondary">Each statement links to the caregiver notes it comes from. Statements are about what was logged — not a diagnosis or advice.</p>
          {GROUPS.map((g) => {
            const items = d.items.filter((i) => g.match(i.support, i.kind));
            if (!items.length) return null;
            return (
              <div key={g.title} style={{ marginTop: 12 }}>
                <h3 style={{ fontSize: 15.5 }}>{g.title}</h3>
                <ul className="list-plain">
                  {items.map((i) => (
                    <ItemRow key={i.statement} caseId={caseId} item={i} notes={notes} edited={isEdited(i.statement)} />
                  ))}
                </ul>
              </div>
            );
          })}
        </section>
      )}

      {(d.categories ?? []).length > 0 && (
        <section className="card" aria-labelledby="cat-h">
          <h2 id="cat-h" style={{ fontSize: 19, marginBottom: 8 }}>Notes by category</h2>
          <CategoryGroups caseId={caseId} groups={d.categories!} />
          <p className="secondary" style={{ marginTop: 8 }}>Your category corrections are used first; otherwise AI labels, only when the AI finished.</p>
        </section>
      )}

      <section className="card" aria-labelledby="missing-h">
        <h2 id="missing-h" style={{ fontSize: 19 }}>Uncertain, missing or unknown</h2>
        {d.missingInfo.length ? (
          <ul style={{ margin: "8px 0 0", paddingLeft: 20 }}>
            {d.missingInfo.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        ) : (
          <p className="secondary">Nothing listed. That does not mean nothing is missing.</p>
        )}
      </section>

      <section className="card" aria-labelledby="q-h">
        <KindTag kind="question">Questions for the care team · drafted for you to ask</KindTag>
        <h2 id="q-h" style={{ fontSize: 19 }}>Questions you may want to raise with the care team</h2>
        {d.questions.length ? (
          <ul className="list-plain">
            {d.questions.map((q) => (
              <li key={q.text} className="finding">
                <p>{q.text}</p>
                <div className="meta">
                  {q.sourceIds.length ? (
                    <>
                      <span>From:</span> <SourceChips caseId={caseId} ids={q.sourceIds} />
                    </>
                  ) : (
                    <span className="pill pill-unknown">Added by you</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="secondary">No questions yet. You can add your own when editing the draft.</p>
        )}
      </section>

      <section className="card" aria-labelledby="src-h">
        <KindTag kind="caregiver">Caregiver&apos;s original notes</KindTag>
        <h2 id="src-h" style={{ fontSize: 19 }}>Source observations ({sources.length})</h2>
        <p className="secondary">Caregiver-reported, exactly as entered. These are the records the handoff is built from.</p>
        <ul className="list-plain" style={{ gap: 8, marginTop: 8 }}>
          {sources.map((id) => {
            const o = notes.get(id);
            const e = o ? edits.get(o.id) : undefined;
            return (
              <li key={id}>
                <blockquote className="quote">
                  <Link href={`/cases/${caseId}/observations/${id}`}>{id}</Link>
                  <span className="secondary"> · {o ? fmtDateTime(o.eventTime ?? o.enteredAt) : ""}{o?.authorLabel ? ` · ${o.authorLabel}` : ""}</span>
                  <br />“{o?.originalText ?? "note not found"}”
                  {e && <span className="secondary"> — corrected wording by you: “{e.editedText}”</span>}
                </blockquote>
              </li>
            );
          })}
        </ul>
      </section>

      {open && (
        <section className="card" aria-labelledby="review-h" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <h2 id="review-h" style={{ fontSize: 19 }}>{h.status === "draft" ? "Review, edit and approve" : "Approved — ready to submit"}</h2>
          {h.status === "draft" ? (
            <ApproveForm caseId={caseId} handoffId={h.id} />
          ) : (
            <SubmitForm caseId={caseId} displayId={h.displayId} idempotencyKey={randomUUID()} />
          )}
          <details>
            <summary className="muted-link" style={{ cursor: "pointer" }}>
              Edit the draft{h.status === "reviewed" ? " (returns it to draft — you approve again)" : ""}
            </summary>
            <div style={{ marginTop: 12 }}>
              <EditForm caseId={caseId} handoffId={h.id} draft={h.draft} />
            </div>
          </details>
          <div>
            <p className="secondary" style={{ marginBottom: 6 }}>Added or corrected a note? Regenerate the draft from your latest notes (your edits to this draft are replaced).</p>
            <DraftButton caseId={caseId} label="Regenerate from latest notes" secondary />
          </div>
        </section>
      )}

      {(h.status === "submitted" || h.status === "failed") && (
        <section className="card" aria-labelledby="delivery-h" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <h2 id="delivery-h" style={{ fontSize: 19, display: "flex", gap: 10, alignItems: "center" }}>
            Delivery <StatusBadge status={h.status} />
          </h2>
          <p>
            {h.status === "failed"
              ? `The simulated receiver did not save this handoff, so nothing was received.${h.lastError ? ` Reason: ${h.lastError}.` : ""}`
              : "Submitted, but the simulated receiver has not confirmed it saved the handoff — it is not marked received."}{" "}
            The approved version is unchanged ({h.submitAttempts} attempt{h.submitAttempts === 1 ? "" : "s"} so far).
          </p>
          <SubmitForm caseId={caseId} displayId={h.displayId} idempotencyKey={randomUUID()} retry />
        </section>
      )}

      {receipt && (
        <section className="card" aria-labelledby="receipt-h" style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <KindTag kind="receiver" />
          <h2 id="receipt-h" style={{ fontSize: 19 }}>Receipt (simulated receiver)</h2>
          <p>
            Saved by the simulated receiver {fmtDateTime(receipt.receivedAt)}. No real care team was contacted.{" "}
            <Link href={`/cases/${caseId}/receiver`}>Open the Demo receiver</Link>
          </p>
          <dl className="secondary" style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: "4px 14px", margin: 0 }}>
            <dt>Handoff ID</dt>
            <dd style={{ margin: 0 }}>{h.displayId} (version {h.version})</dd>
            <dt>Receipt ID</dt>
            <dd style={{ margin: 0 }}>{receipt.receiptCode ?? "example receipt (seeded scenario)"}</dd>
            <dt>Status</dt>
            <dd style={{ margin: 0 }}>
              <StatusBadge status={receipt.acknowledgedAt ? "acknowledged" : "received"} />
            </dd>
            {receipt.payloadSha256 && (
              <>
                <dt>Payload fingerprint</dt>
                <dd style={{ margin: 0, wordBreak: "break-all" }}>
                  SHA-256 {receipt.payloadSha256.slice(0, 16)}…{" "}
                  {receipt.payloadSha256 === h.approvedPayloadSha256 ? "— matches the version you approved" : "— DOES NOT match the approved version"}
                </dd>
              </>
            )}
          </dl>
          {bundle.responses.map((r) => (
            <FictionalResponse key={r.id} text={r.text} label={r.label} at={r.at} />
          ))}
          {canRespond && (
            <form action={addFictionalResponseAction}>
              <input type="hidden" name="caseId" value={caseId} />
              <input type="hidden" name="handoffId" value={h.id} />
              <button className="btn btn-secondary" type="submit">Add this scenario&apos;s fictional outcome (synthetic)</button>
            </form>
          )}
        </section>
      )}

      <section className="card" aria-labelledby="hist-h">
        <h2 id="hist-h" style={{ fontSize: 19 }}>Status history</h2>
        <HistoryList history={bundle.history} />
      </section>
    </>
  );
}
