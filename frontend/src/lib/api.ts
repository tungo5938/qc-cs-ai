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
  priorityConfig: {
    get: () => request<any>("/api/priority-config"),
    update: (body: { user_rating_weight: number; po_rating_weight: number; dev_rating_weight: number }) =>
      request<any>("/api/priority-config", { method: "PUT", body: JSON.stringify(body) }),
  },
  feedbacks: {
    list: (params?: { product_id?: string; status?: string; feedback_type?: string }) => {
      const qs = new URLSearchParams();
      if (params?.product_id) qs.set("product_id", params.product_id);
      if (params?.status) qs.set("status", params.status);
      if (params?.feedback_type) qs.set("feedback_type", params.feedback_type);
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
    update: (id: string, body: { title?: string; raw_content?: string }) =>
      request<any>(`/api/feedbacks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    updateAnalysis: (id: string, body: { root_cause?: string; solution_hint?: string }) =>
      request<any>(`/api/feedbacks/${id}/analysis`, { method: "PATCH", body: JSON.stringify(body) }),
    generateSolution: (id: string) =>
      request<any>(`/api/feedbacks/${id}/generate-solution`, { method: "POST" }),
    generateAC: (id: string) =>
      request<{ acceptance_criteria: string }>(`/api/feedbacks/${id}/generate-ac`, { method: "POST" }),
    createJira: (id: string, body: { title: string; raw_content: string; root_cause?: string; solution_hint?: string; acceptance_criteria: string; sprint_name?: string; epic_key?: string; upload_attachments?: boolean }) =>
      request<{ key: string; url: string }>(`/api/feedbacks/${id}/create-jira`, { method: "POST", body: JSON.stringify(body) }),
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
    patchCanvas: (id: string, tldrawData: object) =>
      request<any>(`/api/solutions/${id}/canvas`, { method: "PATCH", body: JSON.stringify({ tldraw_data: tldrawData }) }),
    patchPrd: (id: string, prdContent: object) =>
      request<any>(`/api/solutions/${id}/prd`, { method: "PATCH", body: JSON.stringify({ prd_content: prdContent }) }),
    patchJiraEpic: (id: string, epicKey: string) =>
      request<any>(`/api/solutions/${id}/jira-epic`, { method: "PATCH", body: JSON.stringify({ jira_epic_key: epicKey }) }),
    chat: (id: string, message: string, jiraTickets: any[]) =>
      request<any>(`/api/solutions/${id}/chat`, { method: "POST", body: JSON.stringify({ message, jira_tickets: jiraTickets }) }),
  },
  feedbackRating: {
    rate: (id: string, body: { user_priority?: number; tu_danh_gia?: number; tech_rating?: number }) =>
      request<any>(`/api/feedbacks/${id}/rate`, { method: "PATCH", body: JSON.stringify(body) }),
    exportUrl: (params: { product_id?: string; status?: string; feedback_type?: string; fields: string }) => {
      const qs = new URLSearchParams();
      if (params.product_id) qs.set("product_id", params.product_id);
      if (params.status) qs.set("status", params.status);
      if (params.feedback_type) qs.set("feedback_type", params.feedback_type);
      qs.set("fields", params.fields);
      return `/proxy/api/feedbacks/export?${qs}`;
    },
  },
  jira: {
    getEpicTickets: (epicKey: string) => request<any[]>(`/api/jira/epic/${epicKey}/tickets`),
    createTicket: (data: { project_key: string; title: string; description: string; issue_type?: string }) =>
      request<any>("/api/jira/tickets", { method: "POST", body: JSON.stringify(data) }),
    updateTicket: (key: string, transition: string) =>
      request<any>(`/api/jira/tickets/${key}`, { method: "PATCH", body: JSON.stringify({ transition }) }),
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
    extractActions: (id: string) => request<any>(`/api/meetings/${id}/extract-actions`, { method: "POST" }),
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
