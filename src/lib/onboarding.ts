/** Onboarding option lists (shared by forms, validation and display). Blank = "Not provided". */

export const BASELINE_DOMAINS = [
  { id: "mobility_function", label: "Mobility & daily functioning", placeholder: "e.g. walks around the house without help" },
  { id: "eating_drinking", label: "Eating & drinking", placeholder: "e.g. three small meals a day" },
  { id: "energy_sleep", label: "Sleep & energy", placeholder: "e.g. sleeps 7–8 hours, no naps" },
  { id: "mood_communication", label: "Mood & communication", placeholder: "e.g. usually chatty and upbeat" },
  { id: "memory_attention", label: "Memory & attention", placeholder: "e.g. keeps track of appointments" },
  { id: "other", label: "Other concerns", placeholder: "Anything else the caregiver wants to note" },
] as const;
export type BaselineDomain = (typeof BASELINE_DOMAINS)[number]["id"];
export const BASELINE_DOMAIN_IDS = BASELINE_DOMAINS.map((d) => d.id) as BaselineDomain[];

export const AGE_RANGES = [
  { id: "under_18", label: "Under 18" },
  { id: "18_39", label: "18–39" },
  { id: "40_64", label: "40–64" },
  { id: "65_79", label: "65–79" },
  { id: "80_plus", label: "80 or older" },
] as const;

export const CARE_PHASES = [
  { id: "active_treatment", label: "In active treatment" },
  { id: "recovering", label: "Recovering (after a hospital stay, surgery or illness)" },
  { id: "ongoing_condition", label: "Living with an ongoing condition" },
  { id: "comfort_focused", label: "Comfort-focused care" },
  { id: "not_sure", label: "Not sure" },
] as const;

export const CARE_SETTINGS = [
  { id: "home", label: "At home" },
  { id: "home_with_visiting_care", label: "At home with visiting care" },
  { id: "assisted_living", label: "Assisted living" },
  { id: "other", label: "Other" },
  { id: "not_sure", label: "Not sure" },
] as const;

export const NOT_PROVIDED = "Not provided";

export function labelFor(list: readonly { id: string; label: string }[], id: string | null | undefined): string {
  if (!id) return NOT_PROVIDED;
  return list.find((x) => x.id === id)?.label ?? NOT_PROVIDED;
}
