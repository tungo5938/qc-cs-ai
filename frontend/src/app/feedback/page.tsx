"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Feedback } from "@/lib/types";
import { PRODUCT_FILTER_KEY } from "@/components/NavBar";
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_COLORS,
  FEEDBACK_SOURCE_LABELS,
  FEEDBACK_SOURCE_COLORS,
  FEEDBACK_TYPE_LABELS,
  FEEDBACK_TYPE_COLORS,
  IMPACT_LABELS,
  IMPACT_COLORS,
} from "@/lib/constants";

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "new", label: "Mới" },
  { value: "analyzing", label: "Đang phân tích" },
  { value: "analyzed", label: "Đã phân tích" },
  { value: "solution_drafted", label: "Đã tạo solution" },
];

const TYPE_TABS = [
  { value: "", label: "Tất cả" },
  { value: "bug", label: "🐛 Bug" },
  { value: "feature", label: "✨ Feature" },
  { value: "unclear", label: "❓ Chưa rõ" },
];

const EXPORT_FIELD_GROUPS = [
  { key: "basic", label: "Thông tin cơ bản", desc: "ID, sản phẩm, loại, nguồn, trạng thái, ngày tạo" },
  { key: "content", label: "Nội dung", desc: "Nội dung raw, người gửi" },
  { key: "ratings", label: "Điểm đánh giá", desc: "User rating, PO rating, Dev rating, Priority score" },
  { key: "analysis", label: "Phân tích AI", desc: "Root cause, impact level, affected area" },
  { key: "solution", label: "Solution", desc: "Problem statement, proposed solution, effort size" },
];

// ── Inline rating input ──────────────────────────────────────────────────────
function RatingInput({
  label,
  value,
  onSave,
}: {
  label: string;
  value: number | null | undefined;
  onSave: (v: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 1 || num > 10) return;
    setSaving(true);
    try {
      await onSave(num);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <span className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
        <span className="text-xs text-gray-500">{label}</span>
        <input
          type="number"
          min={1}
          max={10}
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") submit();
            if (e.key === "Escape") setEditing(false);
          }}
          className="w-12 border border-gray-300 rounded px-1 py-0.5 text-xs text-center focus:outline-none focus:ring-1 focus:ring-red-500"
        />
        <button
          onClick={submit}
          disabled={saving}
          className="text-xs text-green-600 hover:text-green-800 disabled:opacity-50"
        >
          ✓
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={e => {
        e.stopPropagation();
        setDraft(value?.toString() ?? "");
        setEditing(true);
      }}
      className="text-xs text-gray-500 hover:text-red-600 hover:underline transition"
      title="Click để chỉnh điểm"
    >
      {label} {value != null ? `${value}/10` : <span className="text-gray-300">–/10</span>}
    </button>
  );
}

// ── Rating cells for modal (always-visible inputs, save on Enter/blur) ───────
function ModalRatings({
  fb,
  onSave,
}: {
  fb: Feedback;
  onSave: (field: "user_priority" | "tu_danh_gia" | "tech_rating", val: number) => Promise<void>;
}) {
  const FIELDS: { label: string; field: "user_priority" | "tu_danh_gia" | "tech_rating"; value: number | null | undefined }[] = [
    { label: "👤 User", field: "user_priority", value: fb.user_priority },
    { label: "📊 PO", field: "tu_danh_gia", value: fb.tu_danh_gia },
    { label: "⚙️ Dev", field: "tech_rating", value: fb.tech_rating },
  ];
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Đánh giá ưu tiên</p>
      <div className="grid grid-cols-4 gap-2">
        {FIELDS.map(r => (
          <ModalRatingCell key={r.field} label={r.label} field={r.field} serverValue={r.value} onSave={onSave} />
        ))}
        <div className="flex flex-col items-center justify-center bg-orange-50 rounded-lg p-3 border border-orange-100">
          <p className="text-xs text-gray-500 mb-0.5">★ Tổng</p>
          <p className="text-xl font-bold text-orange-600 leading-none">
            {fb.priority_score != null ? fb.priority_score.toFixed(1) : <span className="text-gray-300">—</span>}
          </p>
        </div>
      </div>
    </div>
  );
}

function ModalRatingCell({
  label,
  field,
  serverValue,
  onSave,
}: {
  label: string;
  field: "user_priority" | "tu_danh_gia" | "tech_rating";
  serverValue: number | null | undefined;
  onSave: (field: "user_priority" | "tu_danh_gia" | "tech_rating", val: number) => Promise<void>;
}) {
  const [draft, setDraft] = useState(serverValue?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Sync when server value changes (e.g. after save)
  useEffect(() => {
    setDraft(serverValue?.toString() ?? "");
  }, [serverValue]);

  async function commit() {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 1 || num > 10) return;
    if (num === serverValue) return;
    setSaving(true);
    try {
      await onSave(field, num);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-center bg-white rounded-lg p-3 border border-gray-100 gap-1.5">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <div className="flex items-center gap-1">
        <input
          type="number"
          min={1}
          max={10}
          value={draft}
          placeholder="—"
          onChange={e => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          onClick={e => e.stopPropagation()}
          className="w-12 text-center text-base font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        <span className="text-xs text-gray-400">/10</span>
      </div>
      {saving && <span className="text-xs text-gray-400">lưu...</span>}
      {saved && <span className="text-xs text-green-500">✓</span>}
    </div>
  );
}

// ── Inline text edit ─────────────────────────────────────────────────────────
function InlineTextEdit({
  label,
  value,
  onSave,
  multiline = false,
  placeholder = "Chưa có nội dung...",
}: {
  label: string;
  value: string | null | undefined;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value ?? ""); }, [value]);

  async function submit() {
    if (draft === (value ?? "")) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        {label && <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>}
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditing(false); }}
            className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
        <div className="flex gap-2">
          <button onClick={submit} disabled={saving} className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Đang lưu..." : "✓ Lưu"}
          </button>
          <button onClick={() => { setEditing(false); setDraft(value ?? ""); }} className="text-xs px-3 py-1 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50">
            Huỷ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>}
      <button
        onClick={() => setEditing(true)}
        className="text-left w-full text-sm text-gray-800 whitespace-pre-wrap leading-relaxed hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition group"
        title="Click để chỉnh sửa"
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="text-gray-300 italic">{placeholder}</span>
        )}
        <span className="ml-1 text-gray-300 group-hover:text-gray-400 text-xs">✏️</span>
      </button>
    </div>
  );
}

// ── Jira preview panel ───────────────────────────────────────────────────────
function JiraPreviewPanel({
  fb,
  draft,
  onChange,
  onSubmit,
  onCancel,
  creating,
  result,
}: {
  fb: Feedback;
  draft: { title: string; acceptance_criteria: string; sprint_name: string };
  onChange: (patch: Partial<{ title: string; acceptance_criteria: string; sprint_name: string }>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  creating: boolean;
  result: { key: string; url: string } | null;
}) {
  const descriptionPreview = [
    fb.raw_content ? `## Nội dung gốc\n${fb.raw_content}` : "",
    fb.analysis?.root_cause ? `## Kết quả phân tích\n${fb.analysis.root_cause}` : "",
    fb.analysis?.solution_hint ? `## Hướng giải quyết\n${fb.analysis.solution_hint}` : "",
    draft.acceptance_criteria ? `## Acceptance Criteria\n${draft.acceptance_criteria}` : "",
  ].filter(Boolean).join("\n\n");

  return (
    <div className="h-full flex flex-col bg-white p-5 overflow-y-auto space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">🎫 Tạo Jira ticket</p>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">← Huỷ</button>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Tiêu đề *</p>
        <input
          type="text"
          value={draft.title}
          onChange={e => onChange({ title: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Description (preview)</p>
        <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto border border-gray-100">
          {descriptionPreview || "(trống)"}
        </pre>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Acceptance Criteria</p>
        <textarea
          value={draft.acceptance_criteria}
          onChange={e => onChange({ acceptance_criteria: e.target.value })}
          rows={4}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Sprint (tuỳ chọn)</p>
        <input
          type="text"
          value={draft.sprint_name}
          onChange={e => onChange({ sprint_name: e.target.value })}
          placeholder="e.g. GB sprint 5"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs text-gray-500">
        <p><span className="font-medium">Assignee:</span> tunm1@ghn.vn</p>
        <p><span className="font-medium">Epic:</span> GB-488</p>
        <p><span className="font-medium">Project:</span> GB</p>
        <p><span className="font-medium">Type:</span> Story</p>
      </div>

      {result ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-green-700 font-medium">✅ Tạo thành công!</p>
          <a href={result.url} target="_blank" rel="noopener noreferrer"
            className="text-sm font-bold text-blue-600 hover:underline">
            {result.key} ↗
          </a>
        </div>
      ) : (
        <button
          onClick={onSubmit}
          disabled={creating || !draft.title.trim()}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {creating ? "Đang tạo..." : "🚀 Tạo Jira ticket"}
        </button>
      )}
    </div>
  );
}

// ── Feedback detail modal ────────────────────────────────────────────────────
function FeedbackDetailModal({
  feedbackId,
  onClose,
  onUpdated,
}: {
  feedbackId: string;
  onClose: () => void;
  onUpdated: (fb: Feedback) => void;
}) {
  const [fb, setFb] = useState<Feedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [zoomUrl, setZoomUrl] = useState<string | null>(null);
  const [generatingSolution, setGeneratingSolution] = useState(false);
  const [showJiraPanel, setShowJiraPanel] = useState(false);
  const [jiraDraft, setJiraDraft] = useState<{ title: string; acceptance_criteria: string; sprint_name: string } | null>(null);
  const [preparingJira, setPreparingJira] = useState(false);
  const [creatingJira, setCreatingJira] = useState(false);
  const [jiraResult, setJiraResult] = useState<{ key: string; url: string } | null>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.feedbacks.get(feedbackId)
      .then(r => setFb(r as Feedback))
      .finally(() => setLoading(false));
  }, [feedbackId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { if (zoomUrl) setZoomUrl(null); else onClose(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, zoomUrl]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  async function handleAnalyze() {
    if (!fb) return;
    setAnalyzing(true);
    try {
      const updated = await api.feedbacks.analyze(fb.id);
      setFb(updated as Feedback);
      onUpdated(updated as Feedback);
    } finally {
      setAnalyzing(false);
    }
  }

  async function saveRating(field: "user_priority" | "tu_danh_gia" | "tech_rating", val: number) {
    if (!fb) return;
    const updated = await api.feedbackRating.rate(fb.id, { [field]: val });
    setFb(prev => prev ? { ...prev, ...updated } : prev);
    onUpdated({ ...fb, ...updated });
  }

  async function saveTitle(v: string) {
    if (!fb) return;
    const updated = await api.feedbacks.update(fb.id, { title: v });
    setFb(updated as Feedback);
    onUpdated(updated as Feedback);
  }

  async function saveRawContent(v: string) {
    if (!fb) return;
    const updated = await api.feedbacks.update(fb.id, { raw_content: v });
    setFb(updated as Feedback);
    onUpdated(updated as Feedback);
  }

  async function saveRootCause(v: string) {
    if (!fb) return;
    const updated = await api.feedbacks.updateAnalysis(fb.id, { root_cause: v });
    setFb(updated as Feedback);
    onUpdated(updated as Feedback);
  }

  async function saveSolutionHint(v: string) {
    if (!fb) return;
    const updated = await api.feedbacks.updateAnalysis(fb.id, { solution_hint: v });
    setFb(updated as Feedback);
    onUpdated(updated as Feedback);
  }

  async function handleGenerateSolution() {
    if (!fb) return;
    setGeneratingSolution(true);
    try {
      const updated = await api.feedbacks.generateSolution(fb.id);
      setFb(updated as Feedback);
      onUpdated(updated as Feedback);
    } finally {
      setGeneratingSolution(false);
    }
  }

  async function handleOpenJiraPanel() {
    if (!fb) return;
    setPreparingJira(true);
    try {
      let currentFb = fb;
      if (!currentFb.analysis?.solution_hint) {
        const updated = await api.feedbacks.generateSolution(fb.id);
        currentFb = updated as Feedback;
        setFb(currentFb);
        onUpdated(currentFb);
      }
      const { acceptance_criteria } = await api.feedbacks.generateAC(currentFb.id);
      setJiraDraft({
        title: currentFb.title ?? currentFb.raw_content.slice(0, 80),
        acceptance_criteria,
        sprint_name: "",
      });
      setShowJiraPanel(true);
      setJiraResult(null);
    } finally {
      setPreparingJira(false);
    }
  }

  async function handleCreateJira() {
    if (!fb || !jiraDraft) return;
    setCreatingJira(true);
    try {
      const result = await api.feedbacks.createJira(fb.id, {
        title: jiraDraft.title,
        raw_content: fb.raw_content,
        root_cause: fb.analysis?.root_cause ?? undefined,
        solution_hint: fb.analysis?.solution_hint ?? undefined,
        acceptance_criteria: jiraDraft.acceptance_criteria,
        sprint_name: jiraDraft.sprint_name || undefined,
        upload_attachments: true,
      });
      setJiraResult(result);
    } finally {
      setCreatingJira(false);
    }
  }

  const hasImages = (fb?.media_urls?.length ?? 0) > 0;

  return (
    <>
      {/* Image zoom overlay */}
      {zoomUrl && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 cursor-zoom-out"
          onClick={() => setZoomUrl(null)}
        >
          <img src={zoomUrl} alt="zoom" className="max-w-[95vw] max-h-[95vh] object-contain rounded-lg shadow-2xl" />
        </div>
      )}

      <div
        ref={backdropRef}
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-3"
        onClick={e => { if (e.target === backdropRef.current) onClose(); }}
      >
        {/* Modal — nearly full-screen on desktop */}
        <div className="bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden w-[96vw] max-w-[1500px]"
          style={{ height: "92vh" }}>

          {/* Header */}
          <div className="flex items-start justify-between gap-4 px-6 py-4 border-b border-gray-100 shrink-0">
            <div className="flex-1 min-w-0">
              {loading ? (
                <div className="h-5 w-48 bg-gray-100 rounded animate-pulse" />
              ) : (
                <>
                  {fb?.title && (
                    <h2 className="text-base font-semibold text-gray-900 leading-snug">{fb.title}</h2>
                  )}
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {fb?.product_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">{fb.product_name}</span>
                    )}
                    {fb?.feedback_type && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FEEDBACK_TYPE_COLORS[fb.feedback_type] ?? "bg-gray-100 text-gray-600"}`}>
                        {FEEDBACK_TYPE_LABELS[fb.feedback_type] ?? fb.feedback_type}
                      </span>
                    )}
                    {fb && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FEEDBACK_SOURCE_COLORS[fb.source] ?? "bg-gray-100 text-gray-600"}`}>
                        {FEEDBACK_SOURCE_LABELS[fb.source] ?? fb.source}
                      </span>
                    )}
                    {fb && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FEEDBACK_STATUS_COLORS[fb.status] ?? "bg-gray-100 text-gray-600"}`}>
                        {FEEDBACK_STATUS_LABELS[fb.status] ?? fb.status}
                      </span>
                    )}
                    {fb?.priority_score != null && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold">
                        ★ {fb.priority_score.toFixed(1)}
                      </span>
                    )}
                  </div>
                </>
              )}
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-xl leading-none shrink-0 mt-0.5">✕</button>
          </div>

          {/* Body — two columns when images present */}
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-gray-400">Đang tải...</div>
          ) : !fb ? null : (
            <div className={`flex-1 overflow-hidden flex ${hasImages ? "flex-row" : "flex-col"}`}>

              {/* LEFT: content + ratings + analysis */}
              <div className={`overflow-y-auto p-5 space-y-4 ${hasImages ? "w-[42%] border-r border-gray-100" : "w-full"}`}>
                {/* Title inline edit */}
                {fb.title && (
                  <InlineTextEdit
                    label="Tiêu đề"
                    value={fb.title}
                    onSave={saveTitle}
                  />
                )}

                {/* Raw content inline edit */}
                <InlineTextEdit
                  label="Nội dung gốc"
                  value={fb.raw_content}
                  onSave={saveRawContent}
                  multiline
                />

                {/* Ratings — always-visible inputs */}
                <ModalRatings fb={fb} onSave={saveRating} />

                {/* Analyze button */}
                {(fb.status === "new" || fb.status === "analyzing") && (
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing || fb.status === "analyzing"}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {analyzing || fb.status === "analyzing" ? "Đang phân tích..." : "Phân tích AI"}
                  </button>
                )}

                {/* Analysis */}
                {fb.analysis && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Kết quả phân tích AI</p>
                    <InlineTextEdit
                      label="Nguyên nhân gốc rễ"
                      value={fb.analysis.root_cause}
                      onSave={saveRootCause}
                      multiline
                    />
                    <div className="flex flex-wrap gap-2">
                      {fb.analysis.impact_level && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${IMPACT_COLORS[fb.analysis.impact_level] ?? "bg-gray-100 text-gray-600"}`}>
                          {IMPACT_LABELS[fb.analysis.impact_level] ?? fb.analysis.impact_level}
                        </span>
                      )}
                      {fb.analysis.affected_area && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
                          {fb.analysis.affected_area}
                        </span>
                      )}
                    </div>
                  </div>
                )}

                {/* Hướng giải quyết */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hướng giải quyết</p>
                    <button
                      onClick={handleGenerateSolution}
                      disabled={generatingSolution}
                      className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition disabled:opacity-50"
                    >
                      {generatingSolution ? "Đang tạo..." : "✨ AI"}
                    </button>
                  </div>
                  <InlineTextEdit
                    label=""
                    value={fb.analysis?.solution_hint}
                    onSave={saveSolutionHint}
                    multiline
                    placeholder="Chưa có hướng giải quyết. Bấm ✨ AI để tạo tự động."
                  />
                </div>

                {/* Solution link */}
                {fb.solution_id && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 flex items-center justify-between">
                    <p className="text-sm text-green-700">Đã có solution draft.</p>
                    <Link href={`/solutions/${fb.solution_id}`} className="text-sm font-medium text-green-700 underline" onClick={onClose}>
                      Xem →
                    </Link>
                  </div>
                )}

                {/* Jira button */}
                <button
                  onClick={handleOpenJiraPanel}
                  disabled={preparingJira}
                  className="w-full flex items-center justify-center gap-2 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition disabled:opacity-50"
                >
                  {preparingJira ? "Đang chuẩn bị..." : "🎫 Tạo Jira ticket"}
                </button>

                <div className="flex justify-end pt-1">
                  <Link href={`/feedback/${fb.id}`} className="text-xs text-gray-400 hover:text-gray-600 underline" onClick={onClose}>
                    Mở trang riêng →
                  </Link>
                </div>
              </div>

              {/* RIGHT: image panel */}
              {hasImages && (
                <div className="w-[58%] overflow-y-auto bg-gray-950 flex flex-col gap-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide px-4 pt-4 pb-2 shrink-0">
                    Hình ảnh đính kèm · {fb.media_urls!.length} ảnh
                  </p>
                  <div className="flex flex-col gap-1 px-3 pb-4">
                    {fb.media_urls!.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setZoomUrl(url)}
                        className="block w-full rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/50 hover:opacity-95 transition"
                        title="Click để phóng to"
                      >
                        <img
                          src={url}
                          alt={`Ảnh ${i + 1}`}
                          className="w-full object-contain bg-gray-900"
                          onError={e => { (e.target as HTMLImageElement).closest("button")!.style.display = "none"; }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Feedback card ────────────────────────────────────────────────────────────
function FeedbackCard({
  fb,
  onRated,
  onOpen,
}: {
  fb: Feedback;
  onRated: (id: string, updated: Partial<Feedback>) => void;
  onOpen: (id: string) => void;
}) {
  async function saveRating(field: "user_priority" | "tu_danh_gia" | "tech_rating", val: number) {
    const updated = await api.feedbackRating.rate(fb.id, { [field]: val });
    onRated(fb.id, updated);
  }

  return (
    <div
      className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-red-200 hover:shadow-md transition cursor-pointer"
      onClick={() => onOpen(fb.id)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {fb.product_name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                {fb.product_name}
              </span>
            )}
            {fb.feedback_type && (
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FEEDBACK_TYPE_COLORS[fb.feedback_type] ?? "bg-gray-100 text-gray-600"}`}>
                {FEEDBACK_TYPE_LABELS[fb.feedback_type] ?? fb.feedback_type}
              </span>
            )}
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FEEDBACK_SOURCE_COLORS[fb.source] ?? "bg-gray-100 text-gray-600"}`}>
              {FEEDBACK_SOURCE_LABELS[fb.source] ?? fb.source}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${FEEDBACK_STATUS_COLORS[fb.status] ?? "bg-gray-100 text-gray-600"}`}>
              {FEEDBACK_STATUS_LABELS[fb.status] ?? fb.status}
            </span>
            {fb.priority_score != null && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 font-semibold">
                ★ {fb.priority_score.toFixed(1)}
              </span>
            )}
          </div>

          {/* Title if available, otherwise raw content preview */}
          {fb.title ? (
            <>
              <p className="text-sm font-medium text-gray-900">{fb.title}</p>
              <p className="text-xs text-gray-400 line-clamp-1 mt-0.5">{fb.raw_content}</p>
            </>
          ) : (
            <p className="text-sm text-gray-800 line-clamp-2">{fb.raw_content}</p>
          )}
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(fb.created_at).toLocaleDateString("vi-VN")}
        </span>
      </div>

      {/* Inline ratings row */}
      <div className="flex flex-wrap gap-4 mt-3 pt-2 border-t border-gray-50">
        <RatingInput label="👤 User" value={fb.user_priority} onSave={v => saveRating("user_priority", v)} />
        <RatingInput label="📊 PO" value={fb.tu_danh_gia} onSave={v => saveRating("tu_danh_gia", v)} />
        <RatingInput label="⚙️ Dev" value={fb.tech_rating} onSave={v => saveRating("tech_rating", v)} />
      </div>
    </div>
  );
}

// ── Export modal ─────────────────────────────────────────────────────────────
function ExportModal({
  productId,
  statusFilter,
  typeFilter,
  onClose,
}: {
  productId: string;
  statusFilter: string;
  typeFilter: string;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState<Set<string>>(new Set(["basic", "content", "ratings"]));

  function toggle(key: string) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function download() {
    if (selected.size === 0) return;
    const url = api.feedbackRating.exportUrl({
      product_id: productId || undefined,
      status: statusFilter || undefined,
      feedback_type: typeFilter || undefined,
      fields: Array.from(selected).join(","),
    });
    window.open(url, "_blank");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Xuất Excel</h2>
        <p className="text-xs text-gray-500 mb-4">Chọn nhóm thông tin muốn xuất. Áp dụng bộ lọc hiện tại.</p>
        <div className="space-y-2 mb-6">
          {EXPORT_FIELD_GROUPS.map(g => (
            <label key={g.key} className="flex items-start gap-3 cursor-pointer p-3 rounded-lg border border-gray-100 hover:border-red-200 transition">
              <input type="checkbox" checked={selected.has(g.key)} onChange={() => toggle(g.key)} className="mt-0.5 accent-red-600" />
              <div>
                <p className="text-sm font-medium text-gray-800">{g.label}</p>
                <p className="text-xs text-gray-400">{g.desc}</p>
              </div>
            </label>
          ))}
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">Huỷ</button>
          <button onClick={download} disabled={selected.size === 0} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-medium">Tải xuống</button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FeedbackListPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [productId, setProductId] = useState<string>("");
  const [syncing, setSyncing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [openModalId, setOpenModalId] = useState<string | null>(null);

  const load = useCallback((pid: string, status: string, type: string) => {
    setLoading(true);
    api.feedbacks
      .list({ product_id: pid || undefined, status: status || undefined, feedback_type: type || undefined })
      .then(r => setFeedbacks(r as Feedback[]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const pid = localStorage.getItem(PRODUCT_FILTER_KEY) || "";
    setProductId(pid);
    load(pid, statusFilter, typeFilter);

    function onStorage(e: StorageEvent) {
      if (e.key === PRODUCT_FILTER_KEY) {
        const newPid = e.newValue || "";
        setProductId(newPid);
        load(newPid, statusFilter, typeFilter);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load, statusFilter, typeFilter]);

  function handleStatusChange(s: string) { setStatusFilter(s); load(productId, s, typeFilter); }
  function handleTypeChange(t: string) { setTypeFilter(t); load(productId, statusFilter, t); }

  async function handleSync() {
    if (!productId) return;
    setSyncing(true);
    try {
      const data = await api.feedbacks.syncSheet(productId);
      alert(`Sync xong: ${data.imported} mới, ${data.skipped} đã có`);
      load(productId, statusFilter, typeFilter);
    } catch (e: any) {
      alert("Sync failed: " + e.message);
    } finally {
      setSyncing(false);
    }
  }

  function handleRated(id: string, updated: Partial<Feedback>) {
    setFeedbacks(prev => prev.map(fb => fb.id === id ? { ...fb, ...updated } : fb));
  }

  function handleModalUpdated(updated: Feedback) {
    setFeedbacks(prev => prev.map(fb => fb.id === updated.id ? { ...fb, ...updated } : fb));
  }

  return (
    <div className="space-y-6">
      {showExport && (
        <ExportModal productId={productId} statusFilter={statusFilter} typeFilter={typeFilter} onClose={() => setShowExport(false)} />
      )}
      {openModalId && (
        <FeedbackDetailModal
          feedbackId={openModalId}
          onClose={() => setOpenModalId(null)}
          onUpdated={handleModalUpdated}
        />
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Phản hồi</h1>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExport(true)} className="text-sm px-4 py-2 rounded-lg border border-gray-300 text-gray-700 hover:bg-gray-50 transition">
            ↓ Xuất Excel
          </button>
          {productId && (
            <button onClick={handleSync} disabled={syncing} className="text-sm px-4 py-2 rounded-lg border border-green-300 text-green-700 hover:bg-green-50 transition disabled:opacity-50">
              {syncing ? "Syncing..." : "Sync Sheet"}
            </button>
          )}
          <Link href="/feedback/new" className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium">
            + Thêm manual
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
          {STATUS_TABS.map(tab => (
            <button key={tab.value} onClick={() => handleStatusChange(tab.value)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${statusFilter === tab.value ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
          {TYPE_TABS.map(tab => (
            <button key={tab.value} onClick={() => handleTypeChange(tab.value)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${typeFilter === tab.value ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"}`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Chưa có feedback nào.</div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map(fb => (
            <FeedbackCard key={fb.id} fb={fb} onRated={handleRated} onOpen={setOpenModalId} />
          ))}
        </div>
      )}
    </div>
  );
}
