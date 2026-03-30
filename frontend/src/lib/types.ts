export type IssueType = "bug" | "feature_request" | "unclear";
export type IssueStatus = "pending_review" | "approved" | "rejected" | "in_progress" | "done";
export type IssuePriority = "low" | "medium" | "high" | "critical";
export type IssueSource = "telegram" | "portal";

export interface JiraLink {
  id: string;
  jira_url: string;
  jira_ticket_key: string;
  jira_status: string | null;
  jira_summary: string | null;
}

export interface Issue {
  id: string;
  type: IssueType;
  title: string;
  description: string;
  status: IssueStatus;
  priority: IssuePriority;
  source: IssueSource;
  media_urls: string[];
  is_public: boolean;
  vote_count: number;
  jira_link: JiraLink | null;
  created_at: string;
  updated_at: string;
  // Internal fields (pm_qc only)
  root_cause?: string;
  submitted_by_email?: string;
  approved_by_email?: string;
  ai_classification_raw?: Record<string, unknown>;
}

export interface KBEntry {
  id: string;
  source_type: "google_doc" | "jira_ticket" | "manual";
  source_ref: string | null;
  title: string;
  content: string;
  is_active: boolean;
  imported_by_email: string | null;
  created_at: string;
}
