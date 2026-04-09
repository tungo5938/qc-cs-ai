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
  bug: "🐛 Lỗi",
  feature_request: "✨ Yêu cầu tính năng",
  unclear: "❓ Chưa rõ",
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
};
