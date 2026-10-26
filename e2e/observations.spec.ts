import { expect, test, type Page } from "@playwright/test";

async function openDemo(page: Page, name: "Jordan Lee" | "Morgan Patel" | "Alex Rivera") {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Open ${name} demo` }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("logging a note: exact text, optional author, honest AI state, appears in the timeline", async ({ page }) => {
  await openDemo(page, "Alex Rivera");
  await page.getByRole("button", { name: "+ Add observation" }).first().click();
  const text = "Ate  half a muffin — said it was \"too dry\".";
  await page.getByLabel("What did you notice?").fill(text);
  await page.getByLabel("Who noticed this? (optional)").fill("Jamie (brother)");
  await page.getByRole("button", { name: "Save observation" }).click();
  await expect(page.getByRole("heading", { name: "Observation saved" })).toBeVisible();
  // The UI-test server runs with AI disabled, so the dialog must say "unavailable", never "analyzed".
  await expect(page.getByText("AI analysis is currently unavailable. Your observation has been saved.")).toBeVisible();
  await page.getByRole("button", { name: "Done" }).click();

  await page.getByRole("link", { name: "Observations" }).first().click();
  await expect(page.getByRole("heading", { level: 1, name: "Observations" })).toBeVisible();
  await page.getByLabel("Search notes").fill("muffin");
  await page.getByRole("button", { name: "Search" }).click();
  const item = page.locator("article").filter({ hasText: "muffin" });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText(`“${text}”`);
  await expect(item).toContainText("By Jamie (brother)");
  await expect(item).toContainText("Unavailable — AI is not available right now; note saved");
  await expect(item).toContainText("Added by you");
});

test("correcting categories and wording keeps the original note", async ({ page }) => {
  await openDemo(page, "Jordan Lee");
  await page.goto(page.url().replace("/overview", "/observations/OBS-C1-04"));
  await expect(page.getByRole("heading", { level: 1, name: "OBS-C1-04" })).toBeVisible();
  await expect(page.getByText("Not analyzed — seeded example")).toBeVisible();

  await page.getByText("Set the categories yourself").click();
  await page.getByRole("radio", { name: "Eating & drinking" }).check();
  await page.getByRole("checkbox", { name: "Symptoms & comfort" }).check();
  await page.getByRole("button", { name: "Save my categories" }).click();
  await expect(page.getByText("Categories updated. The original note and the AI's suggestion are unchanged.")).toBeVisible();
  await expect(page.getByText("Your correction (in use):")).toBeVisible();

  await page.getByText("Correct the wording (keeps the original)").click();
  await page.getByLabel("Corrected wording").fill("Felt queasy after lunch. Drank about 3 glasses of water, not 2.");
  await page.getByRole("button", { name: "Save as new version" }).click();
  await expect(page.getByText(/Saved as version 2\. The original wording is kept\./)).toBeVisible();
  await page.reload();
  await expect(page.getByText("Felt queasy after lunch. Only drank about 2 glasses of water all day.").first()).toBeVisible();
  await expect(page.getByText(/Version 2 · edited/)).toBeVisible();
});

test("timeline separates 'no observation logged' from 'caregiver reported no meaningful change'", async ({ page }) => {
  await openDemo(page, "Jordan Lee");
  await page.getByRole("button", { name: "No meaningful change" }).waitFor({ state: "detached" }).catch(() => undefined);
  await page.getByRole("radio", { name: "No meaningful change" }).check();
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText("Check-in saved for today.")).toBeVisible();
  await page.getByRole("link", { name: "Observations" }).first().click();
  const today = page.locator("li").filter({ has: page.getByRole("heading", { name: /^Today/ }) });
  await expect(today).toContainText("No observation logged");
  await expect(today).toContainText("caregiver reported “No meaningful change”");
  await expect(today).toContainText("No note was written, but the caregiver’s check-in reported no meaningful change.");
  // Day -2 in the Jordan Lee scenario has neither a note nor a check-in
  await expect(page.getByText("No response recorded").first()).toBeVisible();
});
