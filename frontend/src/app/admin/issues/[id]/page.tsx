"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import JiraStatusBadge from "@/components/JiraStatusBadge";
import { PRIORITY_COLORS, PRIORITY_LABELS, STATUS_COLORS, STATUS_LABELS, TYPE_LABELS, TEAM_LABELS, TEAM_COLORS, SOURCE_LABELS } from "@/lib/constants";
import clsx from "clsx";
import { RefreshCw } from "lucide-react";

export default function AdminIssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [rootCause, setRootCause] = useState("");
  const [saving, setSaving] = useState(false);

  // PO rating
  const [poRating, setPoRating] = useState<number>(0);
  const [poHover, setPoHover] = useState(0);
  const [submittingPo, setSubmittingPo] = useState(false);

  // Tech effort
  const [effort, setEffort] = useState<number>(0);
  const [effortHover, setEffortHover] = useState(0);
  const [submittingEffort, setSubmittingEffort] = useState(false);

  // CSAT recalc
  const [recalculating, setRecalculating] = useState(false);

  const email = typeof window !== "undefined" ? sessionStorage.getItem("qc_user_email") : null;

  useEffect(() => {
    api.issues.get(id).then((i) => {
      setIssue(i);
      setRootCause(i.root_cause || "");
      if (i.po_rating) setPoRating(i.po_rating);
      if (i.tech_effort) setEffort(i.tech_effort);
    });
  }, [id]);

  const saveRootCause = async () => {
    if (!issue) return;
    setSaving(true);
    await api.issues.update(id, { root_cause: rootCause });
    setSaving(false);
  };

  const submitPoRating = async (rating: number) => {
    if (!email || submittingPo) return;
    setSubmittingPo(true);
    try {
      const res = await api.scoring.poRate(id, rating, email);
      setIssue((i) => i ? { ...i, po_rating: rating, composite_score: res.composite_score, priority: res.priority } : i);
      setPoRating(rating);
    } catch {
      // 403 = not a PO
    } finally {
      setSubmittingPo(false);
    }
  };

  const submitEffort = async (e: number) => {
    if (!email || submittingEffort) return;
    setSubmittingEffort(true);
    try {
      const res = await api.scoring.setEffort(id, e, email);
      setIssue((i) => i ? { ...i, tech_effort: e, composite_score: res.composite_score, priority: res.priority } : i);
      setEffort(e);
    } finally {
      setSubmittingEffort(false);
    }
  };

  const handleRecalcCsat = async () => {
    if (recalculating) return;
    setRecalculating(true);
    try {
      const res = await api.scoring.recalculateCsat(id);
      setIssue((i) => i ? { ...i, csat_score: res.csat_score, composite_score: res.composite_score, priority: res.priority } : i);
    } finally {
      setRecalculating(false);
    }
  };

  if (!issue) return <div className="text-center py-12 text-gray-400">Đang tải...</div>;

  const poDisplay = poHover || poRating;
  const effortDisplay = effortHover || effort;

  return (
    <div className="max-w-3xl space-y-6">
      <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Quay lại hàng đợi</a>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm">{TYPE_LABELS[issue.type]}</span>
          <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[issue.priority])}>{PRIORITY_LABELS[issue.priority] || issue.priority}</span>
          <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[issue.status])}>{STATUS_LABELS[issue.status] || issue.status}</span>
          {issue.composite_score !== null && issue.composite_score !== undefined && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-800 font-medium">
              Điểm tổng: {issue.composite_score.toFixed(1)}
            </span>
          )}
          <span className="text-xs text-gray-400 ml-auto">ID: {issue.id.slice(0, 8)}</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
        <p className="text-gray-600 whitespace-pre-wrap">{issue.description}</p>

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

        <div className="text-xs text-gray-400 space-y-0.5">
          {issue.team && (
            <p>Team: <span className={clsx("px-2 py-0.5 rounded-full font-medium", TEAM_COLORS[issue.team])}>{TEAM_LABELS[issue.team]}</span></p>
          )}
          {issue.submitted_by_email && <p>Gửi bởi: {issue.submitted_by_email}</p>}
          {issue.approved_by_email && <p>Phê duyệt bởi: {issue.approved_by_email}</p>}
          <p>Nguồn: {SOURCE_LABELS[issue.source] ?? issue.source} · Tạo lúc: {new Date(issue.created_at).toLocaleString("vi-VN")}</p>
        </div>
      </div>

      {/* Scoring */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
        <h2 className="font-semibold text-gray-900">Chấm điểm</h2>

        {/* Score summary */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Người dùng", value: issue.user_rating, by: issue.user_rating_by },
            { label: "PO", value: issue.po_rating, by: issue.po_rating_by },
            { label: "CSAT (AI)", value: issue.csat_score, by: null },
            { label: "Nỗ lực kỹ thuật", value: issue.tech_effort, by: issue.effort_set_by },
          ].map(({ label, value, by }) => (
            <div key={label} className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 mb-1">{label}</p>
              <p className="text-lg font-bold text-gray-800">{value !== null && value !== undefined ? value : "—"}</p>
              {by && <p className="text-xs text-gray-400 truncate">{by}</p>}
            </div>
          ))}
        </div>

        {/* PO rating */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Đánh giá PO (1–10)</p>
          <p className="text-xs text-gray-400 mb-2">1 = ít quan trọng · 10 = rất quan trọng</p>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                disabled={submittingPo}
                onMouseEnter={() => setPoHover(n)}
                onMouseLeave={() => setPoHover(0)}
                onClick={() => submitPoRating(n)}
                className={clsx(
                  "w-8 h-8 rounded text-sm font-medium transition",
                  poDisplay >= n ? "bg-blue-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-blue-100"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Tech effort */}
        <div>
          <p className="text-sm font-medium text-gray-700 mb-2">Nỗ lực kỹ thuật (1–10)</p>
          <p className="text-xs text-gray-400 mb-2">1 = ít nỗ lực (tốt hơn) · 10 = rất nhiều nỗ lực</p>
          <div className="flex gap-1">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                disabled={submittingEffort}
                onMouseEnter={() => setEffortHover(n)}
                onMouseLeave={() => setEffortHover(0)}
                onClick={() => submitEffort(n)}
                className={clsx(
                  "w-8 h-8 rounded text-sm font-medium transition",
                  effortDisplay >= n ? "bg-orange-500 text-white" : "bg-gray-100 text-gray-600 hover:bg-orange-100"
                )}
              >
                {n}
              </button>
            ))}
          </div>
        </div>

        {/* Recalculate CSAT */}
        <div className="flex items-center gap-3">
          <button
            onClick={handleRecalcCsat}
            disabled={recalculating}
            className="flex items-center gap-2 text-sm px-4 py-2 rounded-lg border border-gray-300 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <RefreshCw className={clsx("w-4 h-4", recalculating && "animate-spin")} />
            {recalculating ? "Đang tính lại CSAT..." : "Tính lại CSAT"}
          </button>
          {issue.csat_score !== null && issue.csat_score !== undefined && (
            <span className="text-sm text-gray-600">CSAT hiện tại: <strong>{issue.csat_score}</strong>/10</span>
          )}
        </div>
      </div>

      {/* Root Cause (internal only) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Phân tích nguyên nhân gốc rễ</h2>
        {issue.ai_classification_raw && (issue.ai_classification_raw as any).kb_references?.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-xs font-semibold text-blue-800 mb-1">📚 KB liên quan</p>
            <ul className="text-sm text-blue-700 list-disc list-inside space-y-0.5">
              {((issue.ai_classification_raw as any).kb_references as string[]).map((ref: string, i: number) => (
                <li key={i}>{ref}</li>
              ))}
            </ul>
          </div>
        )}
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 h-28 resize-none"
          placeholder="Ghi chú nguyên nhân tại đây (nội bộ, không hiển thị cho người dùng)..."
        />
        <button
          onClick={saveRootCause}
          disabled={saving}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
        >
          {saving ? "Đang lưu..." : "Lưu nguyên nhân"}
        </button>
      </div>

      {/* Jira */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Ticket Jira</h2>
        <JiraStatusBadge jiraLink={issue.jira_link} />
      </div>
    </div>
  );
}
