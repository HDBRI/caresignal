"use server";
import { revalidatePath } from "next/cache";
import { aiStatus } from "@/lib/ai/client";
import { getActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { upsertCheckin } from "@/lib/repo/checkins";
import { addObservation } from "@/lib/repo/observations";
import { TIER_GUIDANCE, type SafetyTier } from "@/lib/safety/rules";

export interface AddObservationState {
  ok?: boolean;
  error?: string;
  saved?: {
    displayId: string;
    alertId: string | null;
    tier: SafetyTier | null;
    guidanceTitle: string | null;
    guidanceBody: string | null;
    ruleLabels: string[];
    matched: string[];
    originalText: string;
    aiMessage: string;
  };
}

const AI_UNAVAILABLE =
  "AI analysis is currently unavailable. Your observation has been saved. You can continue logging notes and using the prototype's predefined safety rules.";
const AI_NOT_RUN = "Saved. AI categories are not added yet in this version of the prototype — the predefined safety rules already ran.";

/**
 * Save first, exactly as typed. Safety rules run on the original text inside addObservation,
 * before and independently of any AI. Notes are never capped.
 */
export async function addObservationAction(_prev: AddObservationState, fd: FormData): Promise<AddObservationState> {
  const actor = await getActor();
  if (!actor) return { error: "Your session ended. Please sign in again — your note was not saved." };
  const caseId = String(fd.get("caseId") ?? "");
  const text = typeof fd.get("text") === "string" ? (fd.get("text") as string) : "";
  const eventTimeRaw = String(fd.get("eventTimeIso") ?? "").trim();
  if (!text.trim()) return { error: "Write the observation first — it can't be empty." };
  if (text.length > 4000) return { error: "That note is too long (4,000 characters max). Try splitting it into two." };

  try {
    const { observation, safety, alert } = await addObservation(await getDb(), principalOf(actor), {
      caseId,
      text,
      eventTime: eventTimeRaw || null,
    });
    revalidatePath(`/cases/${caseId}`, "layout");
    const guidance = safety.tier ? TIER_GUIDANCE[safety.tier] : null;
    return {
      ok: true,
      saved: {
        displayId: observation.displayId,
        alertId: alert?.id ?? null,
        tier: safety.tier,
        guidanceTitle: guidance?.title ?? null,
        guidanceBody: guidance?.body ?? null,
        ruleLabels: safety.matches.map((m) => m.label),
        matched: safety.matches.map((m) => m.matchedText),
        originalText: observation.originalText,
        aiMessage: aiStatus() === "available" ? AI_NOT_RUN : AI_UNAVAILABLE,
      },
    };
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (/future/i.test(msg)) return { error: "“When did this happen?” can't be in the future." };
    if (/not found|invalid case/i.test(msg)) return { error: "This case isn't available to you. Your note was not saved." };
    console.error("[observations] save failed");
    return { error: "Something went wrong and the note was not saved. Please try again." };
  }
}

export interface CheckinState {
  ok?: boolean;
  error?: string;
}

export async function saveCheckinAction(_prev: CheckinState, fd: FormData): Promise<CheckinState> {
  const actor = await getActor();
  if (!actor) return { error: "Your session ended. Please sign in again." };
  const caseId = String(fd.get("caseId") ?? "");
  const status = String(fd.get("status") ?? "");
  const day = String(fd.get("day") ?? "");
  try {
    await upsertCheckin(await getDb(), principalOf(actor), {
      caseId,
      day,
      status: status as "no_change",
      note: String(fd.get("note") ?? ""),
    });
    revalidatePath(`/cases/${caseId}`, "layout");
    return { ok: true };
  } catch {
    return { error: "Choose one of the options to save today's check-in." };
  }
}
