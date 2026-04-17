"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { api } from "@/lib/api";
import type { Feedback, ActionItem } from "@/lib/types";
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_COLORS,
  FEEDBACK_SOURCE_LABELS,
  IMPACT_LABELS,
  IMPACT_COLORS,
} from "@/lib/constants";

export default function FeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.feedbacks
      .get(id)
      .then((r) => setFeedback(r as Feedback))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  async function handleAnalyze() {
    if (!feedback) return;
    setAnalyzing(true);
    try {
      const updated = await api.feedbacks.analyze(feedback.id);
      setFeedback(updated as Feedback);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setAnalyzing(false);
    }
  }

  if (loading)
    return <div className="py-16 text-center text-gray-400">Đang tải...</div>;
  if (error)
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">
        {error}
      </div>
    );
  if (!feedback) return null;

  const analysis = feedback.analysis;

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Link href="/feedback" className="text-sm text-gray-500 hover:text-gray-700">
          ← Quay lại danh sách
        </Link>
      </div>

      {/* Header card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          {feedback.product_name && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
              {feedback.product_name}
            </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">
            {FEEDBACK_SOURCE_LABELS[feedback.source] ?? feedback.source}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              FEEDBACK_STATUS_COLORS[feedback.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {FEEDBACK_STATUS_LABELS[feedback.status] ?? feedback.status}
          </span>
          <span className="text-xs text-gray-400 ml-auto">
            {new Date(feedback.created_at).toLocaleString("vi-VN")}
          </span>
        </div>

        <div>
          <h2 className="text-sm font-medium text-gray-500 mb-1">Nội dung gốc</h2>
          <p className="text-gray-800 whitespace-pre-wrap text-sm leading-relaxed">
            {feedback.raw_content}
          </p>
        </div>

        {feedback.media_urls && feedback.media_urls.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-medium text-gray-500 mb-2">Hình ảnh đính kèm</h2>
            <div className="flex flex-wrap gap-2">
              {feedback.media_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`Attachment ${i + 1}`}
                    className="h-32 w-auto rounded-lg border border-gray-200 object-cover hover:opacity-90 transition"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </a>
              ))}
            </div>
          </div>
        )}

        {feedback.status === "new" || feedback.status === "analyzing" ? (
          <button
            onClick={handleAnalyze}
            disabled={analyzing || feedback.status === "analyzing"}
            className="mt-5 bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
          >
            {analyzing || feedback.status === "analyzing"
              ? "Đang phân tích..."
              : "Phân tích"}
          </button>
        ) : null}
      </div>

      {/* Ratings card */}
      {(feedback.user_priority != null || feedback.tu_danh_gia != null || feedback.tech_rating != null || feedback.priority_score != null) && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
          <h2 className="font-semibold text-gray-900 mb-4">Đánh giá ưu tiên</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">👤 User đánh giá</p>
              <p className="text-2xl font-bold text-gray-800">
                {feedback.user_priority != null ? feedback.user_priority : <span className="text-gray-300 text-lg">—</span>}
                {feedback.user_priority != null && <span className="text-sm text-gray-400">/10</span>}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">🤖 AI đánh giá</p>
              <p className="text-2xl font-bold text-gray-800">
                {feedback.tu_danh_gia != null ? feedback.tu_danh_gia : <span className="text-gray-300 text-lg">—</span>}
                {feedback.tu_danh_gia != null && <span className="text-sm text-gray-400">/10</span>}
              </p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500 mb-1">⚙️ Tech đánh giá</p>
              <p className="text-2xl font-bold text-gray-800">
                {feedback.tech_rating != null ? feedback.tech_rating : <span className="text-gray-300 text-lg">—</span>}
                {feedback.tech_rating != null && <span className="text-sm text-gray-400">/10</span>}
              </p>
              {feedback.tech_rating != null && <p className="text-xs text-gray-400">(cao = dễ)</p>}
            </div>
            <div className="text-center bg-orange-50 rounded-lg p-2">
              <p className="text-xs text-gray-500 mb-1">★ Tổng điểm</p>
              <p className="text-2xl font-bold text-orange-600">
                {feedback.priority_score != null ? feedback.priority_score.toFixed(1) : <span className="text-gray-300 text-lg">—</span>}
                {feedback.priority_score != null && <span className="text-sm text-orange-400">/10</span>}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-3">Tổng điểm = bình quân có trọng số (user 40% + AI 40% + tech 20%). Bỏ qua các chỉ số chưa điền.</p>
        </div>
      )}

      {/* Analysis panel */}
      {analysis && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 space-y-4">
          <h2 className="font-semibold text-gray-900">Kết quả phân tích</h2>

          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
              Nguyên nhân gốc rễ
            </p>
            <p className="text-sm text-gray-800">{analysis.root_cause}</p>
          </div>

          <div className="flex flex-wrap gap-3">
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Mức độ ảnh hưởng
              </p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                  IMPACT_COLORS[analysis.impact_level] ?? "bg-gray-100 text-gray-600"
                }`}
              >
                {IMPACT_LABELS[analysis.impact_level] ?? analysis.impact_level}
              </span>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Khu vực ảnh hưởng
              </p>
              <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                {analysis.affected_area}
              </span>
            </div>
          </div>

          {analysis.kb_references && analysis.kb_references.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
                Tài liệu liên quan
              </p>
              <ul className="space-y-1">
                {analysis.kb_references.map((ref, i) => (
                  <li key={i} className="text-sm text-blue-600 hover:underline">
                    {ref}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Solution link */}
      {feedback.solution_id && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm text-green-700">
            Đã có solution draft.{" "}
            <Link
              href={`/solutions/${feedback.solution_id}`}
              className="font-medium underline"
            >
              Xem solution
            </Link>
          </p>
        </div>
      )}

      <FeedbackActionsSection feedback={feedback} />
    </div>
  );
}

const STATUS_LABEL: Record<string, string> = {
  todo: "Chưa chốt",
  confirmed: "Đã chốt",
  in_progress: "Đang làm",
  done: "Xong",
  cancelled: "Huỷ",
};
const STATUS_COLOR: Record<string, string> = {
  todo: "bg-gray-700 text-gray-300",
  confirmed: "bg-blue-900/40 text-blue-300",
  in_progress: "bg-yellow-900/40 text-yellow-300",
  done: "bg-green-900/40 text-green-300",
  cancelled: "bg-red-900/40 text-red-300",
};
const PICS = ["CDN", "GHN", "CS", "Tunm1"];

function FeedbackActionsSection({ feedback }: { feedback: Feedback }) {
  const [actions, setActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState("Tunm1");

  useEffect(() => {
    api.actionItems
      .listByFeedback(feedback.id)
      .then((data) => setActions(data as ActionItem[]))
      .finally(() => setLoading(false));
  }, [feedback.id]);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const { actions: suggested } = await api.feedbacks.suggestActions(feedback.id);
      const created = await Promise.all(
        suggested.map((s) =>
          api.actionItems.createForFeedback({
            product_id: feedback.product_id,
            title: s.title,
            assignee: s.assignee,
            source_feedback_id: feedback.id,
          })
        )
      );
      setActions((prev) => [...prev, ...(created as ActionItem[])]);
    } finally {
      setGenerating(false);
    }
  }

  async function handleAddManual() {
    if (!newTitle.trim()) return;
    const item = await api.actionItems.createForFeedback({
      product_id: feedback.product_id,
      title: newTitle.trim(),
      assignee: newAssignee || undefined,
      source_feedback_id: feedback.id,
    });
    setActions((prev) => [...prev, item as ActionItem]);
    setNewTitle("");
  }

  return (
    <div className="bg-gray-900 rounded-xl border border-gray-800 p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-100">Actions</h2>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="text-xs px-3 py-1.5 rounded-lg bg-red-600/20 text-red-400 border border-red-600/30 hover:bg-red-600/30 transition-colors disabled:opacity-50"
        >
          {generating ? "Đang tạo..." : "✨ Tự động tạo"}
        </button>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">Đang tải...</p>
      ) : (
        <div className="space-y-2 mb-4">
          {actions.length === 0 && (
            <p className="text-sm text-gray-600">Chưa có action nào.</p>
          )}
          {actions.map((a) => (
            <div
              key={a.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-gray-800 border border-gray-700"
            >
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${STATUS_COLOR[a.status] ?? "bg-gray-700 text-gray-300"}`}
              >
                {STATUS_LABEL[a.status] ?? a.status}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-200">{a.title}</p>
                {a.assignee && (
                  <p className="text-xs text-gray-500 mt-0.5">{a.assignee}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <input
          type="text"
          placeholder="Thêm action thủ công..."
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAddManual()}
          className="flex-1 text-sm rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-gray-200 placeholder-gray-600 focus:outline-none focus:border-red-500"
        />
        <select
          value={newAssignee}
          onChange={(e) => setNewAssignee(e.target.value)}
          className="text-sm rounded-lg border border-gray-700 bg-gray-800 px-2 py-1.5 text-gray-200"
        >
          {PICS.map((p) => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>
        <button
          onClick={handleAddManual}
          className="text-sm px-3 py-1.5 rounded-lg bg-gray-700 text-gray-200 hover:bg-gray-600 transition-colors"
        >
          Thêm
        </button>
      </div>
    </div>
  );
}
