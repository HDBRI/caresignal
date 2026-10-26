/**
 * Handoff workflow (Task 13): draft -> reviewed -> submitted -> received -> acknowledged.
 *
 * - One OPEN (draft or reviewed) handoff per case — the routine weekly draft. Regenerating updates it in place.
 * - A submitted handoff is frozen. New information makes a NEW version; earlier versions and receipts are kept.
 * - Nothing is ever sent automatically: submit needs an approved (reviewed) handoff and an explicit request.
 * - Every status change and every edit/regeneration writes a handoff_status_history row.
 * - The "receiver" is simulated: a receipt exists only once this server has saved the approved payload.
 */
import { createHash } from "node:crypto";
import { z } from "zod";
import { buildHandoffDraft } from "../ai/handoff";
import type { CategorizeDeps } from "../ai/categorize";
import type { Database, Principal, Sql } from "../db/client";
import { SEED_CASES } from "../fixtures";
import type { Handoff, HandoffContent, HandoffPayload, ReceiverRecord } from "../models";
import { addDays, localDate, wallTimeToUtc } from "../time";
import { getCase, NotFoundError } from "./cases";
import { newHandoffDisplayId, newReceiptCode } from "./ids";
import { toHandoff, toReceiverRecord } from "./mappers";
import { HANDOFF_DISCLAIMER } from "./seed";

export class HandoffError extends Error {
  constructor(
    public code: "not_found" | "not_open" | "not_draft" | "not_reviewed" | "not_confirmed" | "invalid_payload" | "unknown_source" | "not_received" | "not_acknowledged" | "no_response" | "bad_edit" | "already_received" | "delivery_failed",
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
  /** Structured pattern rows: wording can change or a row can be removed; its evidence stays attached. */
  patterns: z.array(z.object({ change: text(600), remove: z.boolean() })).optional(),
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
      ...(h.draft.patterns && input.patterns && input.patterns.length === h.draft.patterns.length
        ? { patterns: h.draft.patterns.flatMap((row, i) => (input.patterns![i].remove || !input.patterns![i].change ? [] : [{ ...row, change: input.patterns![i].change }])) }
        : {}),
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
export function payloadSourceIds(p: Pick<HandoffPayload, "items" | "questions" | "safetyNotes" | "categories" | "urgent" | "patterns" | "notable" | "timeline">): string[] {
  return [
    ...new Set([
      ...p.items.flatMap((i) => i.sourceIds),
      ...p.questions.flatMap((q) => q.sourceIds),
      ...p.safetyNotes.map((s) => s.sourceId),
      ...(p.categories ?? []).flatMap((c) => c.sourceIds),
      ...(p.urgent ?? []).map((u) => u.sourceId),
      ...(p.patterns ?? []).flatMap((x) => x.sourceIds),
      ...(p.notable ?? []).map((x) => x.sourceId),
      ...(p.timeline ?? []).map((x) => x.sourceId).filter(Boolean), // scenario-timeline events are not notes
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
    // The approved snapshot: exact text + hash. Later edits make a new draft/version; this text never changes.
    const text = JSON.stringify(payload);
    const rows = await sql.query(
      `update handoffs set status = 'reviewed', approved_payload = $1, approved_payload_text = $2, approved_payload_sha256 = $3,
              reviewed_at = now(), updated_at = now() where id = $4 and owner_id = $5 returning *`,
      [text, text, sha256(text), h.id, p.userId],
    );
    await history(sql, h, p.userId, "reviewed", "Reviewed and approved by the caregiver — not sent yet");
    return toHandoff(rows[0]);
  });
}

// ---------------- Submit to the simulated receiver ----------------

export const sha256 = (text: string) => createHash("sha256").update(text, "utf8").digest("hex");

export interface SubmitOptions {
  /** Demo control: the simulated receiver fails BEFORE saving anything, so the handoff ends up Failed. */
  simulateFailure?: boolean;
}

export interface SubmitResult {
  handoff: Handoff;
  receipt: ReceiverRecord;
  /** True when this request was a retry of one that had already been received (same idempotency key). */
  duplicate: boolean;
}

const RETRYABLE = ["reviewed", "submitted", "failed"];

/**
 * Deliver an approved handoff to the simulated receiver.
 *
 *   1. Validate (no state change on failure): owner, status, payload schema, exact snapshot hash, and every
 *      source ID exists as an observation of THIS case and is one of the handoff's sources.
 *   2. Transaction A: status -> Submitted (attempt counted, idempotency key stored, history row).
 *   3. Transaction B: the simulated receiver saves the exact approved text -> receipt row, status -> Received.
 *      Received is written in the same transaction as the receipt, so it can never appear without one.
 *   4. If B fails: status -> Failed with the reason (history row). Retrying is safe.
 * A retry with the same idempotency key after success returns the original receipt; a concurrent duplicate
 * finds the existing receipt (one receipt per handoff is enforced by the database).
 */
export async function submitHandoff(db: Database, p: Principal, handoffId: string, idempotencyKey: string, opts: SubmitOptions = {}): Promise<SubmitResult> {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(idempotencyKey)) throw new HandoffError("invalid_payload", "Missing or malformed submission key. Reload and try again.");

  const existingReceipt = async (sql: Sql, h: Handoff) => {
    const r = await sql.query(`select * from receiver_records where handoff_id = $1 and owner_id = $2`, [h.id, p.userId]);
    return r.length ? toReceiverRecord(r[0]) : null;
  };

  // 1 + 2: validate and mark Submitted.
  const step = await db.asPrincipal(p, async (sql): Promise<{ done: SubmitResult } | { handoff: Handoff }> => {
    const h = await loadHandoff(sql, p, handoffId);
    const [{ idempotency_key: priorKey }] = await sql.query<{ idempotency_key: string | null }>(`select idempotency_key from handoffs where id = $1`, [h.id]);
    if (h.status === "received" || h.status === "acknowledged") {
      const receipt = await existingReceipt(sql, h);
      if (receipt && priorKey === idempotencyKey) return { done: { handoff: h, receipt, duplicate: true } };
      throw new HandoffError("already_received", "This handoff was already received by the simulated receiver. Nothing was sent twice.");
    }
    if (!RETRYABLE.includes(h.status) || !h.approvedPayload) throw new HandoffError("not_reviewed", "Only a reviewed and approved handoff can be submitted.");
    if (!HANDOFF_PAYLOAD_SCHEMA.safeParse(h.approvedPayload).success)
      throw new HandoffError("invalid_payload", "The approved handoff failed validation, so it was not sent.");
    if (h.approvedPayloadText !== null && (sha256(h.approvedPayloadText) !== h.approvedPayloadSha256 || h.approvedPayload.handoffId !== h.displayId))
      throw new HandoffError("invalid_payload", "The approved snapshot does not match what was approved, so it was not sent.");
    const known = new Set(
      (await sql.query<{ display_id: string }>(`select display_id from observations where case_id = $1 and owner_id = $2`, [h.caseId, p.userId])).map((r) => r.display_id),
    );
    if (payloadSourceIds(h.approvedPayload).some((id) => !known.has(id) || !h.sourceIds.includes(id)))
      throw new HandoffError("unknown_source", "The handoff refers to a note that isn't part of this patient's records, so it was not sent.");

    const rows = await sql.query(
      `update handoffs set status = 'submitted', submitted_at = now(), idempotency_key = $1, submit_attempts = submit_attempts + 1,
              last_error = null, updated_at = now()
        where id = $2 and owner_id = $3 and status in ('reviewed', 'submitted', 'failed') returning *`,
      [idempotencyKey, h.id, p.userId],
    );
    if (rows.length !== 1) throw new HandoffError("not_reviewed", "This handoff is no longer waiting to be submitted.");
    const updated = toHandoff(rows[0]);
    await history(sql, h, p.userId, "submitted", `Submitted by the caregiver to the simulated receiver (attempt ${updated.submitAttempts})`);
    return { handoff: updated };
  });
  if ("done" in step) return step.done;
  const h = step.handoff;

  // 3: the simulated receiver persists the exact approved text.
  try {
    return await db.asPrincipal(p, async (sql) => {
      if (opts.simulateFailure) throw new Error("Simulated receiver unavailable (demo failure)");
      const text = h.approvedPayloadText ?? JSON.stringify(h.approvedPayload);
      const inserted = await sql.query(
        `insert into receiver_records (handoff_id, case_id, owner_id, payload, payload_text, payload_sha256, receipt_code, synthetic, received_at)
         values ($1, $2, $3, $4, $5, $6, $7, true, clock_timestamp())
         on conflict (handoff_id) do nothing returning *`,
        [h.id, h.caseId, p.userId, text, text, sha256(text), newReceiptCode()],
      );
      if (!inserted.length) {
        // A concurrent request already delivered it: return that receipt, never a second one.
        const receipt = (await existingReceipt(sql, h))!;
        return { handoff: await loadHandoff(sql, p, h.id), receipt, duplicate: true };
      }
      const rows = await sql.query(`update handoffs set status = 'received', updated_at = now() where id = $1 and owner_id = $2 returning *`, [h.id, p.userId]);
      await history(sql, h, p.userId, "received", "Saved by the simulated receiver — no real care team was contacted");
      return { handoff: toHandoff(rows[0]), receipt: toReceiverRecord(inserted[0]), duplicate: false };
    });
  } catch (e) {
    // 4: nothing was received. Record Failed (retryable) — never Received.
    const reason = e instanceof Error ? e.message.slice(0, 200) : "Unknown error";
    await db.asPrincipal(p, async (sql) => {
      await sql.query(`update handoffs set status = 'failed', last_error = $1, updated_at = now() where id = $2 and owner_id = $3 and status = 'submitted'`, [
        reason,
        h.id,
        p.userId,
      ]);
      await history(sql, h, p.userId, "failed", `Delivery failed — nothing was received (${reason}). Safe to retry.`);
    });
    throw new HandoffError("delivery_failed", "The simulated receiver did not save the handoff, so nothing was received. It is marked Failed — you can retry safely.");
  }
}

/** Simulated receiver: a separate, explicit action, only for a received handoff. Not a clinical action. */
export async function acknowledgeHandoff(db: Database, p: Principal, handoffId: string): Promise<Handoff> {
  return db.asPrincipal(p, async (sql) => {
    const h = await loadHandoff(sql, p, handoffId);
    if (h.status !== "received") throw new HandoffError("not_received", "Only a received handoff can be acknowledged.");
    await sql.query(`update receiver_records set acknowledged_at = now() where handoff_id = $1 and owner_id = $2`, [h.id, p.userId]);
    const rows = await sql.query(`update handoffs set status = 'acknowledged', updated_at = now() where id = $1 and owner_id = $2 returning *`, [h.id, p.userId]);
    await history(sql, h, p.userId, "acknowledged", "Acknowledged in the simulated receiver — no clinician acted and no care changed");
    return toHandoff(rows[0]);
  });
}

/** The scenario's fictional receiver response (Case 1), if its fixture defines one. Written in advance, not by AI. */
export function fictionalResponseFor(seedKey: string | null) {
  return SEED_CASES.find((c) => c.seedKey === seedKey)?.handoff.receiverResponse ?? null;
}

/** Adds the scenario's fictional response as a separate artifact — only after the explicit acknowledgement. */
export async function addFictionalResponse(db: Database, p: Principal, handoffId: string): Promise<void> {
  await db.asPrincipal(p, async (sql) => {
    const h = await loadHandoff(sql, p, handoffId);
    if (h.status !== "acknowledged") throw new HandoffError("not_acknowledged", "The simulated receiver has to acknowledge the handoff first.");
    const [c] = await sql.query<{ seed_key: string | null }>(`select seed_key from cases where id = $1`, [h.caseId]);
    const r = fictionalResponseFor(c.seed_key);
    if (!r) throw new HandoffError("no_response", "This scenario has no simulated response.");
    const already = await sql.query(`select 1 from receiver_responses where handoff_id = $1`, [h.id]);
    if (already.length) return;
    await sql.query(
      `insert into receiver_responses (handoff_id, case_id, owner_id, kind, text, label, synthetic, at) values ($1, $2, $3, $4, $5, $6, true, now())`,
      [h.id, h.caseId, p.userId, r.kind, r.text, r.label],
    );
    await history(sql, h, p.userId, h.status, "Synthetic scenario outcome added — written in advance for this scenario, not generated by AI, not a real clinical event", "response_added");
  });
}

// ---------------- Carry a finding from Insights into the weekly draft ----------------

export interface FindingForHandoff {
  statement: string;
  support: "supported" | "possible_unconfirmed" | "conflicting" | "unknown";
  sourceIds: string[];
  kind: "pattern" | "change" | "possible_pattern" | "conflict" | "recording_activity";
  uncertainty?: string | null;
}

/**
 * The caregiver chooses to add an evidence-linked finding to the OPEN weekly draft. No AI call, no submission:
 * the item is appended, an approved draft returns to draft (it must be reviewed again), and history records it.
 * Every source must already be one of the draft's notes (same patient, same period) — nothing new can be cited.
 */
export async function addFindingToDraft(db: Database, p: Principal, caseId: string, f: FindingForHandoff): Promise<{ handoff: Handoff; added: boolean }> {
  const statement = f.statement.trim();
  if (!statement || statement.length > 2000 || f.sourceIds.length === 0) throw new HandoffError("bad_edit", "This finding can't be added.");
  return db.asPrincipal(p, async (sql) => {
    const rows = await sql.query(`select * from handoffs where case_id = $1 and owner_id = $2 and status in ('draft', 'reviewed')`, [caseId, p.userId]);
    if (rows.length !== 1) throw new HandoffError("not_open", "There is no open weekly draft. Create this week's draft first.");
    const h = toHandoff(rows[0]);
    if (f.sourceIds.some((id) => !h.sourceIds.includes(id)))
      throw new HandoffError("unknown_source", "Some notes behind this finding are outside this week's handoff period, so it wasn't added.");
    if (h.draft.items.some((i) => i.statement === statement)) return { handoff: h, added: false };
    const draft: HandoffContent = {
      ...h.draft,
      items: [...h.draft.items, { statement, support: f.support, sourceIds: [...new Set(f.sourceIds)], kind: f.kind, uncertainty: f.uncertainty ?? null, addedFrom: "insights" }],
    };
    const updated = await sql.query(
      `update handoffs set draft = $1, status = 'draft', approved_payload = null, approved_payload_text = null, approved_payload_sha256 = null,
              reviewed_at = null, edited_at = now(), updated_at = now() where id = $2 and owner_id = $3 returning *`,
      [JSON.stringify(draft), h.id, p.userId],
    );
    await history(sql, h, p.userId, "draft", h.status === "reviewed" ? "Finding added from Insights by the caregiver — approval cleared, review again" : "Finding added from Insights by the caregiver", "edited");
    return { handoff: toHandoff(updated[0]), added: true };
  });
}
