/**
 * Handoff and receiver reads. The submit/acknowledge state machine is added with the Handoffs screen;
 * the storage it needs (approved payload, idempotency key, history, receipt) is already in the schema.
 */
import type { Database, Principal } from "../db/client";
import type { Handoff, HandoffStatusEvent, InsightRun, Insight, ReceiverRecord, ReceiverResponse } from "../models";
import { getCase } from "./cases";
import { toHandoff, toInsight, toInsightRun, toReceiverRecord, toReceiverResponse, toStatusEvent } from "./mappers";

export interface HandoffBundle {
  handoff: Handoff;
  history: HandoffStatusEvent[];
  receipt: ReceiverRecord | null;
  responses: ReceiverResponse[];
}

export async function listHandoffs(db: Database, p: Principal, caseId: string): Promise<HandoffBundle[]> {
  await getCase(db, p, caseId);
  return db.asPrincipal(p, async (sql) => {
    const handoffs = (
      await sql.query(`select * from handoffs where case_id = $1 and owner_id = $2 order by created_at desc`, [caseId, p.userId])
    ).map(toHandoff);
    const out: HandoffBundle[] = [];
    for (const h of handoffs) {
      const history = (await sql.query(`select * from handoff_status_history where handoff_id = $1 order by at`, [h.id])).map(toStatusEvent);
      const receipts = (await sql.query(`select * from receiver_records where handoff_id = $1`, [h.id])).map(toReceiverRecord);
      const responses = (await sql.query(`select * from receiver_responses where handoff_id = $1 order by at`, [h.id])).map(toReceiverResponse);
      out.push({ handoff: h, history, receipt: receipts[0] ?? null, responses });
    }
    return out;
  });
}

export async function listInsightRuns(db: Database, p: Principal, caseId: string): Promise<{ run: InsightRun; insights: Insight[] }[]> {
  await getCase(db, p, caseId);
  return db.asPrincipal(p, async (sql) => {
    const runs = (
      await sql.query(`select * from insight_runs where case_id = $1 and owner_id = $2 order by created_at desc`, [caseId, p.userId])
    ).map(toInsightRun);
    const out: { run: InsightRun; insights: Insight[] }[] = [];
    for (const run of runs) {
      const insights = (await sql.query(`select * from insights where run_id = $1 order by position`, [run.id])).map(toInsight);
      out.push({ run, insights });
    }
    return out;
  });
}
