import { Page } from "@playwright/test";

export const PM_EMAIL = "tunm1@ghn.vn";
export const USER_EMAIL = "tester@ghn.vn";
export const API = "http://localhost:8000";

/** Set sessionStorage email so EmailGate passes */
export async function loginAs(page: Page, email: string) {
  await page.addInitScript((e) => {
    sessionStorage.setItem("qc_user_email", e);
  }, email);
}

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
