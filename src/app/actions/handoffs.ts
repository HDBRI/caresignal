"use server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { aiStatus, chatJson } from "@/lib/ai/client";
import { getActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import {
  acknowledgeHandoff,
  addFictionalResponse,
  approveHandoff,
  createOrRegenerateDraft,
  editDraft,
  HandoffError,
  handoffEditInput,
} from "@/lib/repo/handoff-workflow";
import { evaluateSafety, explainMatches, TIER_GUIDANCE, type SafetyTier } from "@/lib/safety/rules";

export interface HandoffFormState {
  error?: string;
  ok?: string;
  /** Safety rules also run on what the caregiver types into the handoff, so urgent words are never held for it. */
  safety?: { tier: SafetyTier; title: string; body: string; why: string };
}

async function principal() {
  const actor = await getActor();
  if (!actor) redirect("/sign-in");
  return principalOf(actor);
}

const message = (e: unknown, fallback: string) => (e instanceof HandoffError ? e.message : fallback);
const done = (caseId: string) => revalidatePath(`/cases/${caseId}`, "layout");

/** Creates this week's draft or regenerates the open one. Waits for the AI (~20–40 s) when a new summary is needed. */
export async function draftHandoffAction(_prev: HandoffFormState, fd: FormData): Promise<HandoffFormState> {
  const p = await principal();
  const caseId = String(fd.get("caseId") ?? "");
  let outcome;
  try {
    outcome = await createOrRegenerateDraft(await getDb(), p, caseId, { chat: chatJson, available: () => aiStatus() === "available" });
  } catch (e) {
    console.error("[handoff] draft failed");
    return { error: message(e, "The draft could not be created. Your notes are unchanged — please try again.") };
  }
  done(caseId);
  if (outcome.status === "unchanged")
    return {
      error: `Version ${outcome.handoff.version} (${outcome.handoff.displayId}) already covers this period and nothing was added or corrected since it was submitted, so no new draft was made.`,
    };
  redirect(`/cases/${caseId}/handoffs/${outcome.handoff.displayId}?${outcome.status}=1`);
}

const lines = (v: FormDataEntryValue | null) =>
  String(v ?? "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export async function editHandoffAction(_prev: HandoffFormState, fd: FormData): Promise<HandoffFormState> {
  const p = await principal();
  const caseId = String(fd.get("caseId") ?? "");
  const itemCount = Number(fd.get("itemCount") ?? 0);
  const questionCount = Number(fd.get("questionCount") ?? 0);
  const parsed = handoffEditInput.safeParse({
    summary: String(fd.get("summary") ?? ""),
    items: Array.from({ length: itemCount }, (_, i) => ({ statement: String(fd.get(`item-${i}`) ?? ""), remove: fd.get(`item-${i}-remove`) === "on" })),
    questions: Array.from({ length: questionCount }, (_, i) => ({ text: String(fd.get(`question-${i}`) ?? ""), remove: fd.get(`question-${i}-remove`) === "on" })),
    newQuestions: lines(fd.get("newQuestions")).slice(0, 5),
    missingInfo: lines(fd.get("missingInfo")),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Please check the edits." };
  try {
    await editDraft(await getDb(), p, String(fd.get("handoffId") ?? ""), parsed.data);
  } catch (e) {
    return { error: message(e, "Your edits could not be saved. Please try again.") };
  }
  done(caseId);
  const written = [parsed.data.summary, ...parsed.data.items.map((i) => i.statement), ...parsed.data.newQuestions].join("\n");
  const s = evaluateSafety(written);
  const safety =
    s.tier && s.tier !== "review"
      ? { tier: s.tier, title: TIER_GUIDANCE[s.tier].title, body: TIER_GUIDANCE[s.tier].body, why: explainMatches(s.matches.map((m) => m.ruleId), s.matches.map((m) => m.matchedText)) }
      : undefined;
  return { ok: "Edits saved. Review the draft again before approving.", safety };
}

export async function approveHandoffAction(_prev: HandoffFormState, fd: FormData): Promise<HandoffFormState> {
  const p = await principal();
  const caseId = String(fd.get("caseId") ?? "");
  try {
    await approveHandoff(await getDb(), p, String(fd.get("handoffId") ?? ""), fd.get("confirmReviewed") === "on");
  } catch (e) {
    return { error: message(e, "The handoff could not be approved. Please try again.") };
  }
  done(caseId);
  return { ok: "Approved. It has not been sent — submit it when you are ready." };
}

export async function acknowledgeHandoffAction(fd: FormData): Promise<void> {
  const p = await principal();
  const caseId = String(fd.get("caseId") ?? "");
  try {
    await acknowledgeHandoff(await getDb(), p, String(fd.get("handoffId") ?? ""));
  } catch {
    // Already acknowledged or not received: the page shows the current state.
  }
  done(caseId);
}

export async function addFictionalResponseAction(fd: FormData): Promise<void> {
  const p = await principal();
  const caseId = String(fd.get("caseId") ?? "");
  try {
    await addFictionalResponse(await getDb(), p, String(fd.get("handoffId") ?? ""));
  } catch {
    // Not available for this case/status: the page shows the current state.
  }
  done(caseId);
}
