import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

/** WCAG 2.1 A/AA automated checks (axe-core) on every screen. Automated checks are a floor, not a full audit. */
async function audit(page: Page, label: string) {
  await page.waitForLoadState("networkidle");
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  const problems = results.violations.map((v) => `${label}: ${v.id} (${v.impact}) — ${v.nodes.length} node(s): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
  expect(problems, problems.join("\n")).toEqual([]);
}

async function openDemo(page: Page, name: string) {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Open ${name} demo` }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("public screens pass automated accessibility checks", async ({ page }) => {
  for (const [path, label] of [
    ["/", "Welcome"],
    ["/demo", "Choose a demo case"],
    ["/sign-in", "Sign in"],
    ["/register", "Register"],
    ["/privacy", "Privacy"],
    ["/terms", "Terms"],
  ]) {
    await page.goto(path);
    await audit(page, label);
  }
});

test("every case screen passes automated accessibility checks (incl. an urgent banner)", async ({ page }) => {
  test.setTimeout(240_000);
  await openDemo(page, "Morgan Patel"); // has an unseen emergency banner
  await audit(page, "Overview");
  for (const screen of ["Observations", "Insights", "Handoffs", "Demo receiver", "Settings"]) {
    await page.getByRole("link", { name: screen, exact: true }).first().click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await audit(page, screen);
  }
  await page.getByRole("link", { name: "Observations", exact: true }).first().click();
  await page.getByRole("link", { name: "OBS-C2-08" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "OBS-C2-08" })).toBeVisible();
  await audit(page, "Observation detail");
  await page.getByRole("link", { name: "Handoffs", exact: true }).first().click();
  await page.getByRole("link", { name: /Review this draft/ }).click();
  await expect(page.getByRole("heading", { name: "Summary" })).toBeVisible();
  await audit(page, "Handoff detail");
});

const CASE_SCREENS = ["Overview", "Observations", "Insights", "Handoffs", "Demo receiver", "Settings"];

test("every case screen: persistent synthetic label, no horizontal scrolling on a narrow phone, statuses carry words", async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 375, height: 800 });
  await openDemo(page, "Jordan Lee");
  const base = page.url().replace(/\/overview.*$/, "");
  for (const screen of CASE_SCREENS) {
    await page.goto(`${base}/${screen === "Demo receiver" ? "receiver" : screen.toLowerCase()}`);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByText(/Synthetic demo data · PAT-CANCER-001/).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${screen} scrolls sideways by ${overflow}px`).toBeLessThanOrEqual(1);
    for (const badge of await page.locator(".hs-badge, .kind-tag").all()) expect(((await badge.textContent()) ?? "").trim().length).toBeGreaterThan(2);
  }
});

test("keyboard: skip link first, visible focus ring, and the add-observation dialog is reachable without a mouse", async ({ page }) => {
  await openDemo(page, "Alex Rivera");
  await page.reload();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  const button = page.getByRole("button", { name: "+ Add observation" }).first();
  await button.focus();
  const outline = await button.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe("none");
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("What did you notice?")).toBeFocused();
  await page.keyboard.press("Escape");
});

test("AI unavailable: the app says so honestly and still works (this test server has no AI key)", async ({ page }) => {
  await openDemo(page, "Alex Rivera");
  await expect(page.getByText("AI analysis unavailable — safety rules and note-taking still work")).toBeVisible();
  await page.getByRole("link", { name: "Insights", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.getByRole("link", { name: "Handoffs", exact: true }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Handoffs" })).toBeVisible();
});

test("demo cases are one click apart and each explains what it demonstrates", async ({ page }) => {
  await page.goto("/demo");
  await expect(page.getByRole("heading", { name: "What this case demonstrates" })).toHaveCount(3);
  await page.getByRole("button", { name: "Open Jordan Lee demo" }).click();
  await expect(page.getByText("What this case demonstrates").first()).toBeVisible();
  await page.getByText("Switch demo case").click();
  await page.getByRole("button", { name: /^Alex Rivera — / }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Alex Rivera" })).toBeVisible();
});
