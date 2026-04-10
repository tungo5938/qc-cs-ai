// ── Legacy types (kept for reference) ─────────────────────────────────────────

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
  user_rating: number | null;
  po_rating: number | null;
  tech_effort: number | null;
  csat_score: number | null;
  composite_score: number | null;
  created_at: string;
  updated_at: string;
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

export interface Product {
  id: string;
  name: string;
  telegram_group_id: string | null;
  kb_gdoc_url: string | null;
  jira_project_key: string | null;
  color: string | null;
  created_at: string;
  product_goal?: string | null;
  kb_text?: string | null;
  google_sheet_url?: string | null;
}

// ── PM Tool types ──────────────────────────────────────────────────────────────

export type FeedbackStatus =
  | "new"
  | "analyzing"
  | "analyzed"
  | "solution_drafted";

export type FeedbackSource = "telegram" | "manual";

export type EffortSize = "S" | "M" | "L" | "XL";

export type SolutionStatus = "draft" | "approved" | "rejected";

export type MeetingStatus = "upcoming" | "in_progress" | "done";

export type MeetingType = "weekly_review" | "sprint_planning" | "incident" | "stakeholder" | "other";

export type ActionStatus = "todo" | "in_progress" | "done" | "cancelled";

export type ImpactLevel = "low" | "medium" | "high";

export interface FeedbackAnalysis {
  root_cause: string;
  impact_level: ImpactLevel;
  affected_area: string;
  kb_references: string[];
}

export interface Feedback {
  id: string;
  product_id: string;
  product_name?: string;
  source: FeedbackSource;
  status: FeedbackStatus;
  raw_content: string;
  analysis?: FeedbackAnalysis | null;
  solution_id?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface SolutionDraft {
  id: string;
  product_id: string;
  product_name?: string;
  feedback_id?: string | null;
  status: SolutionStatus;
  problem_statement: string;
  proposed_solution: string;
  success_metrics: string;
  open_questions: string;
  effort: EffortSize;
  gdoc_url?: string | null;
  rejection_reason?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MeetingNote {
  id: string;
  meeting_id: string;
  content: string;
  created_at: string;
}

export interface Meeting {
  id: string;
  product_id: string;
  product_name?: string;
  name: string;
  meeting_type: MeetingType;
  status: MeetingStatus;
  scheduled_at: string;
  participants: string[];
  notes?: MeetingNote[];
  action_items?: ActionItem[];
  created_at: string;
  updated_at?: string;
}

export interface ActionItem {
  id: string;
  product_id: string;
  product_name?: string;
  meeting_id?: string | null;
  meeting_name?: string | null;
  title: string;
  assignee: string;
  status: ActionStatus;
  deadline?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface MetabaseKpi {
  label: string;
  value: number | null;
  unit: string;
  source: "metabase" | "placeholder";
}

export interface DashboardData {
  pending_feedbacks: number;
  overdue_actions: number;
  pending_solutions: number;
  meetings_today: number;
  overdue_action_items: ActionItem[];
  recent_feedbacks: Feedback[];
  todays_meetings: Meeting[];
  metabase_kpis: {
    cs_ai: MetabaseKpi;
    cs_chat_clients: MetabaseKpi;
    cs_chat_messages: MetabaseKpi;
    cs_chat_tickets: MetabaseKpi;
    voice_ai: MetabaseKpi;
    source: string;
  };
}
