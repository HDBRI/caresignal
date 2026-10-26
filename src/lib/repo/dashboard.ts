/** Loads the descriptive Insights dashboard for one case, through the same authorized (RLS) reads as every screen. */
import type { Database, Principal } from "../db/client";
import { computeDashboard, type ChartPeriod, type Dashboard } from "../dashboard";
import { listBaselines } from "./cases";
import { latestEdits, listAlerts, listAnalyses, listObservations } from "./observations";

export async function loadDashboard(db: Database, p: Principal, caseId: string, period: ChartPeriod, now = new Date()): Promise<Dashboard> {
  const [observations, analyses, edits, alerts, baselines] = await Promise.all([
    listObservations(db, p, caseId),
    listAnalyses(db, p, caseId),
    latestEdits(db, p, caseId),
    listAlerts(db, p, caseId),
    listBaselines(db, p, caseId),
  ]);
  return computeDashboard({ observations, analyses, edits, alerts, baselines }, period, now);
}
