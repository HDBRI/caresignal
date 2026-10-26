/**
 * Generates REAL gpt-6-luna output for the three synthetic demo cases, once:
 *   - categories + facts for every seeded note
 *   - one insight run (last 7 days) per case
 * Every output passes the same validation as live output, and insights must also meet the case's
 * expected outcome (checkCaseExpectations). Anything that fails is NOT stored for that note/case.
 * Writes synthetic-data/generated/ai-outputs.json with the provider-reported model and token usage.
 *
 * Usage: npm run seed:ai                (all cases)
 *        npm run seed:ai -- PAT-RECOVERY-003   (one case; keeps the others)
 * Runs against an in-memory database; never touches local or hosted data. Synthetic data only.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { aiStatus, chatJson } from "../src/lib/ai/client";
import { buildCategorizeMessages, CATEGORIZE_PROMPT_VERSION, validateCategorization } from "../src/lib/ai/categorize";
import { checkCaseExpectations } from "../src/lib/ai/case-expectations";
import { buildInsightInput, buildInsightMessages, INSIGHTS_PROMPT_VERSION, validateInsightOutput } from "../src/lib/ai/insights";
import { createDatabase } from "../src/lib/db/client";
import { migrate } from "../src/lib/db/migrate";
import { SEED_CASES } from "../src/lib/fixtures";
import { copySeedToUserCase, ensureLocalDemoUsers } from "../src/lib/repo/seed";

const OUT = path.join(process.cwd(), "synthetic-data", "generated", "ai-outputs.json");
const only = process.argv.slice(2).filter((a) => a.startsWith("PAT-"));

async function main() {
  if (aiStatus() !== "available") {
    console.error("PORTKEY_API_KEY is not set — nothing generated (no placeholder output is ever written).");
    process.exit(1);
  }
  const existing = JSON.parse(fs.readFileSync(OUT, "utf8"));
  const db = await createDatabase({ dataDir: null });
  await migrate(db);
  await ensureLocalDemoUsers(db, SEED_CASES);
  const uid = randomUUID();
  await db.asAdmin((sql) => sql.query(`insert into auth.users (id, email) values ($1, 'seed-ai@example.test')`, [uid]));
  const p = { userId: uid, demoSessionId: null };
  const totals = { calls: 0, prompt: 0, cached: 0, completion: 0 };
  const add = (u: { promptTokens: number | null; cachedTokens: number | null; completionTokens: number | null } | null) => {
    totals.calls += 1;
    totals.prompt += u?.promptTokens ?? 0;
    totals.cached += u?.cachedTokens ?? 0;
    totals.completion += u?.completionTokens ?? 0;
  };

  for (const fixture of SEED_CASES) {
    if (only.length && !only.includes(fixture.seedKey)) continue;
    console.log(`\n== ${fixture.seedKey} (${fixture.patient.pseudonym}, synthetic)`);
    const notes: Record<string, unknown> = {};
    for (const o of fixture.observations) {
      const r = await chatJson(buildCategorizeMessages(o.text));
      add(r.usage);
      if (!r.ok) {
        console.log(`  ${o.fixtureId}: call failed (${r.reason}) — not stored`);
        continue;
      }
      const v = validateCategorization(r.content, o.text);
      if (!v) {
        console.log(`  ${o.fixtureId}: output failed validation — not stored`);
        continue;
      }
      notes[o.fixtureId] = { ...v, modelReported: r.modelReported, usage: r.usage };
      console.log(`  ${o.fixtureId}: ${[v.primary, ...v.secondary].join(", ")} · ${v.facts.length} facts`);
    }

    const caseId = await copySeedToUserCase(db, p, fixture.seedKey);
    const input = await buildInsightInput(db, p, caseId, "last7");
    let insights: unknown = null;
    for (let attempt = 1; attempt <= 2 && !insights; attempt++) {
      const r = await chatJson(buildInsightMessages(input));
      add(r.usage);
      if (!r.ok) {
        console.log(`  insights attempt ${attempt}: call failed (${r.reason})`);
        continue;
      }
      const v = validateInsightOutput(r.content, input);
      if (!v.ok) {
        console.log(`  insights attempt ${attempt}: rejected (${v.reason})`);
        continue;
      }
      const exp = checkCaseExpectations(fixture.seedKey, v.value);
      if (exp.hard.length) {
        console.log(`  insights attempt ${attempt}: missed expected outcome: ${exp.hard.join("; ")}`);
        continue;
      }
      if (exp.soft.length) console.log(`  note: ${exp.soft.join("; ")}`);
      insights = { modelReported: r.modelReported, usage: r.usage, rejected: v.rejected.length, inputSourceIds: input.notes.map((n) => n.id), value: v.value };
      console.log(`  insights: ${v.value.insights.length} insights, ${v.value.questions.length} questions, ${v.value.unknowns.length} unknowns, ${v.rejected.length} statements removed by checks`);
    }
    if (!insights) console.log("  insights: NOT stored (no output passed every check) — the demo will show no insights for this case");
    existing.cases[fixture.seedKey] = { notes, insights };
  }

  existing.generatedAt = new Date().toISOString();
  existing.promptVersions = { categorize: CATEGORIZE_PROMPT_VERSION, insights: INSIGHTS_PROMPT_VERSION };
  fs.writeFileSync(OUT, JSON.stringify(existing, null, 2) + "\n");
  await db.close();
  console.log(`\nWrote ${path.relative(process.cwd(), OUT)}`);
  console.log(`Provider-reported usage: ${totals.calls} calls · ${totals.prompt} input (${totals.cached} cached) · ${totals.completion} output tokens`);
}

main().catch((err) => {
  console.error(`seed:ai failed: ${err instanceof Error ? err.message : "unknown error"}`);
  process.exit(1);
});
