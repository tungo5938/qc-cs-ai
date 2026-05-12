import { test, expect } from "@playwright/test";
import { API } from "./helpers";

/**
 * Sprint Series tests — API-level (no auth needed for sprint-configs endpoints)
 * UI-level tests are skipped until NextAuth test session mock is set up.
 */

test.afterEach(async ({ request }) => {
  // Reset to a known dummy config
  await request.post(`${API}/api/sprint-configs`, {
    data: { anchor_date: "2020-01-06", sprint_length_weeks: 2 },
  });
});

test("POST /api/sprint-configs accepts valid Monday anchor", async ({ request }) => {
  const res = await request.post(`${API}/api/sprint-configs`, {
    data: { anchor_date: "2026-04-06", sprint_length_weeks: 2 },
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body.anchor_date).toBe("2026-04-06");
  expect(body.sprint_length_weeks).toBe(2);
});

test("POST /api/sprint-configs rejects non-Monday with 422", async ({ request }) => {
  const res = await request.post(`${API}/api/sprint-configs`, {
    data: { anchor_date: "2026-04-08", sprint_length_weeks: 2 }, // Wednesday
  });
  expect(res.status()).toBe(422);
  const body = await res.text();
  expect(body).toContain("Thứ");
});

test("POST /api/sprint-configs rejects invalid sprint length", async ({ request }) => {
  const res = await request.post(`${API}/api/sprint-configs`, {
    data: { anchor_date: "2026-04-06", sprint_length_weeks: 5 },
  });
  expect(res.status()).toBe(422);
});

test("GET /api/sprint-configs/current returns sprint info", async ({ request }) => {
  await request.post(`${API}/api/sprint-configs`, {
    data: { anchor_date: "2026-04-06", sprint_length_weeks: 2 },
  });
  const res = await request.get(`${API}/api/sprint-configs/current`);
  expect(res.status()).toBe(200);
  const body = await res.json();
  expect(body).toHaveProperty("current_sprint");
  expect(body).toHaveProperty("next_sprint");
  expect(body.next_sprint.number).toBe(body.current_sprint.number + 1);
  expect(body.next_sprint.start_date > body.current_sprint.end_date).toBeTruthy();
});

test("POST generate-meetings rejects non-Monday with 400", async ({ request }) => {
  const res = await request.post(`${API}/api/meeting-templates/generate-meetings`, {
    data: { sprint_start_date: "2026-05-13" }, // Wednesday
  });
  expect(res.status()).toBe(400);
  const body = await res.text();
  expect(body).toContain("Thứ");
});

test("POST generate-meetings accepts Monday with 201", async ({ request }) => {
  const res = await request.post(`${API}/api/meeting-templates/generate-meetings`, {
    data: { sprint_start_date: "2026-05-18" }, // Monday
  });
  expect(res.status()).toBe(201);
  const body = await res.json();
  expect(body).toHaveProperty("created");
});
