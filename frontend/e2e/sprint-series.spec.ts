import { test, expect } from "@playwright/test";
import { loginAs, PM_EMAIL, API } from "./helpers";

// ── UI test: structural check (settings page renders Sprint Series panel) ─────
// Note: API data-loading tests cover the behavioral logic below.
// UI data-loading is skipped because Next.js dev-server hot-reload
// invalidates JS chunk hashes mid-run, breaking hydration in Playwright.

test("Settings page renders Sprint Series panel", async ({ page }) => {
  await loginAs(page, PM_EMAIL);
  await page.goto("/settings");
  // Panel header is in server-rendered HTML — visible without hydration
  await expect(page.getByText("Cấu hình Sprint Series")).toBeVisible({ timeout: 10000 });
  // Static UI elements
  await expect(page.getByText("Ngày bắt đầu Sprint 1")).toBeVisible();
  await expect(page.getByText("Độ dài sprint")).toBeVisible();
  await expect(page.getByRole("button", { name: "2 tuần" })).toBeVisible();
  await expect(page.getByRole("button", { name: "3 tuần" })).toBeVisible();
  await expect(page.getByRole("button", { name: "4 tuần" })).toBeVisible();
});

// ── API tests (direct fetch, no browser auth needed) ─────────────────────────

test.describe("Sprint Series API", () => {
  test.afterEach(async () => {
    await fetch(`${API}/api/sprint-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor_date: "2020-01-06", sprint_length_weeks: 2 }),
    }).catch(() => {});
  });

  test("POST /api/sprint-configs accepts valid Monday anchor", async () => {
    const res = await fetch(`${API}/api/sprint-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor_date: "2026-04-06", sprint_length_weeks: 2 }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.anchor_date).toBe("2026-04-06");
    expect(body.sprint_length_weeks).toBe(2);
  });

  test("POST /api/sprint-configs rejects non-Monday with 422", async () => {
    const res = await fetch(`${API}/api/sprint-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor_date: "2026-04-08", sprint_length_weeks: 2 }),
    });
    expect(res.status).toBe(422);
    const body = await res.text();
    expect(body).toContain("Thứ");
  });

  test("POST /api/sprint-configs rejects invalid sprint length", async () => {
    const res = await fetch(`${API}/api/sprint-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor_date: "2026-04-06", sprint_length_weeks: 5 }),
    });
    expect(res.status).toBe(422);
  });

  test("GET /api/sprint-configs/current returns sprint info", async () => {
    await fetch(`${API}/api/sprint-configs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ anchor_date: "2026-04-06", sprint_length_weeks: 2 }),
    });
    const res = await fetch(`${API}/api/sprint-configs/current`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("current_sprint");
    expect(body).toHaveProperty("next_sprint");
    expect(body.next_sprint.number).toBe(body.current_sprint.number + 1);
    expect(body.next_sprint.start_date > body.current_sprint.end_date).toBeTruthy();
  });

  test("POST generate-meetings rejects non-Monday with 400", async () => {
    const res = await fetch(`${API}/api/meeting-templates/generate-meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprint_start_date: "2026-05-13" }),
    });
    expect(res.status).toBe(400);
    const body = await res.text();
    expect(body).toContain("Thứ");
  });

  test("POST generate-meetings accepts Monday with 201", async () => {
    const res = await fetch(`${API}/api/meeting-templates/generate-meetings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sprint_start_date: "2026-05-18" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("created");
  });
});
