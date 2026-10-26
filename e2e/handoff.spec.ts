import { expect, test } from "@playwright/test";

test("handoff: recovery case keeps the conflicting meal reports; review, edit, approve, then submit to the simulated receiver", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Open Alex Rivera demo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Alex Rivera" })).toBeVisible();
  await page.getByRole("link", { name: "Handoffs" }).first().click();
  await page.getByRole("link", { name: "Review and submit" }).click();

  // Regenerate from the stored notes + validated AI output (no AI call needed: the run for these notes is reused).
  await page.getByRole("button", { name: "Regenerate from latest notes" }).click();
  await expect(page.getByText("Draft regenerated from your latest notes.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Submit to the simulated receiver" })).toHaveCount(0); // not before approval

  const conflicts = page.locator("div").filter({ has: page.getByRole("heading", { name: /Conflicting reports/ }) }).last();
  await expect(conflicts.getByRole("link", { name: "OBS-C3-06" })).toBeVisible();
  await expect(conflicts.getByRole("link", { name: "OBS-C3-07" })).toBeVisible();
  await conflicts.getByText("Show the original notes (2)").click();
  await expect(conflicts.getByText(/full plate of pasta/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uncertain, missing or unknown" })).toBeVisible();

  await page.getByText("Edit the draft").click();
  await page.getByRole("textbox", { name: "Summary" }).fill("Edited summary: please see the meal reports, which disagree.");
  await page.getByRole("button", { name: "Save edits" }).click();
  await expect(page.getByText("Edits saved. Review the draft again before approving.")).toBeVisible();
  await expect(page.getByText("Written / edited by you")).toBeVisible();

  await page.getByLabel("I have read this draft and checked it against the source notes.").check();
  await page.getByRole("button", { name: "Approve handoff (does not send it)" }).click();
  await page.getByRole("button", { name: "Submit to the simulated receiver" }).click();
  await expect(page.getByText(/Handoff received by the simulated receiver\. The approved handoff was saved in this demo\. No real care team was contacted\./)).toBeVisible();

  await page.getByRole("link", { name: "Demo receiver" }).first().click();
  await page.getByRole("button", { name: /Acknowledge receipt/ }).first().click();
  await expect(page.getByText(/^Acknowledged /).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /fictional receiver response/ })).toHaveCount(0); // Case 1 only
});
