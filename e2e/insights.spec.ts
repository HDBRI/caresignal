import { expect, test, type Page } from "@playwright/test";

async function openInsights(page: Page, name: "Jordan Lee" | "Morgan Patel" | "Alex Rivera") {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Open ${name} demo` }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.goto(page.url().replace(/\/overview.*$/, "/insights"));
  await expect(page.getByRole("heading", { level: 1, name: "Care insights" })).toBeVisible();
}

test("chart period selector updates metrics and charts; raw IDs are not shown", async ({ page }) => {
  await openInsights(page, "Jordan Lee");
  const metric = page.getByTestId("metric-observations");
  await expect(metric).toHaveText("7"); // one seeded note is 7 days back, outside "Last 7 days"
  await expect(page.getByRole("heading", { level: 3, name: "Mobility and daily functioning" })).toBeVisible();
  for (const name of ["Physical symptoms and comfort", "Cognition and communication", "Emotional wellbeing and behavior", "Sleep, nutrition and hydration", "Treatment and care coordination", "Other"]) {
    await expect(page.getByRole("heading", { level: 3, name, exact: true })).toBeVisible();
  }
  await page.getByRole("link", { name: "All history" }).click();
  await expect(metric).toHaveText("8");
  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(metric).toHaveText("8");
  // No raw observation IDs in ordinary visible text
  const visible = await page.locator("main").innerText();
  expect(visible).not.toMatch(/OBS-[A-Z0-9]+-\d+/);
});

test("a chart bar opens the exact supporting notes; keyboard Escape closes and returns focus; link opens the record", async ({ page }) => {
  await openInsights(page, "Jordan Lee");
  const bar = page.getByRole("button", { name: /^Oct \d+: 1 logged observation about mobility and daily functioning$/ }).first();
  await bar.focus();
  await page.keyboard.press("Enter");
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await expect(drawer).toContainText("1 supporting observation");
  await expect(drawer.locator("blockquote")).toHaveCount(1);
  await page.keyboard.press("Escape");
  await expect(drawer).toBeHidden();
  await expect(bar).toBeFocused();
  await bar.click();
  await drawer.getByRole("link", { name: "Open the full record" }).click();
  await expect(page.getByText("Caregiver's note — original, exactly as entered", { exact: false })).toBeVisible();
});

test("findings are labeled by source; AI output is separate and states its own period", async ({ page }) => {
  await openInsights(page, "Alex Rivera");
  const changes = page.locator("section").filter({ has: page.getByRole("heading", { name: "Changes worth reviewing" }) });
  await expect(changes.getByText("From your records").first()).toBeVisible();
  await expect(changes.getByText("AI interpretation").first()).toBeVisible();
  await expect(changes.getByText("Reports conflict — both kept")).toBeVisible();
  await expect(page.getByText(/Detailed analysis — prepared with the demo/)).toBeVisible();
  await page.getByText(/Detailed analysis — prepared with the demo/).click();
  await expect(page.getByText(/which may not match the chart period/)).toBeVisible();
  // AI is disabled on the UI-test server: the page says so and charts still render.
  await expect(page.getByText("AI analysis unavailable", { exact: true })).toBeVisible();
  await expect(page.locator(".chart-card")).toHaveCount(7);
});

test("urgent safety guidance stays at the top and is attached to AI items citing the urgent note", async ({ page }) => {
  await openInsights(page, "Morgan Patel");
  await expect(page.getByRole("alert").filter({ hasText: "Possible emergency described" })).toBeVisible();
  const changes = page.locator("section").filter({ has: page.getByRole("heading", { name: "Changes worth reviewing" }) });
  await expect(changes.getByText("Safety rule · urgent")).toBeVisible();
  await expect(changes.getByText(/A note behind this matched an urgent safety rule/).first()).toBeVisible();
});

test("small screens: charts stack and the drawer is usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openInsights(page, "Jordan Lee");
  await page.getByRole("button", { name: /Review these notes/ }).first().click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();
});
