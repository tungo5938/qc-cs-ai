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
  bug: "🐛 Bug",
  feature_request: "✨ Feature Request",
  unclear: "❓ Unclear",
};
