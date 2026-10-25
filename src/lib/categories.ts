/**
 * The seven observation categories (allowlist). AI output may only use these ids.
 * Categories describe WHAT a note is about — they are not clinical judgments.
 */
export const CATEGORIES = [
  { id: "eating_drinking", label: "Eating & drinking", hint: "Meals, appetite, fluids" },
  { id: "energy_sleep", label: "Energy & sleep", hint: "Tiredness, naps, night sleep" },
  { id: "mobility_function", label: "Mobility & daily function", hint: "Walking, dressing, everyday tasks" },
  { id: "symptoms_comfort", label: "Symptoms & comfort", hint: "Pain, nausea, breathing, wound, dizziness" },
  { id: "mood_cognition", label: "Mood & thinking", hint: "Mood, worry, confusion, alertness" },
  { id: "medications_treatment", label: "Medications & treatment", hint: "What was taken or done, as reported — never advice" },
  { id: "care_coordination", label: "Care coordination", hint: "Visits, calls, appointments, questions" },
] as const;

export type CategoryId = (typeof CATEGORIES)[number]["id"];

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export function isCategoryId(value: unknown): value is CategoryId {
  return typeof value === "string" && (CATEGORY_IDS as string[]).includes(value);
}

export function categoryLabel(id: string): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? "Unknown category";
}

/** Daily check-in asks about four of the categories. Unanswered = not reported. */
export const CHECKIN_CATEGORIES: CategoryId[] = ["eating_drinking", "energy_sleep", "mobility_function", "mood_cognition"];
