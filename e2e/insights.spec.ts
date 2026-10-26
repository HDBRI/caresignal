import { expect, test, type Page } from "@playwright/test";

const CATEGORIES = [
  "Mobility and daily functioning",
  "Physical symptoms and comfort",
  "Cognition and communication",
  "Emotional wellbeing and behavior",
  "Sleep, nutrition and hydration",
  "Other",
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
  await expect(metric).toHaveText("29"); // opens on the last 30 days of the month of notes
  await page.getByRole("navigation", { name: "Chart period" }).getByRole("link", { name: "Last 7 days" }).click();
  await expect(metric).toHaveText("6"); // one day in the last week has no note
  await expectAllSevenCategories(page);
  await page.getByRole("navigation", { name: "Chart period" }).getByRole("link", { name: "All history" }).click();
  await expect(metric).toHaveText("30");
  await expectAllSevenCategories(page);
  await expect(page.getByTestId("comparison-note")).toContainText("no earlier period to compare");
  await page.getByRole("navigation", { name: "Chart period" }).getByRole("link", { name: "Last 30 days" }).click();
  await expect(metric).toHaveText("29");
  await expect(page.getByTestId("comparison-note")).toContainText("reliable comparison can't be made");
  expect(posts, "changing the chart period must not call the AI or any server action").toEqual([]);
  const visible = await page.locator("main").innerText();
  expect(visible).not.toMatch(/OBS-[A-Z0-9]+-\d+/);
});

test("a chart bar opens the exact supporting notes; keyboard Escape closes and returns focus; link opens the record", async ({ page }) => {
  await openInsights(page, "Jordan Lee");
  await page.getByRole("navigation", { name: "Chart period" }).getByRole("link", { name: "Last 7 days" }).click(); // daily bars
  const bar = page.getByRole("button", { name: /^\w+ \d+: 1 note about [^—]+ — open them$/ }).first();
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
  // Monthly dataset: no AI run was prepared for these notes, so nothing AI-generated is shown as if it were.
  await expect(page.getByText(/Detailed analysis — prepared with the demo/)).toHaveCount(0);
  // AI is disabled on the UI-test server: the page says so and every category is still shown from stored data.
  await expect(page.getByText("AI analysis unavailable", { exact: true })).toBeVisible();
  await expectAllSevenCategories(page);
});

test("urgent safety guidance stays at the top and in the safety group", async ({ page }) => {
  await openInsights(page, "Morgan Patel");
  await expect(page.getByRole("alert").filter({ hasText: "Possible emergency described" })).toBeVisible();
  await page.getByRole("navigation", { name: "Chart period" }).getByRole("link", { name: "All history" }).click(); // the urgent note is two weeks back in the month
  await expect(page.getByRole("alert").filter({ hasText: "Possible emergency described" })).toBeVisible();
  const safety = page.locator(".group-safety");
  await expect(safety.getByRole("heading", { level: 4, name: /Possible emergency described/ })).toBeVisible();
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
  await openInsights(page, "Morgan Patel"); // Morgan's seeded weekly draft is open; only this week's notes can be added
  const insightsUrl = page.url();
  await page.getByRole("link", { name: "Handoffs", exact: true }).first().click();
  await page.getByRole("link", { name: /Review this draft|Review and submit/ }).first().click();
  await page.getByRole("button", { name: "Regenerate from latest notes" }).click(); // the draft now covers all of this week's notes
  await expect(page.getByText("Draft regenerated from your latest notes.")).toBeVisible();
  await page.goto(insightsUrl.replace(/\?.*$/, "") + "?range=7d"); // this week's findings
  await page.getByRole("button", { name: "Add to this week's handoff" }).first().click();
  await expect(page.getByText(/Added to this week's draft \(HO-[A-Z0-9]{8}\)\. Nothing was sent/)).toBeVisible();
  await page.getByRole("link", { name: "Open the draft" }).click();
  await expect(page.getByText("Added by you from Insights").first()).toBeAttached(); // listed in the collapsed item section of the structured draft
  await expect(page.getByText("Draft — not sent").first()).toBeVisible();
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

test("pattern detection: changes over time with a documented treatment event, without claiming cause; structured handoff", async ({ page }) => {
  await openInsights(page, "Jordan Lee");
  const pat = page.locator("section.patterns");
  await expect(pat.getByRole("heading", { name: "What appears to be changing" })).toBeVisible();
  await page.getByRole("navigation", { name: "Chart period" }).getByRole("link", { name: "All history" }).click();
  // The dated treatment visit comes from the synthetic scenario timeline, labelled as such, never as a cause.
  await expect(pat.getByRole("heading", { name: "Treatment and care timeline" })).toBeVisible();
  await expect(pat).toContainText("Treatment visit");
  await expect(pat.getByText("Synthetic scenario timeline").first()).toBeVisible();
  expect(await pat.innerText()).not.toMatch(/caused by|due to|side effect|OBS-C1-\d\d/);
  await page.getByRole("link", { name: "Handoffs", exact: true }).first().click();
  await page.getByRole("button", { name: "Draft this week's handoff" }).click();
  await expect(page.getByRole("heading", { name: "B. Key patterns by category" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Key patterns by category" })).toBeVisible();
});
