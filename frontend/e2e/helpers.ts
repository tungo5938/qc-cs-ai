import { Page } from "@playwright/test";

export const PM_EMAIL = "tunm1@ghn.vn";
export const USER_EMAIL = "tester@ghn.vn";
export const API = "http://localhost:8000";

/**
 * No-op: auth is handled via storageState cookie in playwright.config.ts.
 * Kept for backwards compatibility with existing test calls.
 */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function loginAs(_page: Page, _email: string) {}

/** Create an issue via API and return its id */
export async function createTestIssue(title: string): Promise<string> {
  const res = await fetch(`${API}/api/issues`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      title,
      description: "Created by Playwright test suite.",
      type: "bug",
      submitted_by_email: USER_EMAIL,
    }),
  });
  const data = await res.json();
  return data.id;
}

/** Approve an issue via API */
export async function approveIssue(id: string) {
  await fetch(`${API}/api/issues/${id}/approve`, {
    method: "POST",
    headers: { "x-user-email": PM_EMAIL },
  });
}

/** Reject/cleanup an issue via API */
export async function rejectIssue(id: string) {
  await fetch(`${API}/api/issues/${id}/reject`, {
    method: "POST",
    headers: { "x-user-email": PM_EMAIL },
  });
}
