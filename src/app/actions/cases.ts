"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { getActor, principalOf } from "@/lib/auth/session";
import { isSeedKey } from "@/lib/fixtures";
import { BASELINE_DOMAINS } from "@/lib/onboarding";
import { createUserCase, newCaseInput, updateCaseDetails, type NewCaseInput } from "@/lib/repo/cases";
import { getDb } from "@/lib/repo/db";
import { copySeedToUserCase } from "@/lib/repo/seed";
import type { FormState } from "./auth";

const str = (fd: FormData, k: string) => (typeof fd.get(k) === "string" ? (fd.get(k) as string) : "");

function caseInputFrom(fd: FormData): NewCaseInput {
  return {
    pseudonym: str(fd, "pseudonym"),
    caregiverName: str(fd, "caregiverName"),
    caregiverRelationship: str(fd, "caregiverRelationship"),
    ageRange: str(fd, "ageRange"),
    primaryCondition: fd.get("conditionNotSure") === "on" ? "Not sure" : str(fd, "primaryCondition"),
    carePhase: str(fd, "carePhase"),
    careSetting: str(fd, "careSetting"),
    careContext: str(fd, "careContext"),
    milestones: str(fd, "milestones"),
    baselines: BASELINE_DOMAINS.map((d) => ({ category: d.id, description: str(fd, `baseline_${d.id}`) })),
  };
}

function zodErrors(err: ZodError): FormState["errors"] {
  const out: Record<string, string> = {};
  for (const i of err.issues) out[String(i.path[0] ?? "form")] ??= i.message;
  return out;
}

export async function createCase(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  if (actor.kind !== "registered") return { errors: { form: "Demo visitors can't create private cases. Create an account to do that." } };
  const input = caseInputFrom(fd);
  const parsed = newCaseInput.safeParse(input);
  if (!parsed.success) return { errors: zodErrors(parsed.error), values: Object.fromEntries([...fd.entries()].map(([k, v]) => [k, String(v)])) };
  const c = await createUserCase(await getDb(), principalOf(actor), input);
  redirect(`/cases/${c.id}/overview?created=1`);
}

export async function startFromScenario(fd: FormData): Promise<void> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  const seedKey = str(fd, "seedKey");
  if (actor.kind !== "registered" || !isSeedKey(seedKey)) redirect("/cases");
  const caseId = await copySeedToUserCase(await getDb(), principalOf(actor), seedKey);
  redirect(`/cases/${caseId}/overview?copied=1`);
}

export async function saveCaseDetails(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  const caseId = str(fd, "caseId");
  const input = caseInputFrom(fd);
  const parsed = newCaseInput.safeParse(input);
  if (!parsed.success) return { errors: zodErrors(parsed.error) };
  await updateCaseDetails(await getDb(), principalOf(actor), caseId, input);
  return { message: "Saved." };
}

export async function saveBaselineAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  const caseId = str(fd, "caseId");
  const { saveBaselines } = await import("@/lib/repo/cases");
  await saveBaselines(
    await getDb(),
    principalOf(actor),
    caseId,
    BASELINE_DOMAINS.map((d) => ({ category: d.id, description: str(fd, `baseline_${d.id}`) })),
  );
  return { message: "Baseline saved. Blank areas show as “Not provided”." };
}

export async function saveReminderAction(fd: FormData): Promise<void> {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  const caseId = str(fd, "caseId");
  const { setReminderPref } = await import("@/lib/repo/cases");
  await setReminderPref(await getDb(), principalOf(actor), caseId, str(fd, "reminderPref") === "in_app_daily" ? "in_app_daily" : "off");
  const { revalidatePath } = await import("next/cache");
  revalidatePath(`/cases/${caseId}`, "layout");
}
