# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: submit.spec.ts >> Submit issue flow >> submit a new issue end-to-end
- Location: e2e/submit.spec.ts:23:7

# Error details

```
Test timeout of 30000ms exceeded.
```

```
Error: locator.fill: Test timeout of 30000ms exceeded.
Call log:
  - waiting for getByPlaceholder(/tiêu đề/i)

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
    - generic [ref=e13]:
      - heading "Báo lỗi hoặc Yêu cầu tính năng" [level=1] [ref=e14]
      - generic [ref=e15]:
        - generic [ref=e16]:
          - generic [ref=e17]: Loại
          - generic [ref=e18]:
            - generic [ref=e19] [cursor=pointer]:
              - radio "🐛 Lỗi" [checked] [ref=e20]
              - generic [ref=e21]: 🐛 Lỗi
            - generic [ref=e22] [cursor=pointer]:
              - radio "✨ Yêu cầu tính năng" [ref=e23]
              - generic [ref=e24]: ✨ Yêu cầu tính năng
        - generic [ref=e25]:
          - generic [ref=e26]: Tiêu đề *
          - textbox "Mô tả ngắn về vấn đề" [ref=e27]
        - generic [ref=e28]:
          - generic [ref=e29]: Mô tả *
          - textbox "Các bước tái hiện, kết quả mong đợi và thực tế..." [ref=e30]
        - generic [ref=e31]:
          - generic [ref=e32]: Tệp đính kèm (ảnh/video)
          - generic [ref=e33] [cursor=pointer]:
            - img [ref=e34]
            - generic [ref=e37]: Nhấn để tải lên
        - generic [ref=e38]:
          - button "Gửi" [ref=e39] [cursor=pointer]
          - button "Hủy" [ref=e40] [cursor=pointer]
      - paragraph [ref=e41]: Phản hồi của bạn sẽ được đội QC xem xét trước khi hiển thị công khai.
  - status [ref=e42]:
    - generic [ref=e43]:
      - img [ref=e45]
      - generic [ref=e47]:
        - text: Static route
        - button "Hide static indicator" [ref=e48] [cursor=pointer]:
          - img [ref=e49]
  - alert [ref=e52]
```

# Test source

```ts
  1  | /**
  2  |  * E2E: Issue submission flow
  3  |  * User fills in the submit form → issue appears in admin queue.
  4  |  */
  5  | import { test, expect } from "@playwright/test";
  6  | import { loginAs, PM_EMAIL, USER_EMAIL, API } from "./helpers";
  7  | 
  8  | test.describe("Submit issue flow", () => {
  9  |   test("email gate blocks access without email", async ({ page }) => {
  10 |     await page.goto("/submit");
  11 |     await expect(page.getByPlaceholder(/tenban@ghn\.vn/i)).toBeVisible();
  12 |     // Form fields should be hidden behind the gate
  13 |     await expect(page.getByPlaceholder(/tiêu đề/i)).not.toBeVisible();
  14 |   });
  15 | 
  16 |   test("email gate accepts valid GHN email", async ({ page }) => {
  17 |     await page.goto("/submit");
  18 |     await page.getByPlaceholder(/tenban@ghn\.vn/i).fill(USER_EMAIL);
  19 |     await page.getByRole("button", { name: /tiếp tục/i }).click();
  20 |     await expect(page.getByPlaceholder(/tiêu đề/i)).toBeVisible();
  21 |   });
  22 | 
  23 |   test("submit a new issue end-to-end", async ({ page }) => {
  24 |     const title = `[E2E] Submit test ${Date.now()}`;
  25 |     await loginAs(page, USER_EMAIL);
  26 |     await page.goto("/submit");
  27 | 
> 28 |     await page.getByPlaceholder(/tiêu đề/i).fill(title);
     |                                             ^ Error: locator.fill: Test timeout of 30000ms exceeded.
  29 |     await page.getByPlaceholder(/mô tả/i).fill("Playwright automated test issue.");
  30 |     await page.getByRole("button", { name: /gửi/i }).click();
  31 | 
  32 |     // Should redirect or show success
  33 |     await expect(page).toHaveURL(/\//);
  34 | 
  35 |     // Verify via API that it was created
  36 |     const res = await page.request.get(`${API}/api/issues`, {
  37 |       headers: { "x-user-email": PM_EMAIL },
  38 |     });
  39 |     const issues = await res.json();
  40 |     const found = issues.find((i: any) => i.title === title);
  41 |     expect(found).toBeTruthy();
  42 |     expect(found.status).toBe("pending_review");
  43 | 
  44 |     // Cleanup
  45 |     if (found) {
  46 |       await page.request.post(`${API}/api/issues/${found.id}/reject`, {
  47 |         headers: { "x-user-email": PM_EMAIL },
  48 |       });
  49 |     }
  50 |   });
  51 | });
  52 | 
```