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

  // Structured handoff: the conflict is listed under uncertainty; the validated AI interpretations are in a collapsed section.
  await expect(page.getByRole("heading", { name: "B. Key patterns by category" })).toBeVisible();
  await expect(page.getByText(/Conflicting reports \(eating\)/).first()).toBeVisible();
  await page.getByText(/AI interpretations, validated against the notes/).click();
  const conflicts = page.locator("div").filter({ has: page.getByRole("heading", { name: /Conflicting reports/ }) }).last();
  await expect(conflicts.getByRole("link", { name: "OBS-C3-06" })).toBeVisible();
  await expect(conflicts.getByRole("link", { name: "OBS-C3-07" })).toBeVisible();
  await conflicts.getByText("Show the original notes (2)").click();
  await expect(conflicts.getByText(/full plate of pasta/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Uncertain, conflicting or missing" })).toBeVisible();

  await page.getByText("Edit the draft").click();
  await page.getByRole("textbox", { name: "Summary" }).fill("Edited summary: please see the meal reports, which disagree.");
  await page.getByRole("button", { name: "Save edits" }).click();
  await expect(page.getByText("Edits saved. Review the draft again before approving.")).toBeVisible();
  await expect(page.getByText("Your summary:")).toBeVisible();

  await page.getByLabel("I have read this draft and checked it against the source notes.").check();
  await page.getByRole("button", { name: "Approve handoff (does not send it)" }).click();
  // 1st attempt: simulated delivery failure -> Failed, nothing received.
  await page.getByLabel(/Demo: simulate a failed delivery/).check();
  const failed = page.waitForResponse((r) => r.url().endsWith("/api/handoffs") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Submit to the simulated receiver" }).click();
  expect((await failed).status()).toBe(502);
  await expect(page.getByText(/nothing was received/).first()).toBeVisible();
  await page.reload();
  await expect(page.getByText("Submission failed — not received")).toBeVisible(); // persisted, not just UI text

  // Retry through the real endpoint -> 201 receipt.
  const ok = page.waitForResponse((r) => r.url().endsWith("/api/handoffs") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Retry submission" }).click();
  const res = await ok;
  expect(res.status()).toBe(201);
  const { receipt } = await res.json();
  expect(receipt.handoffId).toMatch(/^HO-/);
  expect(receipt.status).toBe("received");
  await expect(page.getByText(/Handoff received by the simulated receiver\. The approved handoff was saved in this demo\. No real care team was contacted\./)).toBeVisible();
  await page.reload();
  await expect(page.getByText(receipt.receiptId)).toBeVisible(); // survives a reload

  // A malformed request is rejected by the backend.
  const bad = await page.request.post("/api/handoffs", { data: { handoffId: receipt.handoffId } });
  expect(bad.status()).toBe(400);

  await page.getByRole("link", { name: "Demo receiver" }).first().click();
  await expect(page.getByText("Simulated receiver — no real care team is connected.")).toBeVisible();
  await page.getByRole("button", { name: /Acknowledge receipt/ }).first().click();
  await expect(page.getByText(/Acknowledged on this page/).first()).toBeVisible();
  await expect(page.getByRole("button", { name: /fictional outcome/ })).toHaveCount(0); // Case 1 only
});

test("cancer case: the fictional outcome can be added only after acknowledgement and is labeled synthetic", async ({ page }) => {
  await page.goto("/demo");
  await page.getByRole("button", { name: "Open Jordan Lee demo" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "Jordan Lee" })).toBeVisible();
  await page.getByRole("link", { name: "Handoffs" }).first().click();
  await page.getByRole("button", { name: "Draft this week's handoff" }).click();
  await expect(page.getByText("Draft created. Nothing has been sent")).toBeVisible();
  await expect(page.getByRole("table", { name: "Key patterns by category" })).toContainText("Tiredness or low energy");
  await page.getByLabel("I have read this draft and checked it against the source notes.").check();
  await page.getByRole("button", { name: "Approve handoff (does not send it)" }).click();
  await page.getByRole("button", { name: "Submit to the simulated receiver" }).click();
  await expect(page.getByText(/Handoff received by the simulated receiver/)).toBeVisible();
  await page.getByRole("link", { name: "Demo receiver" }).first().click();
  const card = page.locator("article").first();
  await expect(card.getByRole("button", { name: /fictional outcome/ })).toHaveCount(0); // not before acknowledgement
  await card.getByRole("button", { name: /Acknowledge receipt/ }).click();
  await page.locator("article").first().getByRole("button", { name: /fictional outcome/ }).click();
  await expect(page.locator("article").first().getByText("Synthetic scenario outcome — fictional")).toBeVisible();
  await expect(page.locator("article").first().getByText(/^Written in advance for this synthetic scenario — not generated by AI/)).toBeVisible();
});
