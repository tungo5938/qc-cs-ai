import { test, expect } from "@playwright/test";
import { loginAs, PM_EMAIL, API } from "./helpers";

// ── UI test: structural check ─────────────────────────────────────────────────

test("Roadmap page renders product tabs", async ({ page }) => {
  await loginAs(page, PM_EMAIL);
  await page.goto("/roadmap");
  await expect(page.getByRole("main").getByText("CS AI")).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole("main").getByText("CS Chat")).toBeVisible();
  await expect(page.getByRole("main").getByText("Voice AI")).toBeVisible();
});

// ── API tests ─────────────────────────────────────────────────────────────────

test.describe("Roadmap API", () => {
  let realProductId: string = "";
  let phaseId: string = "";

  test.beforeAll(async () => {
    const productsRes = await fetch(`${API}/api/products`);
    const products = await productsRes.json();
    realProductId = products[0]?.id ?? "";
  });

  test.afterEach(async () => {
    if (phaseId) {
      await fetch(`${API}/api/roadmap/phases/${phaseId}`, { method: "DELETE" }).catch(() => {});
      phaseId = "";
    }
  });

  test("POST /api/roadmap/phases creates a phase", async () => {
    const res = await fetch(`${API}/api/roadmap/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: realProductId, name: "E2E Phase" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.name).toBe("E2E Phase");
    expect(body.sprints).toEqual([]);
    phaseId = body.id;
  });

  test("GET /api/roadmap/phases lists phases for product", async () => {
    const createRes = await fetch(`${API}/api/roadmap/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: realProductId, name: "E2E List Phase" }),
    });
    const phase = await createRes.json();
    phaseId = phase.id;

    const res = await fetch(`${API}/api/roadmap/phases?product_id=${realProductId}`);
    expect(res.status).toBe(200);
    const phases = await res.json();
    const ids = phases.map((p: any) => p.id);
    expect(ids).toContain(phaseId);
  });

  test("POST /api/roadmap/sprints creates a sprint in phase", async () => {
    const createPhase = await fetch(`${API}/api/roadmap/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: realProductId, name: "Sprint Phase" }),
    });
    const phase = await createPhase.json();
    phaseId = phase.id;

    const res = await fetch(`${API}/api/roadmap/sprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        phase_id: phaseId,
        name: "Sprint 5",
        start_date: "2026-06-01",
        end_date: "2026-06-14",
      }),
    });
    expect(res.status).toBe(201);
    const sprint = await res.json();
    expect(sprint.name).toBe("Sprint 5");
    expect(sprint.task_counts.total).toBe(0);
  });

  test("DELETE /api/roadmap/phases nullifies task phase_id", async () => {
    // Create phase → sprint → action item
    const phaseRes = await fetch(`${API}/api/roadmap/phases`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: realProductId, name: "Delete Phase Test" }),
    });
    const phase = await phaseRes.json();
    phaseId = phase.id;

    const sprintRes = await fetch(`${API}/api/roadmap/sprints`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phase_id: phaseId, name: "S1" }),
    });
    const sprint = await sprintRes.json();

    const taskRes = await fetch(`${API}/api/action-items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        product_id: realProductId,
        title: "Delete phase task",
        phase_id: phaseId,
        sprint_id: sprint.id,
      }),
    });
    const task = await taskRes.json();

    // Delete phase
    const delRes = await fetch(`${API}/api/roadmap/phases/${phaseId}`, { method: "DELETE" });
    expect(delRes.status).toBe(204);
    phaseId = ""; // already deleted, skip afterEach cleanup

    // Task still exists but phase_id is null
    const taskCheck = await fetch(`${API}/api/action-items/${task.id}`);
    expect(taskCheck.status).toBe(200);
    const taskBody = await taskCheck.json();
    expect(taskBody.phase_id).toBeNull();

    // Cleanup task
    await fetch(`${API}/api/action-items/${task.id}`, { method: "DELETE" }).catch(() => {});
  });
});
