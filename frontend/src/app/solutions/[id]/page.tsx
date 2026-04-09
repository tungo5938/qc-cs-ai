"use client";
import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { use } from "react";
import { api } from "@/lib/api";
import type { SolutionDraft, EffortSize } from "@/lib/types";
import {
  SOLUTION_STATUS_LABELS,
  SOLUTION_STATUS_COLORS,
  EFFORT_LABELS,
} from "@/lib/constants";

const EFFORT_SIZES: EffortSize[] = ["S", "M", "L", "XL"];

function EditableField({
  label,
  value,
  onChange,
  onBlur,
  rows = 3,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur: () => void;
  rows?: number;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
        {label}
      </label>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        rows={rows}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
      />
    </div>
  );
}

export default function SolutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [sol, setSol] = useState<SolutionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rejectModal, setRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    api.solutions
      .get(id)
      .then((r) => setSol(r as SolutionDraft))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [id]);

  function updateField(field: keyof SolutionDraft, value: string) {
    if (!sol) return;
    setSol({ ...sol, [field]: value });
  }

  async function saveToAPI() {
    if (!sol) return;
    setSaving(true);
    try {
      const updated = await api.solutions.update(sol.id, {
        problem_statement: sol.problem_statement,
        proposed_solution: sol.proposed_solution,
        success_metrics: sol.success_metrics,
        open_questions: sol.open_questions,
        effort: sol.effort,
      });
      setSol(updated as SolutionDraft);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function handleBlur() {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(saveToAPI, 500);
  }

  async function handleApprove() {
    if (!sol) return;
    try {
      const updated = await api.solutions.approve(sol.id);
      setSol(updated as SolutionDraft);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function handleReject() {
    if (!sol || !rejectReason.trim()) return;
    try {
      const updated = await api.solutions.reject(sol.id, rejectReason.trim());
      setSol(updated as SolutionDraft);
      setRejectModal(false);
    } catch (e: any) {
      setError(e.message);
    }
  }

  if (loading)
    return <div className="py-16 text-center text-gray-400">Đang tải...</div>;
  if (error)
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-red-700">{error}</div>
    );
  if (!sol) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/solutions" className="text-sm text-gray-500 hover:text-gray-700">
          ← Quay lại danh sách
        </Link>
        {saving && <span className="text-xs text-gray-400">Đang lưu...</span>}
      </div>

      {/* Header */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {sol.product_name && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
              {sol.product_name}
            </span>
          )}
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              SOLUTION_STATUS_COLORS[sol.status] ?? "bg-gray-100 text-gray-600"
            }`}
          >
            {SOLUTION_STATUS_LABELS[sol.status] ?? sol.status}
          </span>
          {sol.feedback_id && (
            <Link
              href={`/feedback/${sol.feedback_id}`}
              className="text-xs text-blue-600 hover:underline"
            >
              Xem feedback gốc
            </Link>
          )}
        </div>

        {sol.status === "rejected" && sol.rejection_reason && (
          <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 mb-3">
            <p className="text-xs text-red-700">
              <span className="font-medium">Lý do từ chối:</span> {sol.rejection_reason}
            </p>
          </div>
        )}

        {sol.status === "approved" && sol.gdoc_url && (
          <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 mb-3">
            <a
              href={sol.gdoc_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-green-700 hover:underline font-medium"
            >
              Xem Google Doc
            </a>
          </div>
        )}

        {/* Effort selector */}
        <div className="mb-4">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-2">
            Ước tính effort
          </p>
          <div className="flex gap-2">
            {EFFORT_SIZES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  updateField("effort", s);
                  setTimeout(saveToAPI, 100);
                }}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition ${
                  sol.effort === s
                    ? "bg-red-600 border-red-600 text-white"
                    : "border-gray-200 text-gray-600 hover:border-red-300"
                }`}
              >
                {s} — {EFFORT_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Editable content */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 space-y-5">
        <EditableField
          label="Phát biểu vấn đề"
          value={sol.problem_statement}
          onChange={(v) => updateField("problem_statement", v)}
          onBlur={handleBlur}
          rows={3}
        />
        <EditableField
          label="Giải pháp đề xuất"
          value={sol.proposed_solution}
          onChange={(v) => updateField("proposed_solution", v)}
          onBlur={handleBlur}
          rows={4}
        />
        <EditableField
          label="Tiêu chí thành công"
          value={sol.success_metrics}
          onChange={(v) => updateField("success_metrics", v)}
          onBlur={handleBlur}
          rows={3}
        />
        <EditableField
          label="Câu hỏi còn mở"
          value={sol.open_questions}
          onChange={(v) => updateField("open_questions", v)}
          onBlur={handleBlur}
          rows={3}
        />
      </div>

      {/* Actions */}
      {sol.status === "draft" && (
        <div className="flex gap-3">
          <button
            onClick={handleApprove}
            className="bg-green-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-green-700 transition"
          >
            Approve
          </button>
          <button
            onClick={() => setRejectModal(true)}
            className="bg-red-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition"
          >
            Reject
          </button>
        </div>
      )}

      {/* Reject modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-900 mb-3">Lý do từ chối</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              rows={3}
              placeholder="Nhập lý do..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleReject}
                disabled={!rejectReason.trim()}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Xác nhận từ chối
              </button>
              <button
                onClick={() => setRejectModal(false)}
                className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
