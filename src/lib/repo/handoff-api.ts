/**
 * Request handling for POST /api/handoffs (kept free of Next.js so it can be integration-tested directly).
 *
 * Body: { caseId, handoffId: "HO-XXXXXXXX", idempotencyKey, simulateFailure? }
 * The server uses the caregiver-approved snapshot it already stored — the client can't send or change the payload.
 *
 *   201 { receipt }                      saved by the simulated receiver (status "received")
 *   200 { receipt, duplicate: true }     retry with the same key after success — the original receipt, nothing new
 *   400 invalid_request                  malformed body
 *   404 not_found                        no such handoff for this user and case
 *   409 not_reviewed / already_received  not approved yet, or already received under a different key
 *   422 invalid_payload / unknown_source validation failed — nothing changed
 *   502 delivery_failed                  the simulated receiver didn't save it — status Failed, safe to retry
 */
import { z } from "zod";
import type { Database, Principal } from "../db/client";
import type { ReceiverRecord } from "../models";
import { NotFoundError } from "./cases";
import { getHandoffByDisplayId, HandoffError, submitHandoff } from "./handoff-workflow";

export const submitRequest = z
  .object({
    caseId: z.string().uuid(),
    handoffId: z.string().regex(/^HO-[A-Z0-9]{8}$/),
    idempotencyKey: z.string().regex(/^[A-Za-z0-9-]{8,80}$/),
    simulateFailure: z.boolean().optional(),
  })
  .strict();

export interface Receipt {
  handoffId: string;
  receiptId: string | null;
  status: "received" | "acknowledged";
  receivedAt: string;
  payloadSha256: string | null;
  version: number;
  simulated: true;
  message: string;
}

export interface ApiResponse {
  status: number;
  body: { receipt?: Receipt; duplicate?: boolean; error?: string; message?: string; handoffStatus?: string };
}

const STATUS_FOR: Record<string, number> = {
  not_found: 404,
  not_reviewed: 409,
  already_received: 409,
  not_open: 409,
  invalid_payload: 422,
  unknown_source: 422,
  delivery_failed: 502,
};

export function toReceipt(r: ReceiverRecord, displayId: string, version: number): Receipt {
  return {
    handoffId: displayId,
    receiptId: r.receiptCode,
    status: r.acknowledgedAt ? "acknowledged" : "received",
    receivedAt: r.receivedAt,
    payloadSha256: r.payloadSha256,
    version,
    simulated: true,
    message: "Handoff received by the simulated receiver. The approved handoff was saved in this demo. No real care team was contacted.",
  };
}

export async function handleSubmitRequest(db: Database, p: Principal, raw: unknown): Promise<ApiResponse> {
  const parsed = submitRequest.safeParse(raw);
  if (!parsed.success) return { status: 400, body: { error: "invalid_request", message: "The request was not in the expected format. Nothing was sent." } };
  const { caseId, handoffId, idempotencyKey, simulateFailure } = parsed.data;
  let handoff;
  try {
    handoff = await getHandoffByDisplayId(db, p, caseId, handoffId);
  } catch (e) {
    if (e instanceof NotFoundError) return { status: 404, body: { error: "not_found", message: "Handoff not found." } };
    throw e;
  }
  try {
    const r = await submitHandoff(db, p, handoff.id, idempotencyKey, { simulateFailure });
    return { status: r.duplicate ? 200 : 201, body: { receipt: toReceipt(r.receipt, r.handoff.displayId, r.handoff.version), duplicate: r.duplicate } };
  } catch (e) {
    if (e instanceof HandoffError) {
      const now = await getHandoffByDisplayId(db, p, caseId, handoffId);
      return { status: STATUS_FOR[e.code] ?? 400, body: { error: e.code, message: e.message, handoffStatus: now.status } };
    }
    throw e;
  }
}
