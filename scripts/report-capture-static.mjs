/** Re-captures screens without sticky bars overlapping (no AI calls). Output: docs/report/img/*.jpg */
import path from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.env.REPORT_BASE ?? "http://localhost:3001";
const IMG = path.join(process.cwd(), "docs", "report", "img");
const css = "nextjs-portal{display:none!important} [class*='topbar'],.receiver-banner{position:static!important}";
const browser = await chromium.launch();

async function openDemo(name, width = 1280) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, deviceScaleFactor: 1.5 });
  const page = await ctx.newPage();
  page.setDefaultTimeout(90_000);
  await page.goto(`${BASE}/demo`);
  await page.getByRole("button", { name: `Open ${name} demo` }).click();
  await page.waitForURL(/\/cases\/[0-9a-f-]+\/overview/);
  await page.getByRole("heading", { level: 1, name }).waitFor();
  await page.addStyleTag({ content: css });
  return { page, base: page.url().replace(/\/overview.*$/, "") };
}
const snap = async (page, name) => {
  await page.addStyleTag({ content: css });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(IMG, `${name}.jpg`), type: "jpeg", quality: 80 });
};

{
  const { page, base } = await openDemo("Morgan Patel");
  await snap(page, "20-urgent-banner");
  await page.goto(`${base}/observations/OBS-C2-08`);
  await snap(page, "22-urgent-note-detail");
  await page.context().close();
}
{
  const { page, base } = await openDemo("Jordan Lee");
  await page.goto(`${base}/receiver`);
  await snap(page, "23-receiver-banner");
  await page.context().close();
}
await browser.close();
console.log("ok");
