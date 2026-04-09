/**
 * E2E: Issue submission flow
 * User fills in the submit form → issue appears in admin queue.
 */
import { test, expect } from "@playwright/test";
import { loginAs, PM_EMAIL, USER_EMAIL, API } from "./helpers";

test.describe("Submit issue flow", () => {
  test("email gate blocks access without email", async ({ page }) => {
    await page.goto("/submit");
    await expect(page.getByPlaceholder(/tenban@ghn\.vn/i)).toBeVisible();
    // Form fields should be hidden behind the gate
    await expect(page.getByPlaceholder(/tiêu đề/i)).not.toBeVisible();
  });

  test("email gate accepts valid GHN email", async ({ page }) => {
    await page.goto("/submit");
    await page.getByPlaceholder(/tenban@ghn\.vn/i).fill(USER_EMAIL);
    await page.getByRole("button", { name: /tiếp tục/i }).click();
    await expect(page.getByPlaceholder(/tiêu đề/i)).toBeVisible();
  });

  test("submit a new issue end-to-end", async ({ page }) => {
    const title = `[E2E] Submit test ${Date.now()}`;
    await loginAs(page, USER_EMAIL);
    await page.goto("/submit");

    await page.getByPlaceholder(/tiêu đề/i).fill(title);
    await page.getByPlaceholder(/mô tả/i).fill("Playwright automated test issue.");
    await page.getByRole("button", { name: /gửi/i }).click();

    // Should redirect or show success
    await expect(page).toHaveURL(/\//);

    // Verify via API that it was created
    const res = await page.request.get(`${API}/api/issues`, {
      headers: { "x-user-email": PM_EMAIL },
    });
    const issues = await res.json();
    const found = issues.find((i: any) => i.title === title);
    expect(found).toBeTruthy();
    expect(found.status).toBe("pending_review");

    // Cleanup
    if (found) {
      await page.request.post(`${API}/api/issues/${found.id}/reject`, {
        headers: { "x-user-email": PM_EMAIL },
      });
    }
  });
});
