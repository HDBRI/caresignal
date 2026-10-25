"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { markAlertSeen } from "@/lib/repo/observations";

/** "I've seen this" — records that the alert was seen. Does not delete the note or mark anything resolved. */
export async function markSeen(fd: FormData): Promise<void> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  const alertId = String(fd.get("alertId") ?? "");
  const caseId = String(fd.get("caseId") ?? "");
  await markAlertSeen(await getDb(), principalOf(actor), alertId);
  revalidatePath(`/cases/${caseId}`, "layout");
}
