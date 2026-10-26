"use server";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { aiStatus, chatJson } from "@/lib/ai/client";
import { categorizeObservation, initialAiState, type CategorizeDeps } from "@/lib/ai/categorize";
import { getActor, principalOf } from "@/lib/auth/session";
import { getDb } from "@/lib/repo/db";
import { upsertCheckin } from "@/lib/repo/checkins";
import { addObservation, addObservationEdit, correctCategories } from "@/lib/repo/observations";
import { evaluateSafety, explainMatches, TIER_GUIDANCE, type SafetyTier } from "@/lib/safety/rules";
import { STATUSES_WITH_NOTE } from "@/lib/repo/checkin-labels";

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
    aiState: string;
  };
}

const aiDeps: CategorizeDeps = { chat: chatJson, available: () => aiStatus() === "available" };

/** Runs after the response is sent; the note is already saved and safety rules already ran. */
function analyzeLater(principal: Parameters<typeof categorizeObservation>[1], observationId: string) {
  after(async () => {
    try {
      await categorizeObservation(await getDb(), principal, observationId, aiDeps);
    } catch {
      console.error("[ai] background categorization failed");
      // Never leave a note stuck in "pending": record an honest failure.
      const { setAiState } = await import("@/lib/repo/observations");
      await setAiState(await getDb(), principal, observationId, "failed").catch(() => undefined);
    }
  });
}

const AI_UNAVAILABLE =
  "AI analysis is currently unavailable. Your observation has been saved. You can continue logging notes and using the prototype's predefined safety rules.";
const AI_PENDING = "AI is suggesting categories now (usually a few seconds). The note is already saved; the label will appear when it's done.";
const AI_LIMIT =
  "AI analysis is temporarily unavailable because the daily limit was reached. Your observation has been saved, and the prototype's predefined safety rules still ran.";

/**
 * Save first, exactly as typed. Safety rules run on the original text inside addObservation,
 * before and independently of any AI. Notes are never capped.
 */
type SavedInfo = NonNullable<AddObservationState["saved"]>;

/**
 * The one save path for observations: exact text first, deterministic safety rules on the original text,
 * then (only if AI is available and under the cap) background AI categorization.
 */
async function saveObservationCore(
  actor: NonNullable<Awaited<ReturnType<typeof getActor>>>,
  caseId: string,
  text: string,
  eventTime: string | null,
  authorLabel: string | null,
): Promise<SavedInfo> {
  const db = await getDb();
  const principal = principalOf(actor);
  const aiState = await initialAiState(db, principal, aiDeps).catch(() => "unavailable_error" as const);
  const { observation, safety, alert } = await addObservation(db, principal, { caseId, text, eventTime, authorLabel, aiState });
  if (aiState === "pending") analyzeLater(principal, observation.id);
  revalidatePath(`/cases/${caseId}`, "layout");
  const guidance = safety.tier ? TIER_GUIDANCE[safety.tier] : null;
  return {
    displayId: observation.displayId,
    alertId: alert?.id ?? null,
    tier: safety.tier,
    guidanceTitle: guidance?.title ?? null,
    guidanceBody: guidance?.body ?? null,
    ruleLabels: safety.matches.map((m) => m.label),
    matched: safety.matches.map((m) => m.matchedText),
    originalText: observation.originalText,
    aiMessage: aiState === "pending" ? AI_PENDING : aiState === "unavailable_limit" ? AI_LIMIT : AI_UNAVAILABLE,
    aiState,
  };
}

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
  const authorLabel = String(fd.get("authorLabel") ?? "").trim() || null;
  try {
    return { ok: true, saved: await saveObservationCore(actor, caseId, text, eventTimeRaw || null, authorLabel) };
  } catch (err) {
    const msg = (err as Error)?.message ?? "";
    if (/future/i.test(msg)) return { error: "\u201cWhen did this happen?\u201d can't be in the future." };
    if (/not found|invalid case/i.test(msg)) return { error: "This case isn't available to you. Your note was not saved." };
    console.error("[observations] save failed");
    return { error: "Something went wrong and the note was not saved. Please try again." };
  }
}

export interface CheckinState {
  ok?: boolean;
  error?: string;
  status?: string;
  /** Deterministic rules applied to the check-in note itself (no AI). */
  noteSafety?: { tier: SafetyTier; title: string; body: string; why: string };
  savedObservation?: SavedInfo;
  observationError?: string;
}

export async function saveCheckinAction(_prev: CheckinState, fd: FormData): Promise<CheckinState> {
  const actor = await getActor();
  if (!actor) return { error: "Your session ended. Please sign in again." };
  const caseId = String(fd.get("caseId") ?? "");
  const status = String(fd.get("status") ?? "");
  const day = String(fd.get("day") ?? "");
  const withNote = (STATUSES_WITH_NOTE as string[]).includes(status);
  const note = withNote ? String(fd.get("note") ?? "") : "";
  if (note.length > 500) return { error: "Keep the check-in note under 500 characters, or add it as an observation instead." };
  try {
    await upsertCheckin(await getDb(), principalOf(actor), { caseId, day, status: status as "no_change", note });
  } catch {
    return { error: "Choose one of the options to save today's check-in." };
  }
  revalidatePath(`/cases/${caseId}`, "layout");
  const result: CheckinState = { ok: true, status };
  if (withNote && note.trim()) {
    const s = evaluateSafety(note);
    if (s.tier) {
      result.noteSafety = {
        tier: s.tier,
        title: TIER_GUIDANCE[s.tier].title,
        body: TIER_GUIDANCE[s.tier].body,
        why: explainMatches(s.matches.map((m) => m.ruleId), s.matches.map((m) => m.matchedText)),
      };
    }
  }
  // Offered, never automatic: only when the caregiver ticked the box and wrote something.
  if (withNote && fd.get("saveAsObservation") === "on" && note.trim()) {
    try {
      result.savedObservation = await saveObservationCore(actor, caseId, note, null, null);
    } catch {
      result.observationError = "The check-in was saved, but the note could not be saved as an observation. Please add it with Add observation.";
    }
  }
  return result;
}

// ---------------- Retry, corrections, edits ----------------

export async function retryAiAction(fd: FormData): Promise<void> {
  const actor = await getActor();
  if (!actor) return;
  const caseId = String(fd.get("caseId") ?? "");
  const observationId = String(fd.get("observationId") ?? "");
  const db = await getDb();
  const principal = principalOf(actor);
  const state = await initialAiState(db, principal, aiDeps).catch(() => "unavailable_error" as const);
  const { setAiState } = await import("@/lib/repo/observations");
  await setAiState(db, principal, observationId, state);
  if (state === "pending") analyzeLater(principal, observationId);
  revalidatePath(`/cases/${caseId}`, "layout");
}

export interface SimpleState {
  ok?: boolean;
  error?: string;
  message?: string;
}

export async function correctCategoriesAction(_prev: SimpleState, fd: FormData): Promise<SimpleState> {
  const actor = await getActor();
  if (!actor) return { error: "Your session ended. Please sign in again." };
  const caseId = String(fd.get("caseId") ?? "");
  const primary = String(fd.get("primary") ?? "");
  const secondary = fd.getAll("secondary").map(String);
  try {
    await correctCategories(await getDb(), principalOf(actor), String(fd.get("observationId") ?? ""), primary, secondary);
    revalidatePath(`/cases/${caseId}`, "layout");
    return { ok: true, message: "Categories updated. The original note and the AI's suggestion are unchanged." };
  } catch {
    return { error: "Choose a main category first." };
  }
}

export async function editObservationAction(_prev: SimpleState, fd: FormData): Promise<SimpleState> {
  const actor = await getActor();
  if (!actor) return { error: "Your session ended. Please sign in again." };
  const caseId = String(fd.get("caseId") ?? "");
  const text = typeof fd.get("text") === "string" ? (fd.get("text") as string) : "";
  if (!text.trim()) return { error: "The corrected wording can't be empty." };
  try {
    const { edit, safety } = await addObservationEdit(await getDb(), principalOf(actor), String(fd.get("observationId") ?? ""), text);
    revalidatePath(`/cases/${caseId}`, "layout");
    const warn =
      safety.tier === "emergency"
        ? " The new wording matches an emergency rule — if this is happening now, call 911."
        : safety.tier
          ? " The new wording matches a prototype safety rule; see the notice."
          : "";
    return { ok: true, message: `Saved as version ${edit.version}. The original wording is kept.${warn}` };
  } catch {
    return { error: "Couldn't save the correction. Please try again." };
  }
}
