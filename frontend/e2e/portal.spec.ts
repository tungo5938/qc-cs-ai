/**
 * E2E: Public portal — issue list, detail, and voting
 */
import { test, expect } from "@playwright/test";
import {
  loginAs,
  createTestIssue,
  approveIssue,
  rejectIssue,
  USER_EMAIL,
  PM_EMAIL,
} from "./helpers";

test.describe("Public portal", () => {
  test("home page loads and shows issue list", async ({ page }) => {
    await loginAs(page, USER_EMAIL);
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /phản hồi/i })).toBeVisible();
  });

  test("approved issue appears on home page", async ({ page }) => {
    const title = `[E2E] Portal visibility ${Date.now()}`;
    const id = await createTestIssue(title);
    await approveIssue(id);

    await loginAs(page, USER_EMAIL);
    await page.goto("/");
    await expect(page.getByText(title)).toBeVisible();

    // Cleanup
    await rejectIssue(id);
  });

  test("pending issue is NOT visible on home page", async ({ page }) => {
    const title = `[E2E] Hidden pending ${Date.now()}`;
    const id = await createTestIssue(title);

    await loginAs(page, USER_EMAIL);
    await page.goto("/");
    await expect(page.getByText(title)).not.toBeVisible();

    // Cleanup
    await rejectIssue(id);
  });

  test("user can view issue detail and vote", async ({ page }) => {
    const title = `[E2E] Vote test ${Date.now()}`;
    const id = await createTestIssue(title);
    await approveIssue(id);

    await loginAs(page, USER_EMAIL);
    await page.goto(`/issues/${id}`);

    await expect(page.getByRole("heading", { name: title })).toBeVisible();

    // Vote button is present
    const voteBtn = page.getByRole("button", { name: /vote/i });
    await expect(voteBtn).toBeVisible();
    const before = await voteBtn.innerText();

    await voteBtn.click();
    await expect(page.getByRole("button", { name: /đã vote/i })).toBeVisible();

    // Cleanup
    await rejectIssue(id);
  });

  test("issue detail shows status and type badges", async ({ page }) => {
    const title = `[E2E] Badge test ${Date.now()}`;
    const id = await createTestIssue(title);
    await approveIssue(id);

    await loginAs(page, USER_EMAIL);
    await page.goto(`/issues/${id}`);

    // Status badge
    await expect(page.getByText(/đã duyệt/i)).toBeVisible();
    // Type badge
    await expect(page.getByText(/lỗi/i)).toBeVisible();

    // Cleanup
    await rejectIssue(id);
  });
});
