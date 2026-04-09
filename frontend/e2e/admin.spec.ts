/**
 * E2E: Admin queue — approve and reject flows
 */
import { test, expect } from "@playwright/test";
import { loginAs, createTestIssue, rejectIssue, PM_EMAIL, API } from "./helpers";

test.describe("Admin queue", () => {
  test("non-GHN email is redirected away from /admin", async ({ page }) => {
    await page.addInitScript(() => {
      sessionStorage.setItem("qc_user_email", "outsider@gmail.com");
    });
    await page.goto("/admin");
    await expect(page).toHaveURL("/");
  });

  test("PM can see pending issue in queue", async ({ page }) => {
    const title = `[E2E] Queue test ${Date.now()}`;
    const id = await createTestIssue(title);

    await loginAs(page, PM_EMAIL);
    await page.goto("/admin");

    await expect(page.getByText(title)).toBeVisible();

    // Cleanup
    await rejectIssue(id);
  });

  test("PM can approve issue from queue", async ({ page }) => {
    const title = `[E2E] Approve test ${Date.now()}`;
    const id = await createTestIssue(title);

    await loginAs(page, PM_EMAIL);
    await page.goto("/admin");

    // Expand the issue card
    const card = page.locator("div").filter({ hasText: title }).first();
    await card.getByTitle(/phê duyệt/i).click();

    // Issue disappears from queue after approval
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 });

    // Verify via API
    const res = await page.request.get(`${API}/api/issues/${id}`, {
      headers: { "x-user-email": PM_EMAIL },
    });
    const data = await res.json();
    expect(data.status).toBe("approved");
    expect(data.is_public).toBe(true);

    // Cleanup
    await rejectIssue(id);
  });

  test("PM can reject issue from queue", async ({ page }) => {
    const title = `[E2E] Reject test ${Date.now()}`;
    const id = await createTestIssue(title);

    await loginAs(page, PM_EMAIL);
    await page.goto("/admin");

    const card = page.locator("div").filter({ hasText: title }).first();
    await card.getByTitle(/từ chối/i).click();

    await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 });

    const res = await page.request.get(`${API}/api/issues/${id}`, {
      headers: { "x-user-email": PM_EMAIL },
    });
    expect((await res.json()).status).toBe("rejected");
  });
});
