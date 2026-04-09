"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import JiraStatusBadge from "@/components/JiraStatusBadge";
import EmailGate from "@/components/EmailGate";
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, TYPE_LABELS, TEAM_LABELS, TEAM_COLORS } from "@/lib/constants";
import { Star, Link2 } from "lucide-react";
import clsx from "clsx";

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [jiraInput, setJiraInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [hoverRating, setHoverRating] = useState(0);
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingDone, setRatingDone] = useState(false);
  const email = typeof window !== "undefined" ? sessionStorage.getItem("qc_user_email") : null;

  useEffect(() => {
    api.issues.get(id).then(setIssue);
  }, [id]);

  const handleRate = async (rating: number) => {
    if (!email || submittingRating || ratingDone || !issue) return;
    setSubmittingRating(true);
    try {
      const res = await api.scoring.userRate(id, rating, email);
      setIssue((i) => i ? { ...i, composite_score: res.composite_score, priority: res.priority, user_rating: rating } : i);
      setRatingDone(true);
    } catch {
      // 403 = not authorized rater, silently ignore
    } finally {
      setSubmittingRating(false);
    }
  };

  const handleLinkJira = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraInput.trim()) return;
    setLinking(true);
    try {
      await api.issues.linkJira(id, jiraInput.trim());
      const updated = await api.issues.get(id);
      setIssue(updated);
      setJiraInput("");
    } finally {
      setLinking(false);
    }
  };

  if (!issue) return <div className="text-center py-16 text-gray-400">Đang tải...</div>;

  const currentRating = issue.user_rating ?? 0;
  const displayRating = hoverRating || currentRating;

  return (
    <EmailGate>
      <div className="max-w-3xl mx-auto space-y-6">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← Quay lại</a>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">{TYPE_LABELS[issue.type]}</span>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[issue.priority])}>
              {PRIORITY_LABELS[issue.priority] ?? issue.priority}
            </span>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[issue.status])}>
              {STATUS_LABELS[issue.status] ?? issue.status}
            </span>
            {issue.team && issue.team !== "unknown" && (
              <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", TEAM_COLORS[issue.team])}>
                {TEAM_LABELS[issue.team]}
              </span>
            )}
            {issue.composite_score !== null && issue.composite_score !== undefined && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
                Điểm: {issue.composite_score.toFixed(1)}
              </span>
            )}
          </div>

          <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{issue.description}</p>

          {issue.media_urls?.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {issue.media_urls.map((url, i) =>
                url.includes("/video/") ? (
                  <video key={i} src={url} controls className="rounded-lg max-h-48" />
                ) : (
                  <img key={i} src={url} alt="" className="rounded-lg max-h-48 object-contain" />
                )
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {new Date(issue.created_at).toLocaleDateString("vi-VN", { year: "numeric", month: "short", day: "numeric" })}
            </span>
          </div>
        </div>

        {/* User rating */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Star className="w-4 h-4" /> Đánh giá mức độ ảnh hưởng
          </h2>
          {ratingDone || currentRating > 0 ? (
            <p className="text-sm text-green-700 font-medium">
              ✓ Đã đánh giá: {currentRating}/10
            </p>
          ) : (
            <>
              <p className="text-xs text-gray-500">1 = ít ảnh hưởng · 10 = nghiêm trọng</p>
              <div className="flex gap-1">
                {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                  <button
                    key={n}
                    disabled={submittingRating}
                    onMouseEnter={() => setHoverRating(n)}
                    onMouseLeave={() => setHoverRating(0)}
                    onClick={() => handleRate(n)}
                    className={clsx(
                      "w-8 h-8 rounded text-sm font-medium transition",
                      displayRating >= n
                        ? "bg-red-500 text-white"
                        : "bg-gray-100 text-gray-600 hover:bg-red-100"
                    )}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Jira section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Ticket Jira
          </h2>
          {issue.jira_link ? (
            <JiraStatusBadge jiraLink={issue.jira_link} />
          ) : (
            <form onSubmit={handleLinkJira} className="flex gap-2">
              <input
                value={jiraInput}
                onChange={(e) => setJiraInput(e.target.value)}
                placeholder="Dán URL Jira (vd: https://company.atlassian.net/browse/GHN-123)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="submit"
                disabled={linking}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
              >
                {linking ? "Đang liên kết..." : "Liên kết"}
              </button>
            </form>
          )}
        </div>
      </div>
    </EmailGate>
  );
}
