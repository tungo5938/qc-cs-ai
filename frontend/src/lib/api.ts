// All API calls go through the Next.js /proxy rewrite.
// In dev: /proxy/* → http://localhost:8000/* (via next.config.ts rewrite)
// In prod: /proxy/* → http://backend.railway.internal:8080/* (internal network)
const BASE = "/proxy";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${BASE}${path}`, { ...options, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${text}`);
  }
  return res.json();
}

export const api = {
  // ── Legacy ──────────────────────────────────────────────────────────────────
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
    kbUpload: async (productId: string, file: File) => {
      const form = new FormData();
      form.append("file", file);
      // Do NOT use request() — it forces Content-Type: application/json.
      // Use raw fetch so the browser sets multipart/form-data with the boundary.
      const res = await fetch(`${BASE}/api/products/${productId}/kb-upload`, {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => res.statusText);
        throw new Error(`${res.status}: ${text}`);
      }
      return res.json() as Promise<any>;
    },
  },

  // ── PM Tool ─────────────────────────────────────────────────────────────────
  feedbacks: {
    list: (params?: { product_id?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.product_id) qs.set("product_id", params.product_id);
      if (params?.status) qs.set("status", params.status);
      const query = qs.toString() ? `?${qs}` : "";
      return request<any[]>(`/api/feedbacks${query}`);
    },
    get: (id: string) => request<any>(`/api/feedbacks/${id}`),
    create: (data: any) => request<any>("/api/feedbacks", { method: "POST", body: JSON.stringify(data) }),
    analyze: (id: string) => request<any>(`/api/feedbacks/${id}/analyze`, { method: "POST" }),
    syncSheet: (productId: string) =>
      request<{ imported: number; skipped: number; total_rows: number }>(
        `/api/feedbacks/sync-sheet?product_id=${productId}`,
        { method: "POST" }
      ),
  },
  solutions: {
    list: (params?: { product_id?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.product_id) qs.set("product_id", params.product_id);
      if (params?.status) qs.set("status", params.status);
      const query = qs.toString() ? `?${qs}` : "";
      return request<any[]>(`/api/solutions${query}`);
    },
    get: (id: string) => request<any>(`/api/solutions/${id}`),
    update: (id: string, data: any) => request<any>(`/api/solutions/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    approve: (id: string) => request<any>(`/api/solutions/${id}/approve`, { method: "POST" }),
    reject: (id: string, reason: string) =>
      request<any>(`/api/solutions/${id}/reject`, { method: "POST", body: JSON.stringify({ rejection_reason: reason }) }),
  },
  meetings: {
    list: (params?: { product_id?: string; status?: string }) => {
      const qs = new URLSearchParams();
      if (params?.product_id) qs.set("product_id", params.product_id);
      if (params?.status) qs.set("status", params.status);
      const query = qs.toString() ? `?${qs}` : "";
      return request<any[]>(`/api/meetings${query}`);
    },
    get: (id: string) => request<any>(`/api/meetings/${id}`),
    create: (data: any) => request<any>("/api/meetings", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/api/meetings/${id}`, { method: "PUT", body: JSON.stringify(data) }),
    addNote: (id: string, content: string) =>
      request<any>(`/api/meetings/${id}/notes`, { method: "POST", body: JSON.stringify({ content }) }),
    finish: (id: string) => request<any>(`/api/meetings/${id}/finish`, { method: "POST" }),
  },
  actionItems: {
    list: (params?: { product_id?: string; status?: string; assignee?: string }) => {
      const qs = new URLSearchParams();
      if (params?.product_id) qs.set("product_id", params.product_id);
      if (params?.status) qs.set("status", params.status);
      if (params?.assignee) qs.set("assignee", params.assignee);
      const query = qs.toString() ? `?${qs}` : "";
      return request<any[]>(`/api/action-items${query}`);
    },
    create: (data: any) => request<any>("/api/action-items", { method: "POST", body: JSON.stringify(data) }),
    update: (id: string, data: any) => request<any>(`/api/action-items/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
    bulk: (ids: string[], data: any) =>
      request<any>("/api/action-items/bulk", { method: "POST", body: JSON.stringify({ ids, ...data }) }),
    delete: (id: string) => request<any>(`/api/action-items/${id}`, { method: "DELETE" }),
  },
  dashboard: {
    get: (product_id?: string) => {
      const query = product_id ? `?product_id=${product_id}` : "";
      return request<any>(`/api/dashboard${query}`);
    },
  },
};
