import { expect, test, type Page } from "@playwright/test";

const CATEGORIES = [
  "Mobility and daily functioning",
  "Physical symptoms and comfort",
  "Cognition and communication",
  "Emotional wellbeing and behavior",
  "Sleep, nutrition and hydration",
  "Treatment and care coordination",
  "Other",
];

async function openInsights(page: Page, name: "Jordan Lee" | "Morgan Patel" | "Alex Rivera") {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Open ${name} demo` }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
  await page.goto(page.url().replace(/\/overview.*$/, "/insights"));
  await expect(page.getByRole("heading", { level: 1, name: "Care insights" })).toBeVisible();
}

/** Every one of the seven categories is shown: as a chart, or in the compact "no notes in this period" strip. */
async function expectAllSevenCategories(page: Page) {
  const strip = page.getByTestId("empty-categories");
  for (const name of CATEGORIES) {
    const asChart = await page.getByRole("heading", { level: 3, name, exact: true }).count();
    const asEmpty = (await strip.count()) ? await strip.getByRole("link", { name, exact: true }).count() : 0;
    expect(asChart + asEmpty, name).toBe(1);
  }
}

test("chart period selector updates metrics and charts, makes no AI or server-action request, and shows no raw IDs", async ({ page }) => {
  await openInsights(page, "Jordan Lee");
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(r.url());
  });
  const metric = page.getByTestId("metric-observations");
  await expect(metric).toHaveText("7"); // one seeded note is 7 days back, outside "Last 7 days"
  await expectAllSevenCategories(page);
  await page.getByRole("link", { name: "All history" }).click();
  await expect(metric).toHaveText("8");
  await expectAllSevenCategories(page);
  await expect(page.getByTestId("comparison-note")).toContainText("no earlier period to compare");
  await page.getByRole("link", { name: "Last 30 days" }).click();
  await expect(metric).toHaveText("8");
  await expect(page.getByTestId("comparison-note")).toContainText("reliable comparison can't be made");
  expect(posts, "changing the chart period must not call the AI or any server action").toEqual([]);
  const visible = await page.locator("main").innerText();
  expect(visible).not.toMatch(/OBS-[A-Z0-9]+-\d+/);
});

test("a chart bar opens the exact supporting notes; keyboard Escape closes and returns focus; link opens the record", async ({ page }) => {
  await openInsights(page, "Jordan Lee");
  const bar = page.getByRole("button", { name: /^Oct \d+: 1 note about mobility and daily functioning — open them$/ }).first();
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

test("changes worth reviewing are split into four labeled groups; conflicts are kept; charts work without AI", async ({ page }) => {
  await openInsights(page, "Alex Rivera");
  const changes = page.locator("section").filter({ has: page.getByRole("heading", { name: "Changes worth reviewing" }) });
  for (const g of ["Safety notices · predefined rules, not AI", "From your records · counts, not health measures", "AI interpretations · check them against the notes", "Conflicting or missing information"]) {
    await expect(changes.getByRole("heading", { level: 3, name: g })).toBeVisible();
  }
  await expect(changes.getByText("Reports conflict — both are kept")).toBeVisible();
  await expect(changes.getByRole("button", { name: /^Review supporting notes \(\d+\)$/ }).first()).toBeVisible();
  await expect(page.getByText(/Detailed analysis — prepared with the demo/)).toBeVisible();
  await page.getByText(/Detailed analysis — prepared with the demo/).click();
  await expect(page.getByText(/which may not match the chart period/)).toBeVisible();
  // AI is disabled on the UI-test server: the page says so and every category is still shown from stored data.
  await expect(page.getByText("AI analysis unavailable", { exact: true })).toBeVisible();
  await expectAllSevenCategories(page);
});

test("urgent safety guidance stays at the top and in the safety group, and is attached to AI items citing the urgent note", async ({ page }) => {
  await openInsights(page, "Morgan Patel");
  await expect(page.getByRole("alert").filter({ hasText: "Possible emergency described" })).toBeVisible();
  const safety = page.locator(".group-safety");
  await expect(safety.getByRole("heading", { level: 4, name: /Possible emergency described/ })).toBeVisible();
  await expect(page.getByText(/A note behind this matched an urgent safety rule/).first()).toBeVisible();
});

test("adding a note and correcting its category updates the charts", async ({ page }) => {
  await openInsights(page, "Alex Rivera");
  const insightsUrl = page.url();
  const metric = page.getByTestId("metric-observations");
  const before = Number(await metric.innerText());
  await expect(page.getByTestId("empty-categories").getByRole("link", { name: "Other", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "+ Add observation" }).first().click();
  await page.getByLabel("What did you notice?").fill("The power went out for an hour this evening.");
  await page.getByRole("button", { name: "Save observation" }).click();
  await expect(page.getByText(/OBS-0001|Saved/).first()).toBeVisible();

  await page.goto(insightsUrl);
  await expect(metric).toHaveText(String(before + 1));
  await expect(page.getByText(/no category yet/)).toBeVisible(); // no AI on this server: counted, not charted

  await page.goto(insightsUrl.replace(/\/insights.*$/, "/observations/OBS-0001"));
  await page.getByText("Set the categories yourself").click();
  await page.getByRole("radio", { name: "Other" }).check();
  await page.getByRole("button", { name: "Save my categories" }).click();
  await expect(page.getByText(/Categories updated/)).toBeVisible();

  await page.goto(insightsUrl);
  await expect(page.getByRole("heading", { level: 3, name: "Other", exact: true })).toBeVisible();
  await expect(metric).toHaveText(String(before + 1));
});

test("a finding can be added to the open weekly draft — never sent, approval cleared", async ({ page }) => {
  await openInsights(page, "Alex Rivera");
  await page.getByRole("button", { name: "Add to this week's handoff" }).first().click();
  await expect(page.getByText(/Added to this week's draft \(HO-[A-Z0-9]{8}\)\. Nothing was sent/)).toBeVisible();
  await page.getByRole("link", { name: "Open the draft" }).click();
  await expect(page.getByText("Added by you from Insights").first()).toBeVisible();
  await expect(page.getByText("Draft — not sent").first()).toBeVisible(); // the seeded approved draft returned to draft
  await expect(page.getByRole("button", { name: "Submit to the simulated receiver" })).toHaveCount(0);
});

test("small screens: charts stack and the drawer is usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openInsights(page, "Jordan Lee");
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(1);
  await page.getByRole("button", { name: /Review supporting notes/ }).first().click();
  const drawer = page.getByRole("dialog");
  await expect(drawer).toBeVisible();
  await drawer.getByRole("button", { name: "Close" }).click();
  await expect(drawer).toBeHidden();
});
