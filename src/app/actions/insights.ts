"use server";
import { redirect } from "next/navigation";
import { aiStatus, chatJson } from "@/lib/ai/client";
import { generateInsights, type Period } from "@/lib/ai/insights";
import { getActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";

const PERIODS: Period[] = ["last7", "last14", "all"];

/** Runs while the caregiver waits (~20–40 s). Only validated output is stored; failures are stored as failed runs. */
export async function generateInsightsAction(fd: FormData): Promise<void> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  const caseId = String(fd.get("caseId") ?? "");
  const period = (PERIODS as string[]).includes(String(fd.get("period"))) ? (String(fd.get("period")) as Period) : "last7";
  let outcome;
  try {
    outcome = await generateInsights(await getDb(), principalOf(actor), caseId, period, {
      chat: chatJson,
      available: () => aiStatus() === "available",
    });
  } catch {
    console.error("[insights] generation failed");
    redirect(`/cases/${caseId}/insights?period=${period}&result=error`);
  }
  if (outcome.status === "empty") redirect(`/cases/${caseId}/insights?period=${period}&result=empty`);
  redirect(`/cases/${caseId}/insights?period=${period}&run=${outcome.runId}`);
}
