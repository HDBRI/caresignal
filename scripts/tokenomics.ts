/**
 * Writes docs/TOKENOMICS.md: measured AI usage (provider-reported) and, separately, ILLUSTRATIVE cost estimates
 * from config/cost-assumptions.json. Run: npm run tokenomics
 *
 * Measured sources: the evaluation run (docs/evaluation/results.json), the one-time demo preparation
 * (synthetic-data/generated/ai-outputs.json) and, if DATABASE_URL is configured, aggregate counts from the app's
 * usage_log (counts and token sums only — no note text, no user identities). No secrets or env values are printed.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnv } from "../src/lib/env";
loadEnv();
import assumptions from "../config/cost-assumptions.json";
import generated from "../synthetic-data/generated/ai-outputs.json";
import { createDatabase } from "../src/lib/db/client";
import { usageSummary, type UsageSummaryRow } from "../src/lib/repo/usage";
import { callCostUsd, estimateForUsers, measuredAverages, perUserMonthly, usd, type Pricing, type UsageAssumptions } from "../src/lib/tokenomics";

const pricing = assumptions.pricing as Pricing;
const a = assumptions.usage as unknown as UsageAssumptions;
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? "not reported" : Math.round(n).toLocaleString("en-US"));

async function hostedUsage(): Promise<UsageSummaryRow[] | null> {
  if (!process.env.DATABASE_URL) return null;
  const db = await createDatabase({ url: process.env.DATABASE_URL });
  try {
    return await usageSummary(db, { ownerId: null });
  } finally {
    await db.close();
  }
}

async function main() {
  const evalPath = path.join(process.cwd(), "docs", "evaluation", "results.json");
  const evalRun = fs.existsSync(evalPath) ? JSON.parse(fs.readFileSync(evalPath, "utf8")) : null;
  type EvalCall = { purpose: string; ok: boolean; usage: { promptTokens: number | null; completionTokens: number | null } | null };
  const evalCalls: EvalCall[] = evalRun?.calls ?? [];
  const evalAvg = measuredAverages(evalCalls.map((c) => ({ purpose: c.purpose, promptTokens: c.usage?.promptTokens ?? null, completionTokens: c.usage?.completionTokens ?? null })));

  type GenUsage = { promptTokens: number | null; completionTokens: number | null } | null;
  const genCalls: { purpose: string; promptTokens: number | null; completionTokens: number | null }[] = [];
  for (const c of Object.values(generated.cases) as { notes: Record<string, { usage: GenUsage }>; insights?: { usage: GenUsage } }[]) {
    for (const n of Object.values(c.notes)) genCalls.push({ purpose: "categorize", promptTokens: n.usage?.promptTokens ?? null, completionTokens: n.usage?.completionTokens ?? null });
    if (c.insights) genCalls.push({ purpose: "insights", promptTokens: c.insights.usage?.promptTokens ?? null, completionTokens: c.insights.usage?.completionTokens ?? null });
  }
  const genAvg = measuredAverages(genCalls);
  const hosted = await hostedUsage().catch(() => null);

  const L: string[] = [];
  L.push("# CareSignal — tokenomics: measured usage and illustrative cost estimates", "");
  L.push(`Generated ${new Date().toISOString()} by \`npm run tokenomics\`. Assumptions: [\`config/cost-assumptions.json\`](../config/cost-assumptions.json) (edit and re-run).`, "");
  L.push("> **Read this first.** Section 1 is **measured**: token counts exactly as the provider returned them. Section 2 is an **illustrative estimate** built from stated assumptions and an **unverified** price. The provider did not return a cost for any call, so no measured cost exists. None of this is a bill.", "");

  L.push("## 1. Measured usage (provider-reported)", "");
  L.push("| Source | Task | Requests | Requests with usage | Input tokens (sum) | Output tokens (sum) | Avg input / call | Avg output / call | Provider-returned cost |");
  L.push("|---|---|---|---|---|---|---|---|---|");
  const sum = (calls: { purpose: string; promptTokens: number | null; completionTokens: number | null }[], p: string, f: "promptTokens" | "completionTokens") =>
    calls.filter((c) => c.purpose === p && c[f] !== null).reduce((n, c) => n + (c[f] as number), 0);
  const evalFlat = evalCalls.map((c) => ({ purpose: c.purpose, promptTokens: c.usage?.promptTokens ?? null, completionTokens: c.usage?.completionTokens ?? null }));
  for (const [src, calls, avg] of [
    [`Evaluation run (${evalRun?.generatedAt?.slice(0, 10) ?? "not run"})`, evalFlat, evalAvg],
    [`Demo preparation, \`npm run seed:ai\` (${(generated as { generatedAt?: string }).generatedAt?.slice(0, 10) ?? "date not recorded"})`, genCalls, genAvg],
  ] as const) {
    for (const [p, label] of [["categorize", "categorization"], ["insights", "insight summary"]] as const) {
      const m = avg[p];
      if (!m) continue;
      L.push(`| ${src} | ${label} | ${m.calls} | ${m.withUsage} | ${fmt(sum(calls as never, p, "promptTokens"))} | ${fmt(sum(calls as never, p, "completionTokens"))} | ${fmt(m.avgInput)} | ${fmt(m.avgOutput)} | not returned |`);
    }
  }
  if (hosted) {
    const label: Record<string, string> = { observation_analysis: "categorization", insights: "insight summary", handoff_draft: "handoff draft", seed_insights: "demo preparation", evaluation: "evaluation" };
    for (const r of hosted) {
      L.push(`| Live app (hosted database, all users, ${r.firstAt?.slice(0, 10) ?? "?"} – ${r.lastAt?.slice(0, 10) ?? "?"}) | ${label[r.purpose] ?? r.purpose} | ${r.requests} | ${r.withUsage} | ${fmt(r.promptTokens)} | ${fmt(r.completionTokens)} | ${r.withUsage ? fmt((r.promptTokens ?? 0) / r.withUsage) : "—"} | ${r.withUsage ? fmt((r.completionTokens ?? 0) / r.withUsage) : "—"} | ${r.providerCostUsd === null ? "not returned" : usd(r.providerCostUsd)} |`);
    }
  } else {
    L.push("| Live app | — | not included (no database configured for this report) | | | | | | |");
  }
  L.push("");
  L.push("- \"Requests\" counts every attempted request; requests where the provider returned no usage are counted but their tokens are **not** guessed (shown as not reported, never 0).");
  L.push("- Output tokens include the model's reasoning tokens, which are billed as output.");
  L.push("- Task types are recorded with each request: categorization, insight summary, handoff draft (a weekly draft that needed a new insight call), and evaluation (kept in the evaluation results file). Only counts, token numbers, model name, status and timestamps are stored — never note text, prompts or keys.", "");

  L.push("## 2. Illustrative cost estimate (assumptions, not measurements)", "");
  L.push(`**Price used: ${pricing.status.toUpperCase()}.** ${pricing.source} Date checked: ${pricing.dateChecked}`, "");
  L.push(`| Price assumption | US$ per 1M tokens |`, `|---|---|`);
  L.push(`| Input | ${pricing.inputUsdPerMillionTokens} |`, `| Cached input | ${pricing.cachedInputUsdPerMillionTokens} |`, `| Output | ${pricing.outputUsdPerMillionTokens} |`, "");
  L.push("**Calculation:** cost of one call = (input tokens × input price + output tokens × output price) ÷ 1,000,000. Cached input is priced lower but none was reported in the measured calls, so the estimate assumes no cached input.", "");
  const catCost = callCostUsd(a.tokensPerCall.categorize, pricing);
  const insCost = callCostUsd(a.tokensPerCall.insights, pricing);
  L.push("| Per call (illustrative) | Input tokens | Output tokens | Cost |", "|---|---|---|---|");
  L.push(`| Categorize one note | ${a.tokensPerCall.categorize.input} | ${a.tokensPerCall.categorize.output} | ${usd(catCost)} |`);
  L.push(`| Insight summary / handoff draft | ${a.tokensPerCall.insights.input} | ${a.tokensPerCall.insights.output} | ${usd(insCost)} |`, "");
  L.push("### Usage assumptions (per active user, per month)", "", "| Assumption | Value | Why |", "|---|---|---|");
  const notes = assumptions.usageNotes as Record<string, string>;
  for (const [k, v] of Object.entries(a)) {
    if (k === "tokensPerCall") continue;
    L.push(`| ${k} | ${v} | ${notes[k] ?? ""} |`);
  }
  L.push(`| tokensPerCall | categorize ${a.tokensPerCall.categorize.input} in / ${a.tokensPerCall.categorize.output} out; insights ${a.tokensPerCall.insights.input} in / ${a.tokensPerCall.insights.output} out | Taken from the measured averages in section 1 (evaluation run). |`, "");
  const per = perUserMonthly(a, pricing);
  L.push("| Task | AI calls / user / month (incl. retries) | Cost / user / month |", "|---|---|---|");
  for (const t of per) L.push(`| ${t.task} | ${t.callsPerUser.toFixed(2)} | ${usd(t.costPerUserUsd)} |`);
  L.push(`| **Total** | **${per.reduce((n, t) => n + t.callsPerUser, 0).toFixed(2)}** | **${usd(per.reduce((n, t) => n + t.costPerUserUsd, 0))}** |`, "");
  L.push("### Report-ready table", "");
  L.push("| | 100 users / month | 10,000 users / month |", "|---|---|---|");
  const e100 = estimateForUsers(100, a, pricing);
  const e10k = estimateForUsers(10_000, a, pricing);
  L.push(`| AI calls | ${fmt(e100.callsPerMonth)} | ${fmt(e10k.callsPerMonth)} |`);
  L.push(`| Input tokens | ${fmt(e100.inputTokensPerMonth)} | ${fmt(e10k.inputTokensPerMonth)} |`);
  L.push(`| Output tokens | ${fmt(e100.outputTokensPerMonth)} | ${fmt(e10k.outputTokensPerMonth)} |`);
  for (const t of e100.byTask) L.push(`| Cost: ${t.task} | ${usd(t.costPerMonthUsd)} | ${usd(e10k.byTask.find((x) => x.task === t.task)!.costPerMonthUsd)} |`);
  L.push(`| **Estimated cost (illustrative)** | **${usd(e100.costPerMonthUsd)}** | **${usd(e10k.costPerMonthUsd)}** |`, "");
  L.push("Model API cost only — hosting, database, storage and staff time are not included. Estimates scale linearly with users; real usage varies by person and would need to be measured.", "");

  L.push("## 3. Cost controls in the app", "");
  L.push("- **Bounded input:** each note is at most 4,000 characters; one insights request includes at most 24,000 characters of note text (the most recent notes; the model is told how many older notes were left out).");
  L.push("- **Bounded output:** at most 1,500 output tokens per categorization and 6,000 per insight request (measured maximums: 295 and 3,199). A response cut off by the limit is treated as a failure, never as a partial answer.");
  L.push("- **No repeat analysis:** a note's original text never changes, so it is categorized once; retries happen only after a failure.");
  L.push("- **Caching by note version, per patient:** an insight request whose exact input (messages, model, prompt version and each note's wording version) matches a saved run for the **same case** reuses that run with no AI call. Adding a note, correcting a note's wording, or any change to the input makes a new request. Lookups are filtered by case and owner, so results are never shared across patients.");
  L.push("- **Explicit regeneration:** \"Regenerate anyway\" on the Insights page makes a new request on purpose; weekly handoff drafts reuse a validated run for the same notes.");
  L.push("- **Concise outputs:** prompts ask for short JSON with at most 5 facts per note and at most 8 insights / 6 questions per summary.");
  L.push("- **Daily caps:** 25 AI requests per user and 500 overall per day (configurable).", "");
  L.push("## 4. Measured vs estimated — in one paragraph", "");
  L.push("Measured: request counts and input/output token counts returned by the provider for the evaluation run, the demo preparation and (when available) the live app. Not measured: cost — the provider returned none. Estimated: everything in section 2, from an unverified stand-in price and assumed usage per user. Change `config/cost-assumptions.json` and re-run `npm run tokenomics` to test other assumptions.");
  fs.writeFileSync(path.join(process.cwd(), "docs", "TOKENOMICS.md"), L.join("\n") + "\n");
  console.log(`Wrote docs/TOKENOMICS.md (100 users ≈ ${usd(e100.costPerMonthUsd)}/month, 10,000 users ≈ ${usd(e10k.costPerMonthUsd)}/month — illustrative)`);
}

main().catch((e) => {
  console.error("tokenomics failed:", (e as Error).message);
  process.exit(1);
});
