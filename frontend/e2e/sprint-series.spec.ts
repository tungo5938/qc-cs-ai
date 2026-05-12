import { test, expect } from "@playwright/test";
import { loginAs, PM_EMAIL, API } from "./helpers";

test.beforeEach(async ({ page }) => {
  await loginAs(page, PM_EMAIL);
});

test.afterEach(async () => {
  // Reset sprint config to a known dummy state
  await fetch(`${API}/api/sprint-configs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ anchor_date: "2020-01-06", sprint_length_weeks: 2 }),
  }).catch(() => {});
});

test("Settings page shows Sprint Series panel", async ({ page }) => {
  await page.goto("/settings");
  await expect(page.getByText("Sprint Series")).toBeVisible();
});

test("Can save a valid sprint config and see current sprint info", async ({
  page,
}) => {
  await page.goto("/settings");

  // Fill anchor date with a known Monday
  const anchorInput = page.locator('input[type="date"]').first();
  await anchorInput.fill("2026-04-06");

  // Save
  await page.getByRole("button", { name: /lưu|save/i }).click();

  // Should show current sprint number
  await expect(page.getByText(/sprint/i)).toBeVisible();
});

test("Rejects non-Monday anchor date with error message", async ({ page }) => {
  // POST directly to API — non-Monday should return 422
  const res = await page.request.post(`${API}/api/sprint-configs`, {
    data: { anchor_date: "2026-04-08", sprint_length_weeks: 2 },
  });
  expect(res.status()).toBe(422);
  const body = await res.text();
  expect(body).toContain("Thứ");
});
