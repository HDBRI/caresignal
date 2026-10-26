/**
 * Handoff workflow (Task 13): draft -> reviewed -> submitted -> received -> acknowledged.
 *
 * - One OPEN (draft or reviewed) handoff per case — the routine weekly draft. Regenerating updates it in place.
 * - A submitted handoff is frozen. New information makes a NEW version; earlier versions and receipts are kept.
 * - Nothing is ever sent automatically: submit needs an approved (reviewed) handoff and an explicit request.
 * - Every status change and every edit/regeneration writes a handoff_status_history row.
 * - The "receiver" is simulated: a receipt exists only once this server has saved the approved payload.
 */
import { z } from "zod";
import { buildHandoffDraft } from "../ai/handoff";
import type { CategorizeDeps } from "../ai/categorize";
import type { Database, Principal, Sql } from "../db/client";
import { SEED_CASES } from "../fixtures";
import type { Handoff, HandoffContent, HandoffPayload, ReceiverRecord } from "../models";
import { addDays, localDate, wallTimeToUtc } from "../time";
import { getCase, NotFoundError } from "./cases";
import { newHandoffDisplayId } from "./ids";
import { toHandoff, toReceiverRecord } from "./mappers";
import { HANDOFF_DISCLAIMER } from "./seed";

export class HandoffError extends Error {
  constructor(
    public code: "not_found" | "not_open" | "not_draft" | "not_reviewed" | "not_confirmed" | "invalid_payload" | "unknown_source" | "not_received" | "no_response" | "bad_edit",
    message: string,
  ) {
    super(message);
  }
}

const OPEN = ["draft", "reviewed"];

async function history(sql: Sql, h: Pick<Handoff, "id" | "caseId">, ownerId: string, status: string, note: string, event = "status") {
  await sql.query(
    `insert into handoff_status_history (handoff_id, case_id, owner_id, status, note, event, at) values ($1, $2, $3, $4, $5, $6, clock_timestamp())`,
    [h.id, h.caseId, ownerId, status, note, event],
  );
}

async function loadHandoff(sql: Sql, p: Principal, handoffId: string): Promise<Handoff> {
  const rows = await sql.query(`select * from handoffs where id = $1 and owner_id = $2`, [handoffId, p.userId]);
  if (rows.length !== 1) throw new HandoffError("not_found", "Handoff not found.");
  return toHandoff(rows[0]);
}

export async function getHandoffByDisplayId(db: Database, p: Principal, caseId: string, displayId: string): Promise<Handoff> {
  await getCase(db, p, caseId);
  const rows = await db.asPrincipal(p, (sql) =>
    sql.query(`select * from handoffs where case_id = $1 and owner_id = $2 and display_id = $3`, [caseId, p.userId, displayId]),
  );
  if (rows.length !== 1) throw new NotFoundError("handoff not found");
  return toHandoff(rows[0]);
}

/** Has anything changed (new note, wording correction, category correction) since `since`? */
async function changedSince(sql: Sql, p: Principal, caseId: string, since: string): Promise<boolean> {
  const [r] = await sql.query<{ n: number }>(
    `select (select count(*) from observations where case_id = $1 and owner_id = $2 and entered_at > $3)
          + (select count(*) from observation_edits e join observations o on o.id = e.observation_id
               where o.case_id = $1 and o.owner_id = $2 and e.edited_at > $3)
          + (select count(*) from observation_analyses where case_id = $1 and owner_id = $2 and source = 'caregiver' and created_at > $3) as n`,
    [caseId, p.userId, since],
  );
  return Number(r.n) > 0;
}

export type DraftOutcome =
  | { status: "created" | "regenerated"; handoff: Handoff }
  | { status: "unchanged"; handoff: Handoff }; // a submitted version already covers this period and nothing changed

/**
 * Create this week's draft, or regenerate the open one. A new version for a period that a submitted handoff
 * already covers is made only if the caregiver added or corrected information after it was submitted.
 */
export async function createOrRegenerateDraft(db: Database, p: Principal, caseId: string, deps: CategorizeDeps): Promise<DraftOutcome> {
  await getCase(db, p, caseId);
  const today = localDate(new Date());
  const periodStart = addDays(today, -6);

  const existing = await db.asPrincipal(p, (sql) =>
    sql.query(`select * from handoffs where case_id = $1 and owner_id = $2 order by version desc, created_at desc`, [caseId, p.userId]),
  );
  const all = existing.map(toHandoff);
  const open = all.find((h) => OPEN.includes(h.status));
  if (!open) {
    const latestSent = all.find((h) => h.submittedAt);
    const overlaps = latestSent?.periodEnd && localDate(new Date(latestSent.periodEnd)) >= periodStart;
    if (latestSent && overlaps && !(await db.asPrincipal(p, (sql) => changedSince(sql, p, caseId, latestSent.submittedAt!)))) {
      return { status: "unchanged", handoff: latestSent };
    }
  }

  const d = await buildHandoffDraft(db, p, caseId, deps);
  const start = wallTimeToUtc(d.periodStart, "00:00").toISOString();
  const end = wallTimeToUtc(d.periodEnd, "23:59").toISOString();

  return db.asPrincipal(p, async (sql) => {
    if (open) {
      const rows = await sql.query(
        `update handoffs set status = 'draft', draft = $1, generated_content = $1, generation = $2, drafted_by = $3, period_start = $4,
                period_end = $5, source_ids = $6, approved_payload = null, reviewed_at = null, edited_at = null, updated_at = now()
          where id = $7 and owner_id = $8 and status in ('draft', 'reviewed') returning *`,
        [JSON.stringify(d.content), JSON.stringify(d.generation), d.draftedBy, start, end, JSON.stringify(d.sourceIds), open.id, p.userId],
      );
      if (rows.length !== 1) throw new HandoffError("not_open", "This handoff was submitted in the meantime.");
      const h = toHandoff(rows[0]);
      await history(
        sql, h, p.userId, "draft",
        open.status === "reviewed" ? "Draft regenerated from the latest notes — the earlier approval was cleared" : "Draft regenerated from the latest notes",
        "regenerated",
      );
      return { status: "regenerated" as const, handoff: h };
    }
    const version = (all[0]?.version ?? 0) + 1;
    const rows = await sql.query(
      `insert into handoffs (display_id, case_id, owner_id, status, period_start, period_end, draft, generated_content, generation, drafted_by,
                             source_ids, origin, synthetic, version)
       values ($1, $2, $3, 'draft', $4, $5, $6, $6, $7, $8, $9, 'session', true, $10) returning *`,
      [newHandoffDisplayId(), caseId, p.userId, start, end, JSON.stringify(d.content), JSON.stringify(d.generation), d.draftedBy, JSON.stringify(d.sourceIds), version],
    );
    const h = toHandoff(rows[0]);
    await history(sql, h, p.userId, "draft", version > 1 ? `Draft version ${version} created — earlier versions are kept unchanged` : "Draft created — not sent");
    return { status: "created" as const, handoff: h };
  });
}

// ---------------- Caregiver edits ----------------

const text = (max: number) => z.string().trim().max(max);
export const handoffEditInput = z.object({
  summary: text(2000).min(1, "The summary can't be empty."),
  items: z.array(z.object({ statement: text(800), remove: z.boolean() })),
  questions: z.array(z.object({ text: text(400), remove: z.boolean() })),
  newQuestions: z.array(text(400)).max(5),
  missingInfo: z.array(text(400)).max(20),
});
export type HandoffEditInput = z.infer<typeof handoffEditInput>;

/**
 * Apply the caregiver's edits. Sources can't be changed or invented: edits are matched to the existing
 * statements by position, and only their wording can change (or they can be removed). Editing an approved
 * handoff returns it to draft so it must be reviewed again.
 */
export async function editDraft(db: Database, p: Principal, handoffId: string, raw: HandoffEditInput): Promise<Handoff> {
  const input = handoffEditInput.parse(raw);
  return db.asPrincipal(p, async (sql) => {
    const h = await loadHandoff(sql, p, handoffId);
    if (!OPEN.includes(h.status)) throw new HandoffError("not_open", "A submitted handoff can't be edited. Create a new version instead.");
    if (input.items.length !== h.draft.items.length || input.questions.length !== h.draft.questions.length)
      throw new HandoffError("bad_edit", "The draft changed while you were editing. Reload and try again.");
    const draft: HandoffContent = {
      ...h.draft,
      summary: input.summary,
      items: h.draft.items.flatMap((it, i) => (input.items[i].remove || !input.items[i].statement ? [] : [{ ...it, statement: input.items[i].statement }])),
      questions: [
        ...h.draft.questions.flatMap((q, i) => (input.questions[i].remove || !input.questions[i].text ? [] : [{ ...q, text: input.questions[i].text }])),
        ...input.newQuestions.filter(Boolean).map((t) => ({ text: t, sourceIds: [] })), // written by the caregiver; no source claimed
      ],
      missingInfo: input.missingInfo.filter(Boolean),
    };
    const rows = await sql.query(
      `update handoffs set draft = $1, status = 'draft', approved_payload = null, reviewed_at = null, edited_at = now(), updated_at = now()
        where id = $2 and owner_id = $3 returning *`,
      [JSON.stringify(draft), h.id, p.userId],
    );
    await history(sql, h, p.userId, "draft", h.status === "reviewed" ? "Edited by the caregiver after approval — approval cleared, review again" : "Edited by the caregiver", "edited");
    return toHandoff(rows[0]);
  });
}

// ---------------- Review / approve ----------------

const sourceId = z.string().regex(/^OBS-[A-Z0-9-]{2,12}$/);
export const HANDOFF_PAYLOAD_SCHEMA = z.object({
  handoffId: z.string().regex(/^HO-[A-Z0-9]{8}$/),
  patientRef: z.string().min(1),
  pseudonym: z.string().min(1),
  periodStart: z.string().nullable(),
  periodEnd: z.string().nullable(),
  summary: z.string().min(1).max(2000),
  items: z.array(z.object({ statement: z.string().min(1), support: z.enum(["supported", "possible_unconfirmed", "conflicting", "unknown"]), sourceIds: z.array(sourceId).min(1) }).passthrough()),
  questions: z.array(z.object({ text: z.string().min(1), sourceIds: z.array(sourceId) })),
  missingInfo: z.array(z.string()),
  categories: z.array(z.object({ category: z.string(), sourceIds: z.array(sourceId) })).optional(),
  urgent: z.array(z.object({ sourceId, tier: z.enum(["emergency", "contact_care_team", "review"]) }).passthrough()).optional(),
  safetyNotes: z.array(z.object({ sourceId, tier: z.enum(["emergency", "contact_care_team", "review"]) })),
  synthetic: z.literal(true),
  disclaimer: z.string().min(1),
});

/** Every source ID the payload mentions. */
export function payloadSourceIds(p: Pick<HandoffPayload, "items" | "questions" | "safetyNotes" | "categories" | "urgent">): string[] {
  return [
    ...new Set([
      ...p.items.flatMap((i) => i.sourceIds),
      ...p.questions.flatMap((q) => q.sourceIds),
      ...p.safetyNotes.map((s) => s.sourceId),
      ...(p.categories ?? []).flatMap((c) => c.sourceIds),
      ...(p.urgent ?? []).map((u) => u.sourceId),
    ]),
  ];
}

export async function approveHandoff(db: Database, p: Principal, handoffId: string, confirmedReviewed: boolean): Promise<Handoff> {
  if (!confirmedReviewed) throw new HandoffError("not_confirmed", "Please confirm you have reviewed the draft and its source notes.");
  return db.asPrincipal(p, async (sql) => {
    const h = await loadHandoff(sql, p, handoffId);
    if (h.status !== "draft") throw new HandoffError("not_draft", "Only a draft can be approved.");
    const [c] = await sql.query<{ patient_ref: string; pseudonym: string }>(`select patient_ref, pseudonym from cases where id = $1`, [h.caseId]);
    const payload: HandoffPayload = {
      handoffId: h.displayId,
      patientRef: c.patient_ref,
      pseudonym: c.pseudonym,
      periodStart: h.periodStart,
      periodEnd: h.periodEnd,
      ...h.draft,
      safetyNotes: (h.draft.urgent ?? []).map((u) => ({ sourceId: u.sourceId, tier: u.tier })),
      synthetic: true,
      disclaimer: HANDOFF_DISCLAIMER,
    };
    if (!HANDOFF_PAYLOAD_SCHEMA.safeParse(payload).success) throw new HandoffError("invalid_payload", "The draft is incomplete and can't be approved yet.");
    const rows = await sql.query(
      `update handoffs set status = 'reviewed', approved_payload = $1, reviewed_at = now(), updated_at = now() where id = $2 and owner_id = $3 returning *`,
      [JSON.stringify(payload), h.id, p.userId],
    );
    await history(sql, h, p.userId, "reviewed", "Reviewed and approved by the caregiver — not sent yet");
    return toHandoff(rows[0]);
  });
}

// ---------------- Submit to the simulated receiver ----------------

/**
 * Submit an approved handoff. Checks, in order: owner, status is reviewed, payload schema, every source ID
 * exists in this case. Then, in ONE transaction: status submitted -> received, receipt saved, history written.
 * The same idempotency key returns the original receipt instead of creating a duplicate.
 */
export async function submitHandoff(db: Database, p: Principal, handoffId: string, idempotencyKey: string): Promise<{ handoff: Handoff; receipt: ReceiverRecord; duplicate: boolean }> {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(idempotencyKey)) throw new HandoffError("invalid_payload", "Missing submission key. Reload and try again.");
  return db.asPrincipal(p, async (sql) => {
    const h = await loadHandoff(sql, p, handoffId);
    const prior = await sql.query(`select * from handoffs where id = $1 and owner_id = $2 and idempotency_key = $3`, [h.id, p.userId, idempotencyKey]);
    if (prior.length === 1) {
      const receipt = await sql.query(`select * from receiver_records where handoff_id = $1`, [h.id]);
      if (receipt.length === 1) return { handoff: toHandoff(prior[0]), receipt: toReceiverRecord(receipt[0]), duplicate: true };
    }
    if (h.status !== "reviewed" || !h.approvedPayload) throw new HandoffError("not_reviewed", "Only a reviewed and approved handoff can be submitted.");
    const parsed = HANDOFF_PAYLOAD_SCHEMA.safeParse(h.approvedPayload);
    if (!parsed.success) throw new HandoffError("invalid_payload", "The approved handoff failed validation, so it was not sent.");
    const known = new Set(
      (await sql.query<{ display_id: string }>(`select display_id from observations where case_id = $1 and owner_id = $2`, [h.caseId, p.userId])).map((r) => r.display_id),
    );
    if (payloadSourceIds(h.approvedPayload).some((id) => !known.has(id) || !h.sourceIds.includes(id)))
      throw new HandoffError("unknown_source", "The handoff refers to a note that isn't in this case, so it was not sent.");

    const rows = await sql.query(
      `update handoffs set status = 'received', submitted_at = now(), idempotency_key = $1, updated_at = now()
        where id = $2 and owner_id = $3 and status = 'reviewed' returning *`,
      [idempotencyKey, h.id, p.userId],
    );
    if (rows.length !== 1) throw new HandoffError("not_reviewed", "This handoff is no longer waiting to be submitted.");
    await history(sql, h, p.userId, "submitted", "Submitted by the caregiver to the simulated receiver");
    const [r] = await sql.query(
      `insert into receiver_records (handoff_id, case_id, owner_id, payload, synthetic, received_at) values ($1, $2, $3, $4, true, clock_timestamp()) returning *`,
      [h.id, h.caseId, p.userId, JSON.stringify(h.approvedPayload)],
    );
    await history(sql, h, p.userId, "received", "Saved by the simulated receiver — no real care team was contacted");
    return { handoff: toHandoff(rows[0]), receipt: toReceiverRecord(r), duplicate: false };
  });
}

/** Simulated receiver: a separate click, only for a received handoff. Not a real clinical action. */
export async function acknowledgeHandoff(db: Database, p: Principal, handoffId: string): Promise<Handoff> {
  return db.asPrincipal(p, async (sql) => {
    const h = await loadHandoff(sql, p, handoffId);
    if (h.status !== "received") throw new HandoffError("not_received", "Only a received handoff can be acknowledged.");
    await sql.query(`update receiver_records set acknowledged_at = now() where handoff_id = $1 and owner_id = $2`, [h.id, p.userId]);
    const rows = await sql.query(`update handoffs set status = 'acknowledged', updated_at = now() where id = $1 and owner_id = $2 returning *`, [h.id, p.userId]);
    await history(sql, h, p.userId, "acknowledged", "Acknowledged in the simulated receiver (fictional — no real person acted)");
    return toHandoff(rows[0]);
  });
}

/** The scenario's fictional receiver response (Case 1), if its fixture defines one. */
export function fictionalResponseFor(seedKey: string | null) {
  return SEED_CASES.find((c) => c.seedKey === seedKey)?.handoff.receiverResponse ?? null;
}

export async function addFictionalResponse(db: Database, p: Principal, handoffId: string): Promise<void> {
  await db.asPrincipal(p, async (sql) => {
    const h = await loadHandoff(sql, p, handoffId);
    if (!["received", "acknowledged"].includes(h.status)) throw new HandoffError("not_received", "The handoff has not been received.");
    const [c] = await sql.query<{ seed_key: string | null }>(`select seed_key from cases where id = $1`, [h.caseId]);
    const r = fictionalResponseFor(c.seed_key);
    if (!r) throw new HandoffError("no_response", "This scenario has no simulated response.");
    const already = await sql.query(`select 1 from receiver_responses where handoff_id = $1`, [h.id]);
    if (already.length) return;
    await sql.query(
      `insert into receiver_responses (handoff_id, case_id, owner_id, kind, text, label, synthetic, at) values ($1, $2, $3, $4, $5, $6, true, now())`,
      [h.id, h.caseId, p.userId, r.kind, r.text, r.label],
    );
    await history(sql, h, p.userId, h.status, "Simulated receiver response added — fictional scenario outcome, not a real clinical event", "response_added");
  });
}
