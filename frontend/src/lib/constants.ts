export const GHN_EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@(ghn\.vn|ghn\.com\.vn)$/;

export const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-orange-100 text-orange-800",
  critical: "bg-red-100 text-red-800",
};

export const STATUS_COLORS: Record<string, string> = {
  pending_review: "bg-gray-100 text-gray-700",
  approved: "bg-blue-100 text-blue-800",
  rejected: "bg-red-100 text-red-800",
  in_progress: "bg-purple-100 text-purple-800",
  done: "bg-green-100 text-green-800",
};

export const TYPE_LABELS: Record<string, string> = {
  bug: "Lỗi",
  feature_request: "Yêu cầu tính năng",
  unclear: "Chưa rõ",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  critical: "Nghiêm trọng",
};

export const STATUS_LABELS: Record<string, string> = {
  pending_review: "Chờ duyệt",
  approved: "Đã duyệt",
  rejected: "Từ chối",
  in_progress: "Đang xử lý",
  done: "Hoàn thành",
};

export const TEAM_LABELS: Record<string, string> = {
  cs_b2c: "CS B2C",
  cs_c2c: "CS C2C",
  telesales: "Telesales",
  unknown: "Chưa xác định",
};

export const TEAM_COLORS: Record<string, string> = {
  cs_b2c: "bg-blue-100 text-blue-800",
  cs_c2c: "bg-indigo-100 text-indigo-800",
  telesales: "bg-teal-100 text-teal-800",
  unknown: "bg-gray-100 text-gray-500",
};

export const SOURCE_LABELS: Record<string, string> = {
  telegram: "Telegram",
  portal: "Cổng thông tin",
  manual: "Thủ công",
};

// ── PM Tool constants ──────────────────────────────────────────────────────────

export const FEEDBACK_STATUS_LABELS: Record<string, string> = {
  new: "Mới",
  analyzing: "Đang phân tích",
  analyzed: "Đã phân tích",
  solution_drafted: "Đã tạo solution",
};

export const FEEDBACK_STATUS_COLORS: Record<string, string> = {
  new: "bg-blue-100 text-blue-800",
  analyzing: "bg-yellow-100 text-yellow-800",
  analyzed: "bg-purple-100 text-purple-800",
  solution_drafted: "bg-green-100 text-green-800",
};

export const SOLUTION_STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  approved: "Approved",
  rejected: "Rejected",
};

export const SOLUTION_STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-700",
  approved: "bg-green-100 text-green-800",
  rejected: "bg-red-100 text-red-800",
};

export const MEETING_TYPE_LABELS: Record<string, string> = {
  weekly_review: "Weekly Review",
  sprint_planning: "Sprint Planning",
  incident: "Incident",
  stakeholder: "Stakeholder",
  other: "Khác",
};

export const MEETING_STATUS_LABELS: Record<string, string> = {
  upcoming: "Sắp tới",
  in_progress: "Đang diễn ra",
  done: "Đã xong",
};

export const MEETING_STATUS_COLORS: Record<string, string> = {
  upcoming: "bg-blue-100 text-blue-800",
  in_progress: "bg-yellow-100 text-yellow-800",
  done: "bg-green-100 text-green-800",
};

export const ACTION_STATUS_LABELS: Record<string, string> = {
  todo: "Chưa làm",
  in_progress: "Đang làm",
  done: "Xong",
  cancelled: "Hủy",
};

export const ACTION_STATUS_COLORS: Record<string, string> = {
  todo: "bg-gray-100 text-gray-700",
  in_progress: "bg-blue-100 text-blue-800",
  done: "bg-green-100 text-green-800",
  cancelled: "bg-red-100 text-red-800",
};

export const EFFORT_LABELS: Record<string, string> = {
  S: "Nhỏ",
  M: "Vừa",
  L: "Lớn",
  XL: "Rất lớn",
};

export const EFFORT_COLORS: Record<string, string> = {
  S: "bg-green-100 text-green-800",
  M: "bg-yellow-100 text-yellow-800",
  L: "bg-orange-100 text-orange-800",
  XL: "bg-red-100 text-red-800",
};

export const IMPACT_LABELS: Record<string, string> = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
};

export const IMPACT_COLORS: Record<string, string> = {
  low: "bg-green-100 text-green-800",
  medium: "bg-yellow-100 text-yellow-800",
  high: "bg-red-100 text-red-800",
};

export const AFFECTED_AREA_LABELS: Record<string, string> = {
  ui: "Giao diện",
  api: "API",
  bot: "Bot",
  data: "Dữ liệu",
  performance: "Hiệu suất",
  security: "Bảo mật",
  other: "Khác",
};

export const PRODUCT_COLORS: Record<string, string> = {
  "CS AI": "bg-red-100 text-red-800",
  "CS Chat": "bg-blue-100 text-blue-800",
  "Voice AI": "bg-purple-100 text-purple-800",
};

export const FEEDBACK_SOURCE_LABELS: Record<string, string> = {
  telegram: "Telegram",
  manual: "Thủ công",
};

export const FEEDBACK_SOURCE_COLORS: Record<string, string> = {
  telegram: "bg-sky-100 text-sky-800",
  manual: "bg-gray-100 text-gray-700",
};
