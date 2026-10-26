import { expect, test, type Page } from "@playwright/test";

async function openDemo(page: Page, name: "Jordan Lee" | "Morgan Patel" | "Alex Rivera") {
  await page.goto("/demo");
  await page.getByRole("button", { name: `Open ${name} demo` }).click();
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

test("check-in: 'Skip today' is stored as its own answer, distinct from no response", async ({ page }) => {
  await openDemo(page, "Morgan Patel");
  await expect(page.getByText("A check-in is not a substitute for urgent care.")).toBeVisible();
  await page.getByRole("radio", { name: "Skip today" }).check();
  await expect(page.getByLabel("What did you notice? (optional)")).toHaveCount(0); // no note for skip
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText("Saved: Skipped today.")).toBeVisible();
  const week = page.getByLabel("Check-in status for the last 7 days");
  await expect(week).toContainText("Today: Skipped today");
  await expect(week).toContainText("No response recorded");
});

test("check-in: a change note can optionally be saved as an observation (exact text, safety rules run)", async ({ page }) => {
  await openDemo(page, "Alex Rivera");
  await page.getByRole("radio", { name: "I have a concern or question" }).check();
  const note = "Seemed very confused this evening and didn't recognize the hallway.";
  await page.getByLabel("What did you notice? (optional)").fill(note);
  await page.getByLabel(/Also save this as an observation/).check();
  await page.getByRole("button", { name: "Save check-in" }).click();
  await expect(page.getByText("Saved: I have a concern or question.")).toBeVisible();
  await expect(page.getByText(/Also saved as observation OBS-0001, exactly as written\./)).toBeVisible();
  await page.getByRole("link", { name: "Observations" }).first().click();
  const item = page.locator("article").filter({ hasText: "recognize the hallway" });
  await expect(item).toContainText(`“${note}”`);
  await expect(item).toContainText("Please review"); // confusion matched a predefined review rule
});

test("reminder: off by default, in-app only, one chosen time", async ({ page }) => {
  await openDemo(page, "Jordan Lee");
  await page.getByRole("link", { name: "Settings" }).first().click();
  await expect(page.getByRole("radio", { name: "Off (default)" })).toBeChecked();
  await expect(page.getByText(/does not send email, text messages, push or phone notifications/)).toBeVisible();
  await page.getByRole("radio", { name: "In-app reminder once a day" }).check();
  await page.getByLabel("Show it after (your local time)").fill("00:01");
  await page.getByRole("button", { name: "Save reminder preference" }).click();
  await expect(page.getByText("In-app reminder saved.")).toBeVisible();
  // Jordan's demo has no check-in today, so the in-app note shows on the Overview — and logging is not blocked.
  await page.getByRole("link", { name: "Overview" }).first().click();
  await expect(page.getByText(/In-app reminder \(12:01 AM\):/)).toBeVisible();
  await expect(page.getByRole("button", { name: "+ Add observation" }).first()).toBeEnabled();
});
