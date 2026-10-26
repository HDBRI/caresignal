/**
 * Deterministic checks applied to EVERY piece of AI-written text before it is stored or shown.
 * A statement that fails is never displayed. Checks compare the AI text against the exact
 * caregiver notes it cites, so the model cannot add numbers, dates, diagnoses or trends
 * that the notes do not contain.
 */

export type GuardProblem =
  | "safety_claim"
  | "medication_instruction"
  | "medication_causality"
  | "unsupported_condition"
  | "unsupported_number"
  | "unsupported_date"
  | "secret_or_instructions"
  | "unsupported_trend"
  | "too_long";

const SAFETY_CLAIM =
  /\b(patient is safe|(?:he|she|they|jordan|morgan|alex) (?:is|are|seems?) (?:safe|fine|okay|ok)\b|all clear|nothing to worry|no (?:risk|danger|concern)s?\b|no action (?:is )?needed|not an emergency|no emergency|rule[sd]? out|ruling out|is stable|doing well)/i;

const MEDICATION_INSTRUCTION = [
  /\b(increas|decreas|reduc|lower|rais|stop|start|skip|doubl|halv|cut|chang|adjust|switch|hold|paus|taper|wean)\w*\b[^.?!]{0,40}\b(dose|dosage|doses|medication|medications|medicine|medicines|pill|pills|tablet|tablets|chemo\w*|drug|drugs|prescription)\b/i,
  /\b\d+(?:\.\d+)?\s?(?:mg|mcg|µg|ml|mL|units?|iu)\b/i,
  /\b(?:you|they|the caregiver) should (?:take|give|stop|start|skip|increase|decrease)\b/i,
];

const MEDICATION_CAUSALITY =
  /\b(caused by|because of|due to|side[- ]effects?|result(?:ed|s)? (?:of|from)|reaction to|triggered by|linked to|from the)\b[^.?!]{0,40}\b(medication|medications|medicine|medicines|pill|pills|tablet|tablets|drug|drugs|chemo\w*|treatment|therapy|infusion)\b|\b(medication|medicine|pill|tablet|drug|chemo\w*|treatment|therapy)\b[^.?!]{0,30}\b(is|was|are|were|may be|might be|could be)\s+(causing|making|behind|responsible)/i;

/** Conditions/diagnoses the model must not introduce unless the cited notes literally contain the word. */
const CONDITION_TERMS = [
  "infection", "sepsis", "pneumonia", "dehydration", "dehydrated", "depression", "depressed", "delirium", "dementia",
  "stroke", "heart failure", "anemia", "anaemia", "neutropenia", "embolism", "blood clot", "clot", "uti", "kidney",
  "malnutrition", "malnourished", "fracture", "concussion", "relapse", "recurrence", "progression", "metastas",
  "complication", "diagnos",
];

const SECRET_OR_INSTRUCTIONS = /portkey|api[\s_-]?key|system prompt|my instructions|sk-[a-z0-9]{8,}|as an ai\b|ignore (?:all |previous )/i;

const DATE_TOKENS =
  /\b(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|monday|tuesday|wednesday|thursday|friday|saturday|sunday|yesterday|today|tonight|last night)\b|\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\b/gi;

const TREND = /\b(worsen\w*|getting worse|declin\w*|deteriorat\w*|improv\w*|trend\w*|steadily|progressive\w*|more and more|less and less|downward|upward)\b/i;

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");

export interface GuardContext {
  /** Original text of the notes this statement cites. */
  citedTexts: string[];
  /** How many distinct days the cited notes come from (for trend words). */
  citedDistinctDays?: number;
  maxLength?: number;
}

/** Note IDs (OBS-C1-02) and period day numbers ("day 5", "days 2 and 4") are references we supplied, not claims. */
const REFERENCES = /\bOBS-[A-Z0-9-]+\b|\bdays? \d+(?:\s*(?:and|,|-|–|to)\s*\d+)*(?: of \d+)?\b/gi;

export function checkStatement(text: string, ctx: GuardContext): GuardProblem[] {
  const problems: GuardProblem[] = [];
  const cited = norm(ctx.citedTexts.join(" \n "));
  const t = norm(text.replace(REFERENCES, " "));
  if (text.length > (ctx.maxLength ?? 400)) problems.push("too_long");
  if (SAFETY_CLAIM.test(text)) problems.push("safety_claim");
  if (MEDICATION_INSTRUCTION.some((r) => r.test(text))) problems.push("medication_instruction");
  if (MEDICATION_CAUSALITY.test(text)) problems.push("medication_causality");
  if (CONDITION_TERMS.some((term) => new RegExp(`\\b${term}`, "i").test(t) && !cited.includes(term))) problems.push("unsupported_condition");
  for (const num of t.match(/\d+(?:\.\d+)?/g) ?? []) {
    if (!cited.includes(num)) {
      problems.push("unsupported_number");
      break;
    }
  }
  for (const d of t.match(DATE_TOKENS) ?? []) {
    if (!cited.includes(d.toLowerCase())) {
      problems.push("unsupported_date");
      break;
    }
  }
  if (SECRET_OR_INSTRUCTIONS.test(text)) problems.push("secret_or_instructions");
  if (TREND.test(text) && (ctx.citedDistinctDays ?? 0) < 2) problems.push("unsupported_trend");
  return [...new Set(problems)];
}

/** Is `quote` an exact excerpt of `source` (ignoring only whitespace and curly vs straight quotes)? */
export function isExactQuote(quote: string, source: string): boolean {
  const n = (s: string) => s.replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim().toLowerCase();
  const q = n(quote);
  return q.length >= 3 && n(source).includes(q);
}
