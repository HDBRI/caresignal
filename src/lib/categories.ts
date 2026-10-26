/**
 * The seven observation categories (allowlist, locked in Task 10). AI output may only use these ids.
 * Categories describe WHAT a note is about — they are not clinical judgments.
 */
export const CATEGORIES = [
  { id: "mobility_daily_functioning", label: "Mobility and daily functioning", hint: "Walking, transfers, dressing, everyday tasks" },
  { id: "physical_symptoms_comfort", label: "Physical symptoms and comfort", hint: "Pain, nausea, tiredness, breathing, dizziness, wounds" },
  { id: "cognition_communication", label: "Cognition and communication", hint: "Alertness, confusion, memory, speaking, understanding" },
  { id: "emotional_wellbeing_behavior", label: "Emotional wellbeing and behavior", hint: "Mood, worry, frustration, social contact" },
  { id: "sleep_nutrition_hydration", label: "Sleep, nutrition and hydration", hint: "Sleep and naps, meals, appetite, fluids" },
  { id: "treatment_care_coordination", label: "Treatment and care coordination", hint: "Medicines taken (as reported), visits, calls, appointments" },
  { id: "other", label: "Other", hint: "Anything that fits none of the above" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as string[]).includes(value);
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Unknown category";
}

/**
 * Optional per-topic detail keys inside a check-in (legacy detail; the daily status is the main signal).
 * Kept separate from observation categories on purpose.
 */
export const CHECKIN_TOPICS = ["eating_drinking", "energy_sleep", "mobility_function", "mood_cognition"] as const;
export type CheckinTopic = (typeof CHECKIN_TOPICS)[number];
/** @deprecated use CHECKIN_TOPICS */
export const CHECKIN_CATEGORIES = CHECKIN_TOPICS;
