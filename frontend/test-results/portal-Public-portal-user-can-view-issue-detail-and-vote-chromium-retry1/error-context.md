# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: portal.spec.ts >> Public portal >> user can view issue detail and vote
- Location: e2e/portal.spec.ts:46:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('heading', { name: '[E2E] Vote test 1775191298992' })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByRole('heading', { name: '[E2E] Vote test 1775191298992' })

```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - navigation [ref=e2]:
    - generic [ref=e3]:
      - link "Q QC CS AI" [ref=e4] [cursor=pointer]:
        - /url: /
        - generic [ref=e6]: Q
        - generic [ref=e7]: QC CS AI
      - generic [ref=e8]:
        - link "Vấn đề" [ref=e9] [cursor=pointer]:
          - /url: /
        - link "Báo cáo" [ref=e10] [cursor=pointer]:
          - /url: /submit
        - generic [ref=e11]: tester@ghn.vn
  - main [ref=e12]:
    - generic [ref=e13]: Đang tải...
  - generic:
    - generic [ref=e16] [cursor=pointer]:
      - img [ref=e17]
      - generic [ref=e19]: 1 error
      - button "Hide Errors" [ref=e20]:
        - img [ref=e21]
    - status [ref=e24]:
      - generic [ref=e25]:
        - img [ref=e27]
        - generic [ref=e29]:
          - text: Static route
          - button "Hide static indicator" [ref=e30] [cursor=pointer]:
            - img [ref=e31]
  - alert [ref=e34]
```

# Test source

```ts
  1  | /**
  2  |  * E2E: Public portal — issue list, detail, and voting
  3  |  */
  4  | import { test, expect } from "@playwright/test";
  5  | import {
  6  |   loginAs,
  7  |   createTestIssue,
  8  |   approveIssue,
  9  |   rejectIssue,
  10 |   USER_EMAIL,
  11 |   PM_EMAIL,
  12 | } from "./helpers";
  13 | 
  14 | test.describe("Public portal", () => {
  15 |   test("home page loads and shows issue list", async ({ page }) => {
  16 |     await loginAs(page, USER_EMAIL);
  17 |     await page.goto("/");
  18 |     await expect(page.getByRole("heading", { name: /phản hồi/i })).toBeVisible();
  19 |   });
  20 | 
  21 |   test("approved issue appears on home page", async ({ page }) => {
  22 |     const title = `[E2E] Portal visibility ${Date.now()}`;
  23 |     const id = await createTestIssue(title);
  24 |     await approveIssue(id);
  25 | 
  26 |     await loginAs(page, USER_EMAIL);
  27 |     await page.goto("/");
  28 |     await expect(page.getByText(title)).toBeVisible();
  29 | 
  30 |     // Cleanup
  31 |     await rejectIssue(id);
  32 |   });
  33 | 
  34 |   test("pending issue is NOT visible on home page", async ({ page }) => {
  35 |     const title = `[E2E] Hidden pending ${Date.now()}`;
  36 |     const id = await createTestIssue(title);
  37 | 
  38 |     await loginAs(page, USER_EMAIL);
  39 |     await page.goto("/");
  40 |     await expect(page.getByText(title)).not.toBeVisible();
  41 | 
  42 |     // Cleanup
  43 |     await rejectIssue(id);
  44 |   });
  45 | 
  46 |   test("user can view issue detail and vote", async ({ page }) => {
  47 |     const title = `[E2E] Vote test ${Date.now()}`;
  48 |     const id = await createTestIssue(title);
  49 |     await approveIssue(id);
  50 | 
  51 |     await loginAs(page, USER_EMAIL);
  52 |     await page.goto(`/issues/${id}`);
  53 | 
> 54 |     await expect(page.getByRole("heading", { name: title })).toBeVisible();
     |                                                              ^ Error: expect(locator).toBeVisible() failed
  55 | 
  56 |     // Vote button is present
  57 |     const voteBtn = page.getByRole("button", { name: /vote/i });
  58 |     await expect(voteBtn).toBeVisible();
  59 |     const before = await voteBtn.innerText();
  60 | 
  61 |     await voteBtn.click();
  62 |     await expect(page.getByRole("button", { name: /đã vote/i })).toBeVisible();
  63 | 
  64 |     // Cleanup
  65 |     await rejectIssue(id);
  66 |   });
  67 | 
  68 |   test("issue detail shows status and type badges", async ({ page }) => {
  69 |     const title = `[E2E] Badge test ${Date.now()}`;
  70 |     const id = await createTestIssue(title);
  71 |     await approveIssue(id);
  72 | 
  73 |     await loginAs(page, USER_EMAIL);
  74 |     await page.goto(`/issues/${id}`);
  75 | 
  76 |     // Status badge
  77 |     await expect(page.getByText(/đã duyệt/i)).toBeVisible();
  78 |     // Type badge
  79 |     await expect(page.getByText(/lỗi/i)).toBeVisible();
  80 | 
  81 |     // Cleanup
  82 |     await rejectIssue(id);
  83 |   });
  84 | });
  85 | 
```