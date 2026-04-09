export type IssueType = "bug" | "feature_request" | "unclear";
export type IssueStatus = "pending_review" | "approved" | "rejected" | "in_progress" | "done";
export type IssuePriority = "low" | "medium" | "high" | "critical";
export type IssueSource = "telegram" | "portal";
export type TeamType = "cs_b2c" | "cs_c2c" | "telesales" | "unknown";

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
  team: TeamType;
  is_public: boolean;
  jira_link: JiraLink | null;
  // Scoring
  user_rating: number | null;
  po_rating: number | null;
  tech_effort: number | null;
  csat_score: number | null;
  composite_score: number | null;
  created_at: string;
  updated_at: string;
  // Internal fields (pm_qc only)
  root_cause?: string;
  submitted_by_email?: string;
  approved_by_email?: string;
  user_rating_by?: string;
  po_rating_by?: string;
  effort_set_by?: string;
  ai_classification_raw?: Record<string, unknown>;
}

export interface ScoringConfig {
  user_rating_weight: number;
  po_rating_weight: number;
  csat_weight: number;
  effort_weight: number;
  threshold_medium: number;
  threshold_high: number;
  threshold_critical: number;
  po_emails: string[];
  team_raters: Record<string, string>;
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
