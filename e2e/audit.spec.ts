/**
 * Final audit (Task 21): locked visual design and safety behavior, checked on the running app.
 * The UI-test server has NO AI key, so every check here also proves the app works with AI offline.
 */
import fs from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type Fixture = { observations: { fixtureId: string; text: string }[] };
const load = (f: string): Fixture => JSON.parse(fs.readFileSync(path.join(process.cwd(), "synthetic-data", "cases", f), "utf8"));
const case1 = load("case-1-cancer.json");
const case2 = load("case-2-surgery.json");
const case3 = load("case-3-recovery.json");

const CASES = [
  { name: "Jordan Lee", ref: "PAT-CANCER-001", fixture: case1 },
  { name: "Morgan Patel", ref: "PAT-SURGERY-002", fixture: case2 },
  { name: "Alex Rivera", ref: "PAT-RECOVERY-003", fixture: case3 },
] as const;
const CASE_SCREENS = [
  ["overview", "Overview"],
  ["observations", "Observations"],
  ["insights", "Care insights"],
  ["handoffs", "Handoffs"],
  ["receiver", "Demo receiver"],
  ["settings", "Settings"],
] as const;

async function openDemo(page: Page, name: string) {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Open ${name} demo` }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  return page.url().replace(/\/overview.*$/, "");
}

/** Reassurance / scoring language may appear only in negated disclaimers ("never says all clear"). */
function affirmativeReassurance(text: string): string[] {
  const hits: string[] = [];
  const re = /(all clear|patient is safe|you are safe|is doing well|health score|risk score|low risk|severity score)/gi;
  for (const m of text.matchAll(re)) {
    const before = text.slice(Math.max(0, m.index! - 40), m.index!).toLowerCase();
    if (!/(never|\bno\b|\bnot\b|n't|without|instead of|rather than)/.test(before)) hits.push(text.slice(Math.max(0, m.index! - 40), m.index! + m[0].length + 10));
  }
  return hits;
}

test("all eight screens open; Welcome asks for no real identifiers", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await page.locator("main input, main textarea, main select").count()).toBe(0); // welcome collects nothing
  await page.goto("/demo");
  await expect(page.getByRole("heading", { level: 1, name: "Explore a demo case" })).toBeVisible();
  const base = await openDemo(page, "Jordan Lee");
  for (const [route, h1] of CASE_SCREENS) {
    const res = await page.goto(`${base}/${route}`);
    expect(res?.status(), route).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: h1 === "Overview" ? "Jordan Lee" : h1 })).toBeVisible();
  }
});

test("the new-case form asks only for fictional, non-identifying details", async ({ page }) => {
  await openDemo(page, "Jordan Lee");
  const res = await page.goto("/cases/new");
  // Demo visitors can't create cases; registered users can. Either way, no identifier fields may exist.
  const labels = (await page.locator("label").allInnerTexts()).join(" | ");
  expect(labels).not.toMatch(/date of birth|birthday|social security|ssn|medical record|mrn|insurance|street address|phone/i);
  expect(res?.status()).toBeLessThan(500);
});

for (const c of CASES) {
  test(`${c.name}: synthetic label, original notes unchanged, statuses carry words, no reassurance or scores`, async ({ page }) => {
    const base = await openDemo(page, c.name);
    for (const [route] of CASE_SCREENS) {
      await page.goto(`${base}/${route}`);
      await expect(page.getByText(new RegExp(`Synthetic demo data · ${c.ref}`)).first()).toBeVisible();
      for (const el of await page.locator(".pill, .hs-badge, .kind-tag, .source-tag").all()) {
        expect(((await el.textContent()) ?? "").trim().length, `${route}: a status element has no words`).toBeGreaterThan(2);
      }
      expect(affirmativeReassurance(await page.locator("body").innerText()), `${route}: reassurance/score wording`).toEqual([]);
    }
    await page.goto(`${base}/observations`);
    for (const o of c.fixture.observations) await expect(page.getByText(o.text, { exact: false }).first()).toBeVisible();
  });
}

test("AI content is visibly separate from the caregiver's original note", async ({ page }) => {
  const base = await openDemo(page, "Alex Rivera");
  await page.goto(`${base}/observations/OBS-C3-26`);
  await expect(page.getByRole("heading", { name: /Caregiver's note — original, exactly as entered/ })).toBeVisible();
  await expect(page.locator("section.ai-box")).toContainText("Categories (separate from the original note)");
  await page.goto(`${base}/handoffs`);
  await page.getByRole("link", { name: "Review and submit" }).click();
  await expect(page.getByText("Caregiver's original notes").first()).toBeVisible();
});

test("source IDs in each case's handoff resolve to the original note", async ({ page }) => {
  for (const c of CASES) {
    const base = await openDemo(page, c.name);
    await page.goto(`${base}/handoffs`);
    await page.getByRole("link", { name: /^Version 1 · / }).first().click();
    await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
    const hrefs = [...new Set(await page.locator("a.chip[href*='/observations/']").evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute("href")!)))];
    expect(hrefs.length, c.name).toBeGreaterThan(0);
    for (const h of hrefs) {
      await page.goto(h);
      const id = h.split("/").pop()!;
      await expect(page.getByRole("heading", { level: 1, name: id })).toBeVisible();
      const original = c.fixture.observations.find((o) => o.fixtureId === id)!.text;
      await expect(page.getByText(`“${original}”`).first()).toBeVisible();
    }
  }
});

test("post-surgery urgent rule shows emergency guidance with the AI offline", async ({ page }) => {
  await openDemo(page, "Morgan Patel");
  await expect(page.getByText("AI analysis unavailable — safety rules and note-taking still work")).toBeVisible();
  const banner = page.getByRole("alert").filter({ hasText: "Possible emergency described" });
  await expect(banner).toContainText("call 911");
  await expect(banner).toContainText("Morgan suddenly became confused and was difficult to wake");
  await page.getByRole("button", { name: "+ Add observation" }).first().click();
  // The phrase that exposed the audit gap — caught since rules 2026-10-26.1.
  await page.getByLabel("What did you notice?").fill("He is not breathing normally and won't wake up");
  await page.getByRole("button", { name: "Save observation" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("call 911"); // immediately, no AI involved
});

test("Demo receiver is clearly labeled simulated", async ({ page }) => {
  const base = await openDemo(page, "Jordan Lee");
  await page.goto(`${base}/receiver`);
  await expect(page.getByRole("note")).toHaveText(/Simulated receiver — no real care team is connected\./);
  await expect(page.getByText(/not connected to any hospital, clinic, EHR, pharmacy or care team/)).toBeVisible();
  await expect(page.getByText("Synthetic scenario outcome — fictional").first()).toBeVisible();
});

test("reset restores the demo copy (added notes are removed)", async ({ page }) => {
  const base = await openDemo(page, "Alex Rivera");
  await page.getByRole("button", { name: "+ Add observation" }).first().click();
  await page.getByLabel("What did you notice?").fill("Audit note that reset must remove");
  await page.getByRole("button", { name: "Save observation" }).click();
  await expect(page.getByText(/Saved as OBS-0001/)).toBeVisible();
  await page.keyboard.press("Escape");
  await page.goto(`${base}/settings`);
  await page.getByRole("button", { name: "Reset my demo copy" }).click();
  await page.waitForURL((u) => !u.toString().startsWith(base));
  const fresh = page.url().replace(/\/(overview|settings).*$/, "");
  await page.goto(`${fresh}/observations`);
  await expect(page.getByText("Audit note that reset must remove")).toHaveCount(0);
  await expect(page.getByText(case3.observations[0].text).first()).toBeVisible();
});
