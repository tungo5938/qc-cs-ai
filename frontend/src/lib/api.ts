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
    vote: (id: string, vote_type: "up" | "down", voter_email: string) =>
      request<any>(`/api/issues/${id}/vote`, { method: "POST", body: JSON.stringify({ vote_type, voter_email }) }),
    linkJira: (id: string, jira_url: string) =>
      request<any>(`/api/issues/${id}/jira-link`, { method: "POST", body: JSON.stringify({ jira_url }) }),
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
};
