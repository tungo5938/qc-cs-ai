# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin.spec.ts >> Admin queue >> PM can see pending issue in queue
- Location: e2e/admin.spec.ts:16:7

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByText('[E2E] Queue test 1775191264617')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for getByText('[E2E] Queue test 1775191264617')

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
        - generic [ref=e11]: tunm1@ghn.vn
  - main [ref=e12]:
    - generic [ref=e13]:
      - generic [ref=e14]:
        - link "Hàng đợi" [ref=e15] [cursor=pointer]:
          - /url: /admin
        - link "Cơ sở tri thức" [ref=e16] [cursor=pointer]:
          - /url: /admin/knowledge-base
        - generic [ref=e17]: Chế độ quản trị
      - generic [ref=e18]:
        - generic [ref=e19]:
          - heading "Hàng đợi phê duyệt" [level=1] [ref=e20]
          - generic [ref=e21]: 0 đang chờ
        - generic [ref=e22]: Đang tải...
  - generic:
    - generic [ref=e25] [cursor=pointer]:
      - img [ref=e26]
      - generic [ref=e28]: 2 errors
      - button "Hide Errors" [ref=e29]:
        - img [ref=e30]
    - status [ref=e33]:
      - generic [ref=e34]:
        - img [ref=e36]
        - generic [ref=e38]:
          - text: Static route
          - button "Hide static indicator" [ref=e39] [cursor=pointer]:
            - img [ref=e40]
  - alert [ref=e43]
```

# Test source

```ts
  1  | /**
  2  |  * E2E: Admin queue — approve and reject flows
  3  |  */
  4  | import { test, expect } from "@playwright/test";
  5  | import { loginAs, createTestIssue, rejectIssue, PM_EMAIL, API } from "./helpers";
  6  | 
  7  | test.describe("Admin queue", () => {
  8  |   test("non-GHN email is redirected away from /admin", async ({ page }) => {
  9  |     await page.addInitScript(() => {
  10 |       sessionStorage.setItem("qc_user_email", "outsider@gmail.com");
  11 |     });
  12 |     await page.goto("/admin");
  13 |     await expect(page).toHaveURL("/");
  14 |   });
  15 | 
  16 |   test("PM can see pending issue in queue", async ({ page }) => {
  17 |     const title = `[E2E] Queue test ${Date.now()}`;
  18 |     const id = await createTestIssue(title);
  19 | 
  20 |     await loginAs(page, PM_EMAIL);
  21 |     await page.goto("/admin");
  22 | 
> 23 |     await expect(page.getByText(title)).toBeVisible();
     |                                         ^ Error: expect(locator).toBeVisible() failed
  24 | 
  25 |     // Cleanup
  26 |     await rejectIssue(id);
  27 |   });
  28 | 
  29 |   test("PM can approve issue from queue", async ({ page }) => {
  30 |     const title = `[E2E] Approve test ${Date.now()}`;
  31 |     const id = await createTestIssue(title);
  32 | 
  33 |     await loginAs(page, PM_EMAIL);
  34 |     await page.goto("/admin");
  35 | 
  36 |     // Expand the issue card
  37 |     const card = page.locator("div").filter({ hasText: title }).first();
  38 |     await card.getByTitle(/phê duyệt/i).click();
  39 | 
  40 |     // Issue disappears from queue after approval
  41 |     await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 });
  42 | 
  43 |     // Verify via API
  44 |     const res = await page.request.get(`${API}/api/issues/${id}`, {
  45 |       headers: { "x-user-email": PM_EMAIL },
  46 |     });
  47 |     const data = await res.json();
  48 |     expect(data.status).toBe("approved");
  49 |     expect(data.is_public).toBe(true);
  50 | 
  51 |     // Cleanup
  52 |     await rejectIssue(id);
  53 |   });
  54 | 
  55 |   test("PM can reject issue from queue", async ({ page }) => {
  56 |     const title = `[E2E] Reject test ${Date.now()}`;
  57 |     const id = await createTestIssue(title);
  58 | 
  59 |     await loginAs(page, PM_EMAIL);
  60 |     await page.goto("/admin");
  61 | 
  62 |     const card = page.locator("div").filter({ hasText: title }).first();
  63 |     await card.getByTitle(/từ chối/i).click();
  64 | 
  65 |     await expect(page.getByText(title)).not.toBeVisible({ timeout: 5000 });
  66 | 
  67 |     const res = await page.request.get(`${API}/api/issues/${id}`, {
  68 |       headers: { "x-user-email": PM_EMAIL },
  69 |     });
  70 |     expect((await res.json()).status).toBe("rejected");
  71 |   });
  72 | });
  73 | 
```