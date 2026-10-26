import { expect, test, type Page } from "@playwright/test";

const SIDEBAR = ["Overview", "Observations", "Insights", "Handoffs", "Demo receiver", "Settings"];

async function openDemo(page: Page, name: "Jordan Lee" | "Morgan Patel" | "Alex Rivera") {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Open ${name} demo` }).click();
  await expect(page).toHaveURL(/\/cases\/[0-9a-f-]+\/overview/);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("private routes redirect signed-out visitors to sign-in", async ({ page }) => {
  await page.goto("/cases");
  await expect(page).toHaveURL(/\/sign-in/);
  await page.goto("/cases/00000000-0000-4000-8000-000000000000/overview");
  await expect(page).toHaveURL(/\/sign-in/);
});

test("public pages stay public", async ({ page }) => {
  for (const path of ["/", "/demo", "/terms", "/privacy", "/sign-in"]) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test("demo entry lands on Overview with the locked sidebar, and every screen opens", async ({ page }) => {
  await openDemo(page, "Jordan Lee");
  const nav = page.getByRole("navigation").filter({ has: page.getByRole("link", { name: "Overview" }) }).first();
  await expect(nav.getByRole("link")).toHaveText(SIDEBAR);
  await expect(page.getByText("Demo mode — synthetic data only; shared demo data may be reset")).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add observation" }).first()).toBeVisible();

  const headings: Record<string, string> = {
    Observations: "Observations",
    Insights: "Insights",
    Handoffs: "Handoffs",
    "Demo receiver": "Demo receiver",
    Settings: "Settings",
    Overview: "Jordan Lee",
  };
  for (const [link, heading] of Object.entries(headings)) {
    await nav.getByRole("link", { name: link }).click();
    await expect(page.getByRole("heading", { level: 1, name: heading })).toBeVisible();
    await expect(nav.getByRole("link", { name: link })).toHaveAttribute("aria-current", "page");
    // "Add observation" stays available on every screen
    await expect(page.getByRole("button", { name: "+ Add observation" }).first()).toBeVisible();
  }
});

test("Overview shows stored data: check-in statuses, handoff status (ID hidden until clicked), baseline", async ({ page }) => {
  await openDemo(page, "Jordan Lee");
  await expect(page.getByText("Received and acknowledged by the simulated care team")).toBeVisible();
  const idToggle = page.getByText("Show handoff ID");
  await expect(page.getByText(/^HO-[A-Z0-9]{8}$/)).toBeHidden();
  await idToggle.click();
  await expect(page.getByText(/^HO-[A-Z0-9]{8}$/)).toBeVisible();
  await expect(page.getByLabel("Check-in status for the last 7 days")).toContainText("No response recorded");
  await expect(page.getByLabel("Check-in status for the last 7 days")).toContainText("I have a concern or question");
  await expect(page.getByText("Not provided").first()).toBeVisible();
});

test("case switching never mixes patients' records", async ({ page }) => {
  await openDemo(page, "Jordan Lee");
  await page.getByRole("link", { name: "Observations" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Observations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "OBS-C1-01", exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Switch demo case" }).click();
  await openDemo(page, "Alex Rivera");
  await page.getByRole("link", { name: "Observations" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Observations" })).toBeVisible();
  await expect(page.getByRole("link", { name: "OBS-C3-06", exact: true }).first()).toBeVisible();
  expect(await page.getByRole("link", { name: /^OBS-C3-\d\d$/ }).count()).toBeGreaterThanOrEqual(9);
  await expect(page.getByText(/OBS-C1-\d\d/)).toHaveCount(0);
  await expect(page.getByText(/OBS-C2-\d\d/)).toHaveCount(0);
});

test("an emergency note shows guidance immediately and a banner on every screen until seen", async ({ page }) => {
  await openDemo(page, "Alex Rivera");
  await page.getByRole("button", { name: "+ Add observation" }).first().click();
  await page.getByLabel("What did you notice?").fill("He is having trouble breathing right now");
  await page.getByRole("button", { name: "Save observation" }).click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText("call 911");
  await expect(dialog).toContainText("He is having trouble breathing right now");
  await page.getByRole("button", { name: "Close (keep the notice showing)" }).click();

  for (const link of ["Insights", "Settings"]) {
    await page.getByRole("link", { name: link }).first().click();
    await expect(page.getByRole("alert").filter({ hasText: "Possible emergency described" })).toBeVisible();
  }
  await page.getByRole("alert").getByRole("button", { name: "I've seen this" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Possible emergency described" })).toHaveCount(0);
  // The note itself is still there
  await page.getByRole("link", { name: "Observations" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Observations" })).toBeVisible();
  await expect(page.getByText("He is having trouble breathing right now")).toBeVisible();
});

test("narrow screens use an accessible collapsed menu", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openDemo(page, "Morgan Patel");
  const menu = page.getByText("Menu", { exact: true });
  await expect(menu).toBeVisible();
  await menu.click();
  await page.getByRole("link", { name: "Handoffs" }).last().click();
  await expect(page.getByRole("heading", { level: 1, name: "Handoffs" })).toBeVisible();
});

test("keyboard users can skip to main content", async ({ page }) => {
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
});
