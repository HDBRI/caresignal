/** Captures the pattern-detection screens (Insights + structured handoff) from the running local app. No new AI calls:
 * Case 1's handoff reuses the validated run prepared with the demo. Output: docs/report/img/5x-*.jpg */
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.REPORT_BASE ?? "http://localhost:3001";
const IMG = path.join(process.cwd(), "docs", "report", "img");
const css = "nextjs-portal{display:none!important} [class*='topbar'],.receiver-banner{position:static!important}";
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
page.setDefaultTimeout(120_000);
await page.goto(`${BASE}/demo`);
await page.getByRole("button", { name: "Open Jordan Lee demo" }).click();
await page.waitForURL(/\/overview/);
const base = page.url().replace(/\/overview.*$/, "");
await page.goto(`${base}/insights`);
await page.addStyleTag({ content: css });
await page.locator("section.patterns").screenshot({ path: path.join(IMG, "50-insights-patterns.jpg"), type: "jpeg", quality: 80 });
await page.goto(`${base}/handoffs`);
await page.getByRole("button", { name: "Draft this week's handoff" }).click();
await page.waitForURL(/\/handoffs\/HO-/);
await page.addStyleTag({ content: css });
await page.locator("section", { has: page.locator("#summary-h") }).screenshot({ path: path.join(IMG, "51-structured-handoff.jpg"), type: "jpeg", quality: 80 });
console.log("ok", page.url());
await browser.close();
