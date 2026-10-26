/** Daily check-ins. A day with no row, or a category with no answer, is "not reported" — never "fine". */
import { z } from "zod";
import { CHECKIN_TOPICS, type CheckinTopic } from "../categories";
import type { Database, Principal } from "../db/client";
import type { CheckinState, DailyCheckin } from "../models";
import { addDays } from "../time";
import { getCase } from "./cases";
import { toCheckin } from "./mappers";

const response = z.union([
  z.object({ state: z.literal("answered"), value: z.string().trim().min(1).max(200) }),
  z.object({ state: z.literal("skipped") }),
]);

export { CHECKIN_STATUSES, NO_RESPONSE_LABEL, checkinStatusLabel } from "./checkin-labels";

export const checkinInput = z.object({
  caseId: z.string().uuid(),
  day: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  status: z.enum(["no_change", "noticed_change", "concern", "skipped"]),
  note: z
    .string()
    .trim()
    .max(500)
    .nullish()
    .transform((v) => (v ? v : null)),
  responses: z.partialRecord(z.enum(CHECKIN_TOPICS as unknown as [string, ...string[]]), response).optional(),
});

export async function upsertCheckin(db: Database, p: Principal, input: z.input<typeof checkinInput>): Promise<DailyCheckin> {
  const data = checkinInput.parse(input);
  await getCase(db, p, data.caseId);
  return db.asPrincipal(p, async (sql) => {
    const [row] = await sql.query(
      `insert into checkins (case_id, owner_id, day, status, note, responses, origin, synthetic)
       values ($1, $2, $3, $4, $5, $6, 'session', true)
       on conflict (case_id, day) do update
         set status = excluded.status, note = excluded.note, responses = excluded.responses, origin = 'session'
       returning *`,
      [data.caseId, p.userId, data.day, data.status, data.note, JSON.stringify(data.responses ?? {})],
    );
    return toCheckin(row);
  });
}

export async function listCheckins(db: Database, p: Principal, caseId: string): Promise<DailyCheckin[]> {
  await getCase(db, p, caseId);
  return db.asPrincipal(p, async (sql) =>
    (await sql.query(`select * from checkins where case_id = $1 and owner_id = $2 order by day`, [caseId, p.userId])).map(toCheckin),
  );
}

/** Explicit state per day and category across a date range, filling gaps with not_reported. */
export function checkinGrid(
  checkins: DailyCheckin[],
  fromDay: string,
  toDay: string,
): { day: string; states: Record<CheckinTopic, CheckinState> }[] {
  const byDay = new Map(checkins.map((c) => [c.day, c]));
  const out: { day: string; states: Record<CheckinTopic, CheckinState> }[] = [];
  for (let d = fromDay; d <= toDay; d = addDays(d, 1)) {
    const c = byDay.get(d);
    const states = Object.fromEntries(
      CHECKIN_TOPICS.map((cat) => [cat, c?.responses[cat]?.state ?? "not_reported"]),
    ) as Record<CheckinTopic, CheckinState>;
    out.push({ day: d, states });
  }
  return out;
}
