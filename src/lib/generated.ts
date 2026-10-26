/**
 * Real AI output generated once for the synthetic demo cases (`npm run seed:ai`).
 * Loaded and validated here; copied into each demo copy as clearly-labeled "prepared with the demo" output.
 * If the file has no entry for a case, that case simply shows no AI output (never a placeholder).
 */
import { z } from "zod";
import raw from "../../synthetic-data/generated/ai-outputs.json";
import { CATEGORY_IDS } from "./categories";

const category = z.enum(CATEGORY_IDS as [string, ...string[]]);
const usage = z
  .object({ promptTokens: z.number().nullable(), cachedTokens: z.number().nullable(), completionTokens: z.number().nullable(), totalTokens: z.number().nullable() })
  .nullable();

const noteOutput = z.object({
  primary: category,
  secondary: z.array(category),
  facts: z.array(z.object({ fact: z.string(), quote: z.string() })),
  modelReported: z.string().nullable(),
  usage,
});

const insightsOutput = z.object({
  modelReported: z.string().nullable(),
  usage,
  rejected: z.number().int(),
  inputSourceIds: z.array(z.string()),
  value: z.object({
    summary: z.string(),
    insights: z.array(
      z.object({
        kind: z.enum(["pattern", "change", "possible_pattern", "conflict"]),
        statement: z.string(),
        support: z.enum(["supported", "possible_unconfirmed", "conflicting"]),
        sourceIds: z.array(z.string()),
        evidence: z.array(z.object({ sourceId: z.string(), quote: z.string() })),
        uncertainty: z.string().nullable(),
        comparesToBaseline: z.boolean(),
      }),
    ),
    unknowns: z.array(z.object({ statement: z.string(), sourceIds: z.array(z.string()) })),
    questions: z.array(z.object({ text: z.string(), sourceIds: z.array(z.string()) })),
  }),
});

const file = z.object({
  synthetic: z.literal(true),
  generatedAt: z.string().nullable(),
  promptVersions: z.object({ categorize: z.string(), insights: z.string() }).optional(),
  cases: z.record(
    z.string(),
    z.object({
      notes: z.record(z.string(), noteOutput),
      insights: insightsOutput.nullable(),
    }),
  ),
});

export type GeneratedCase = z.infer<typeof file>["cases"][string];
export const GENERATED = file.parse(raw);

export function generatedFor(seedKey: string): GeneratedCase | null {
  return GENERATED.cases[seedKey] ?? null;
}
