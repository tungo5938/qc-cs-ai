"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { use } from "react";
import { api } from "@/lib/api";
import type { Feedback } from "@/lib/types";
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
    </div>
  );
}
