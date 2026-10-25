/**
 * Deterministic safety rules — prototype only.
 *
 * Runs on the caregiver's ORIGINAL note text, immediately on save, with no AI and
 * no network. It covers a small, predefined set of phrases. It does NOT detect
 * every emergency, and no match does NOT mean the situation is safe.
 *
 * Isomorphic: no server-only imports, so it can also run in the browser.
 */

export type SafetyTier = "emergency" | "contact_care_team" | "review";

export interface SafetyRule {
  id: string;
  tier: SafetyTier;
  label: string;
  patterns: RegExp[];
}

export interface SafetyMatch {
  ruleId: string;
  tier: SafetyTier;
  label: string;
  matchedText: string;
}

export interface SafetyResult {
  /** Highest tier matched, or null when no predefined rule matched. */
  tier: SafetyTier | null;
  matches: SafetyMatch[];
  rulesVersion: string;
}

export const RULES_VERSION = "2026-10-25.1";

export const SAFETY_LIMITATION =
  "These prototype rules cover a small predefined set of phrases. No alert does not mean the situation is safe.";

export const NO_MATCH_MESSAGE =
  "No predefined rule matched — this does not mean the situation is safe.";

export const TIER_GUIDANCE: Record<SafetyTier, { title: string; body: string }> = {
  emergency: {
    title: "Possible emergency described",
    body: "If this is happening now, call 911 and follow the dispatcher's instructions.",
  },
  contact_care_team: {
    title: "Contact the care team promptly",
    body: "This note describes something the prototype's rules flag for prompt contact with an appropriate care professional.",
  },
  review: {
    title: "Please review this note",
    body: "This note mentions something worth reviewing. Consider whether the care team should know.",
  },
};

const TIER_RANK: Record<SafetyTier, number> = { emergency: 3, contact_care_team: 2, review: 1 };

export const SAFETY_RULES: SafetyRule[] = [
  // ---------- Emergency ----------
  {
    id: "EMG-BREATHING",
    tier: "emergency",
    label: "Breathing difficulty",
    patterns: [
      /\b(trouble|difficulty|difficult|hard|struggling|struggled|labou?red)\s+(time\s+)?(breathing|to breathe|breathe)\b/i,
      /\bbreathing\s+(seem(ed|s)?\s+|was\s+|is\s+|got\s+|became\s+)?(very\s+|really\s+)?(difficult|hard|labou?red|laboured|shallow and fast)\b/i,
      /\b(can'?t|cannot|could ?n'?t|unable to)\s+(catch\s+(his|her|their|my)\s+)?breath(e)?\b/i,
      /\bgasping\b/i,
      /\bshort(ness)? of breath\b/i,
    ],
  },
  {
    id: "EMG-HARD-TO-WAKE",
    tier: "emergency",
    label: "Difficult to wake or unresponsive",
    patterns: [
      /\b(hard|difficult|impossible|unable)\s+to\s+wake\b/i,
      /\b(won'?t|wouldn'?t|will not|would not|didn'?t|did not)\s+wake\s+up\b/i,
      /\bcould ?n'?t\s+wake\s+(him|her|them)\b/i,
      /\bunresponsive\b/i,
      /\bnot\s+responding\b/i,
    ],
  },
  {
    id: "EMG-CHEST",
    tier: "emergency",
    label: "Chest pain or pressure",
    patterns: [/\bchest\s+(pain|pressure|tightness)\b/i],
  },
  {
    id: "EMG-BLUE",
    tier: "emergency",
    label: "Blue or grey lips or face",
    patterns: [/\b(lips|face)\s+(look(ed|s)?\s+|turned\s+|went\s+|are\s+|were\s+)?(blue|bluish|grey|gray)\b/i],
  },
  {
    id: "EMG-SEIZURE",
    tier: "emergency",
    label: "Seizure",
    patterns: [/\bseizures?\b/i, /\bconvuls(ing|ion|ions|ed)\b/i],
  },
  {
    id: "EMG-FAINT",
    tier: "emergency",
    label: "Fainting or collapse",
    patterns: [/\b(fainted|passed out|collapsed|lost consciousness)\b/i],
  },

  // ---------- Contact care team ----------
  {
    id: "CTC-FEVER",
    tier: "contact_care_team",
    label: "Fever",
    patterns: [/\bfever\b/i, /\btemp(erature)?\s+(of\s+|was\s+|is\s+)?(10[1-9]|100\.[4-9])\b/i],
  },
  {
    id: "CTC-BLEEDING",
    tier: "contact_care_team",
    label: "Bleeding",
    patterns: [/\bbleeding\b/i, /\bblood\s+(soaked|through)\b/i],
  },
  {
    id: "CTC-WOUND",
    tier: "contact_care_team",
    label: "Wound looks infected",
    patterns: [/\b(wound|incision|dressing)\b[^.]{0,40}\b(red|swollen|pus|oozing|smells|hot)\b/i],
  },
  {
    id: "CTC-FLUIDS",
    tier: "contact_care_team",
    label: "Unable to keep fluids down",
    patterns: [
      /\b(can'?t|cannot|could ?n'?t|unable to)\s+keep\s+(any\s+)?(fluids|water|liquids|anything)\s+down\b/i,
      /\bvomit(ing|ed)\s+(all day|all night|repeatedly|several times|many times)\b/i,
    ],
  },
  {
    id: "CTC-URINE",
    tier: "contact_care_team",
    label: "Not passing urine",
    patterns: [/\b(no|hasn'?t|has not|hasn't had any)\s+(urine|peed|urinated)\b/i],
  },

  // ---------- Review ----------
  {
    id: "REV-CONFUSION",
    tier: "review",
    label: "Confusion",
    patterns: [/\bconfus(ed|ion)\b/i, /\bdisoriented\b/i],
  },
  {
    id: "REV-DIZZY",
    tier: "review",
    label: "Dizziness",
    patterns: [/\bdizz(y|iness)\b/i, /\blight-?headed\b/i],
  },
  {
    id: "REV-FALL",
    tier: "review",
    label: "Fall",
    patterns: [/\b(fell|fall|fallen|tripped)\b/i],
  },
  {
    id: "REV-WEAKER",
    tier: "review",
    label: "Noticeably weaker",
    patterns: [/\b(much|a lot|way|very)\s+weaker\b/i],
  },
  {
    id: "REV-NOT-EATING",
    tier: "review",
    label: "Not eating or drinking",
    patterns: [/\b(not|isn'?t|wasn'?t|hasn'?t been|barely)\s+(eating|drinking)\b/i, /\bskipped\s+(all\s+)?(meals|breakfast|lunch|dinner)\b/i],
  },
];

/**
 * Negation cues checked in a short window before the match within the same
 * clause, e.g. "no trouble breathing", "denies chest pain", "without a fever".
 */
const NEGATION = /\b(no|not|denies|denied|without|never|free of|negative for)\b[^.;,!?]{0,25}$/i;

function isNegated(text: string, index: number): boolean {
  const window = text.slice(Math.max(0, index - 30), index);
  return NEGATION.test(window);
}

export function evaluateSafety(originalText: string): SafetyResult {
  const matches: SafetyMatch[] = [];
  for (const rule of SAFETY_RULES) {
    for (const pattern of rule.patterns) {
      const re = new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g");
      let m: RegExpExecArray | null;
      let hit: SafetyMatch | null = null;
      while ((m = re.exec(originalText)) !== null) {
        // "not responding"/"not eating" style patterns contain their own negation word.
        const selfNegating = /^(not|no|isn|wasn|hasn|barely)\b/i.test(m[0]);
        if (selfNegating || !isNegated(originalText, m.index)) {
          hit = { ruleId: rule.id, tier: rule.tier, label: rule.label, matchedText: m[0] };
          break;
        }
      }
      if (hit) {
        matches.push(hit);
        break; // one match per rule is enough
      }
    }
  }
  const tier = matches.reduce<SafetyTier | null>(
    (best, m) => (best === null || TIER_RANK[m.tier] > TIER_RANK[best] ? m.tier : best),
    null,
  );
  return { tier, matches, rulesVersion: RULES_VERSION };
}
