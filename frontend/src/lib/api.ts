const BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

function getEmail(): string | null {
  if (typeof window === "undefined") return null;
  return sessionStorage.getItem("qc_user_email");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const email = getEmail();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (email) headers["X-User-Email"] = email;

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  issues: {
    list: () => request<any[]>("/api/issues"),
    get: (id: string) => request<any>(`/api/issues/${id}`),
    create: (body: any) => request<any>("/api/issues", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: any) => request<any>(`/api/issues/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    approve: (id: string) => request<any>(`/api/issues/${id}/approve`, { method: "POST" }),
    reject: (id: string) => request<any>(`/api/issues/${id}/reject`, { method: "POST" }),
    linkJira: (id: string, jira_url: string) =>
      request<any>(`/api/issues/${id}/jira-link`, { method: "POST", body: JSON.stringify({ jira_url }) }),
  },
  scoring: {
    userRate: (issue_id: string, rating: number, rater_email: string) =>
      request<any>(`/api/scoring/${issue_id}/user-rate`, { method: "POST", body: JSON.stringify({ rating, rater_email }) }),
    poRate: (issue_id: string, rating: number, po_email: string) =>
      request<any>(`/api/scoring/${issue_id}/po-rate`, { method: "POST", body: JSON.stringify({ rating, po_email }) }),
    setEffort: (issue_id: string, effort: number, set_by_email: string) =>
      request<any>(`/api/scoring/${issue_id}/effort`, { method: "POST", body: JSON.stringify({ effort, set_by_email }) }),
    recalculateCsat: (issue_id: string) =>
      request<any>(`/api/scoring/${issue_id}/recalculate-csat`, { method: "POST" }),
    getConfig: () => request<any>("/api/scoring/config"),
    updateConfig: (body: any) => request<any>("/api/scoring/config", { method: "PUT", body: JSON.stringify(body) }),
    updateTeamRater: (team: string, rater_email: string) =>
      request<any>("/api/scoring/config/team-raters", { method: "PUT", body: JSON.stringify({ team, rater_email }) }),
  },
  kb: {
    list: () => request<any[]>("/api/kb"),
    create: (body: any) => request<any>("/api/kb", { method: "POST", body: JSON.stringify(body) }),
    delete: (id: string) => request<any>(`/api/kb/${id}`, { method: "DELETE" }),
    importGdoc: (url: string, email?: string) =>
      request<any>("/api/kb/import/gdoc", { method: "POST", body: JSON.stringify({ url, imported_by_email: email }) }),
    importJira: (jira_url: string, email?: string) =>
      request<any>("/api/kb/import/jira", { method: "POST", body: JSON.stringify({ jira_url, imported_by_email: email }) }),
  },
  products: {
    list: () => request<any[]>("/api/products"),
    create: (data: any) => request<any>("/api/products", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/api/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    delete: (id: string) => request<any>(`/api/products/${id}`, { method: "DELETE" }),
  },
};
