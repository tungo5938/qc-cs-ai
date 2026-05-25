"use client";
import { useState, useEffect, useCallback, useRef, useMemo, memo } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
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
  { value: "draft", label: "Nháp" },
  { value: "evaluating", label: "Đang đánh giá" },
  { value: "planned", label: "Đã lên kế hoạch" },
  { value: "in_progress", label: "Đang thực hiện" },
  { value: "solution_drafted", label: "Có solution draft" },
  { value: "uat", label: "Sẵn sàng UAT" },
  { value: "done", label: "Done" },
];

const TYPE_TABS = [
  { value: "", label: "Tất cả" },
  { value: "bug", label: "Bug" },
  { value: "feature", label: "Feature" },
  { value: "unclear", label: "Chưa rõ" },
];

const TEAM_TABS = [
  { value: "", label: "Tất cả" },
  { value: "TEL", label: "TEL" },
  { value: "B2C", label: "B2C" },
  { value: "C2C", label: "C2C" },
];

const TEAM_COLORS: Record<string, string> = {
  TEL: "bg-violet-100 text-violet-800",
  B2C: "bg-sky-100 text-sky-800",
  C2C: "bg-teal-100 text-teal-800",
};

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
type RatingField = "user_priority" | "tu_danh_gia" | "tech_rating";
type NoteField = "user_priority_note" | "tu_danh_gia_note" | "tech_rating_note";

function ModalRatings({
  fb,
  onSave,
}: {
  fb: Feedback;
  onSave: (field: RatingField, val: number, note?: string) => Promise<void>;
}) {
  const FIELDS: { label: string; field: RatingField; noteField: NoteField; value: number | null | undefined; note: string | null | undefined }[] = [
    { label: "User", field: "user_priority", noteField: "user_priority_note", value: fb.user_priority, note: fb.user_priority_note },
    { label: "PO", field: "tu_danh_gia", noteField: "tu_danh_gia_note", value: fb.tu_danh_gia, note: fb.tu_danh_gia_note },
    { label: "Dev", field: "tech_rating", noteField: "tech_rating_note", value: fb.tech_rating, note: fb.tech_rating_note },
  ];
  return (
    <div className="bg-gray-50 rounded-xl p-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-3">Đánh giá ưu tiên</p>
      <div className="grid grid-cols-4 gap-2">
        {FIELDS.map(r => (
          <ModalRatingCell key={r.field} label={r.label} field={r.field} serverValue={r.value} serverNote={r.note} onSave={onSave} />
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
  serverNote,
  onSave,
}: {
  label: string;
  field: RatingField;
  serverValue: number | null | undefined;
  serverNote: string | null | undefined;
  onSave: (field: RatingField, val: number, note?: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState(serverValue?.toString() ?? "");
  const [note, setNote] = useState(serverNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => { setDraft(serverValue?.toString() ?? ""); }, [serverValue]);
  useEffect(() => { setNote(serverNote ?? ""); }, [serverNote]);

  async function commit(currentNote?: string) {
    const num = parseInt(draft, 10);
    const noteVal = currentNote ?? note;
    const numChanged = !isNaN(num) && num >= 1 && num <= 10 && num !== serverValue;
    const noteChanged = noteVal !== (serverNote ?? "");
    if (!numChanged && !noteChanged) return;
    setSaving(true);
    try {
      const val = numChanged ? num : (serverValue ?? 1);
      await onSave(field, val, noteVal);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col bg-white rounded-lg p-3 border border-gray-100 gap-1.5">
      <p className="text-xs text-gray-500 font-medium text-center">{label}</p>
      <div className="flex items-center justify-center gap-1">
        <input
          type="number"
          min={1}
          max={10}
          value={draft}
          placeholder="—"
          onChange={e => setDraft(e.target.value)}
          onBlur={() => commit()}
          onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); commit(); } }}
          onClick={e => e.stopPropagation()}
          className="w-12 text-center text-base font-semibold border border-gray-200 rounded-lg py-1 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
        />
        <span className="text-xs text-gray-400">/10</span>
      </div>
      <textarea
        value={note}
        onChange={e => setNote(e.target.value)}
        onBlur={() => commit(note)}
        onClick={e => e.stopPropagation()}
        placeholder="Ghi chú..."
        rows={2}
        className="w-full text-xs text-gray-600 border border-gray-200 rounded-lg px-2 py-1 resize-none focus:outline-none focus:ring-1 focus:ring-red-400 placeholder-gray-300"
      />
      {saving && <span className="text-xs text-gray-400 text-center">lưu...</span>}
      {saved && <span className="text-xs text-green-500 text-center">✓</span>}
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
        <svg className="inline ml-1 w-3 h-3 text-gray-300 group-hover:text-gray-400 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
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
  draft: { title: string; acceptance_criteria: string; sprint_name: string; epic_key?: string };
  onChange: (patch: Partial<{ title: string; acceptance_criteria: string; sprint_name: string; epic_key?: string }>) => void;
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
        <p className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l-4 5-4-5"/></svg>
          Tạo Jira ticket
        </p>
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

      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Epic (tuỳ chọn)</p>
        <input
          type="text"
          value={draft.epic_key ?? ""}
          onChange={e => onChange({ epic_key: e.target.value })}
          placeholder="e.g. GB-100"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs text-gray-500">
        <p><span className="font-medium">Assignee:</span> tunm1@ghn.vn</p>
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
          {creating ? "Đang tạo..." : (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
              Tạo Jira ticket
            </span>
          )}
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
  const [jiraDraft, setJiraDraft] = useState<{ title: string; acceptance_criteria: string; sprint_name: string; epic_key?: string } | null>(null);
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

  async function saveRating(field: "user_priority" | "tu_danh_gia" | "tech_rating", val: number, note?: string) {
    if (!fb) return;
    const noteField = (field + "_note") as "user_priority_note" | "tu_danh_gia_note" | "tech_rating_note";
    const updated = await api.feedbackRating.rate(fb.id, { [field]: val, [noteField]: note ?? "" });
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
        epic_key: jiraDraft.epic_key || undefined,
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
            <div className={`flex-1 overflow-hidden flex ${(hasImages || showJiraPanel) ? "flex-row" : "flex-col"}`}>

              {/* LEFT: content + ratings + analysis */}
              <div className={`overflow-y-auto p-5 space-y-4 ${(hasImages || showJiraPanel) ? "w-[42%] border-r border-gray-100" : "w-full"}`}>
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
                {(fb.status === "draft" || fb.status === "evaluating") && (
                  <button
                    onClick={handleAnalyze}
                    disabled={analyzing}
                    className="w-full bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition disabled:opacity-50"
                  >
                    {analyzing ? "Đang phân tích..." : "Phân tích AI"}
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
                      {generatingSolution ? "Đang tạo..." : (
                        <span className="flex items-center gap-1">
                          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                          AI
                        </span>
                      )}
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

                {/* Jira button */}
                <button
                  onClick={handleOpenJiraPanel}
                  disabled={preparingJira}
                  className="w-full flex items-center justify-center gap-2 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition disabled:opacity-50"
                >
                  {preparingJira ? "Đang chuẩn bị..." : (
                    <>
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 2l-4 5-4-5"/></svg>
                      Tạo Jira ticket
                    </>
                  )}
                </button>

                <div className="flex justify-end pt-1">
                  <Link href={`/feedback/${fb.id}`} className="text-xs text-gray-400 hover:text-gray-600 underline" onClick={onClose}>
                    Mở trang riêng →
                  </Link>
                </div>
              </div>

              {/* RIGHT: jira panel or image panel */}
              {showJiraPanel && jiraDraft ? (
                <div className="w-[58%] overflow-hidden flex flex-col border-l border-gray-100">
                  <JiraPreviewPanel
                    fb={fb}
                    draft={jiraDraft}
                    onChange={patch => setJiraDraft(prev => prev ? { ...prev, ...patch } : prev)}
                    onSubmit={handleCreateJira}
                    onCancel={() => setShowJiraPanel(false)}
                    creating={creatingJira}
                    result={jiraResult}
                  />
                </div>
              ) : hasImages ? (
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
              ) : null}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ── Sprint helpers ────────────────────────────────────────────────────────────
// Find "Thông báo Production" meeting date from a sprint's meetings
function getProductionDeadline(sprint: import("@/lib/types").Sprint): string | null {
  if (!sprint.meetings) return null;
  const prod = sprint.meetings.find(m => m.name.includes("Thông báo Production"));
  return prod?.scheduled_at?.slice(0, 10) ?? null;
}

function fmtDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}`;
}

// ── Compact rating cell (table) ───────────────────────────────────────────────
function RatingCell({
  value,
  onSave,
}: {
  value: number | null | undefined;
  onSave: (v: number) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value?.toString() ?? "");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const num = parseInt(draft, 10);
    if (isNaN(num) || num < 1 || num > 10) { setEditing(false); return; }
    setSaving(true);
    try { await onSave(num); setEditing(false); }
    finally { setSaving(false); }
  }

  if (editing) {
    return (
      <span onClick={e => e.stopPropagation()}>
        <input
          type="number" min={1} max={10}
          value={draft} autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={submit}
          onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditing(false); }}
          className="w-10 text-center text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-red-500"
        />
      </span>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setDraft(value?.toString() ?? ""); setEditing(true); }}
      className={`w-full text-center text-xs font-semibold rounded px-1 py-0.5 transition hover:ring-1 hover:ring-red-400 ${
        value == null ? "text-gray-300" : "text-gray-700 hover:text-red-600"
      }`}
      title="Click để chỉnh điểm"
    >
      {saving ? "…" : value ?? "—"}
    </button>
  );
}

// ── Sprint + Deadline cells ───────────────────────────────────────────────────

function SprintCell({
  fb,
  sprints,
  onSaved,
}: {
  fb: Feedback;
  sprints: import("@/lib/types").Sprint[];
  onSaved: (patch: Partial<Feedback>) => void;
}) {
  const [open, setOpen] = useState(false);

  async function select(sprint: import("@/lib/types").Sprint) {
    setOpen(false);
    const deadline =
      sprint.production_deadline ??
      getProductionDeadline(sprint) ??
      null;
    const prev = { sprint_id: fb.sprint_id, sprint_name: fb.sprint_name, deadline: fb.deadline };
    onSaved({ sprint_id: sprint.id, sprint_name: sprint.name, deadline });
    try {
      const updated = await api.feedbacks.update(fb.id, { sprint_id: sprint.id, deadline });
      onSaved({
        sprint_id: sprint.id,
        sprint_name: sprint.name,
        deadline: (updated as Feedback).deadline ?? deadline,
      });
    } catch {
      onSaved(prev);
    }
  }

  async function clear() {
    setOpen(false);
    const prev = { sprint_id: fb.sprint_id, sprint_name: fb.sprint_name, deadline: fb.deadline };
    onSaved({ sprint_id: null, sprint_name: null, deadline: null });
    try {
      await api.feedbacks.update(fb.id, { sprint_id: null, deadline: null });
    } catch {
      onSaved(prev);
    }
  }

  const label = fb.sprint_name ?? (fb.sprint_id ? "Sprint" : "—");

  return (
    <div onClick={e => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex max-w-full text-xs px-1.5 py-0.5 rounded transition hover:ring-1 hover:ring-blue-400 cursor-pointer text-left whitespace-nowrap ${
              fb.sprint_id ? "text-blue-700 font-semibold bg-blue-50" : "text-gray-300 hover:text-blue-500"
            }`}
            title={fb.sprint_name ?? undefined}
          >
            {label}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-52 p-0" align="end" sideOffset={4}>
          <Command>
            <CommandInput placeholder="Tìm sprint..." className="h-8 text-xs" />
            <CommandList>
              <CommandEmpty className="py-2 text-center text-xs text-gray-400">Không tìm thấy.</CommandEmpty>
              <CommandGroup>
                <CommandItem onSelect={clear} className="text-xs text-gray-400 cursor-pointer">
                  Bỏ chọn
                </CommandItem>
                {sprints.map(s => (
                  <CommandItem
                    key={s.id}
                    value={s.name}
                    onSelect={() => select(s)}
                    className={`text-xs cursor-pointer ${fb.sprint_id === s.id ? "font-semibold text-blue-700" : ""}`}
                  >
                    {s.name}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}

function DeadlineCell({
  fb,
  onSaved,
}: {
  fb: Feedback;
  onSaved: (patch: Partial<Feedback>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fb.deadline ?? "");

  useEffect(() => { setDraft(fb.deadline ?? ""); }, [fb.deadline]);

  async function commit(val: string) {
    setEditing(false);
    if (val === (fb.deadline ?? "")) return;
    const updated = await api.feedbacks.update(fb.id, { deadline: val || null });
    onSaved({ deadline: updated.deadline ?? null });
  }

  if (editing) {
    return (
      <span onClick={e => e.stopPropagation()}>
        <input
          type="date"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") commit(draft); if (e.key === "Escape") setEditing(false); }}
          className="text-xs border border-gray-300 rounded px-1 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500 w-28"
        />
      </span>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      className={`text-xs rounded px-1 py-0.5 transition hover:ring-1 hover:ring-blue-400 ${
        fb.deadline ? "text-gray-700 font-medium" : "text-gray-300 hover:text-blue-500"
      }`}
      title="Click để chỉnh deadline"
    >
      {fmtDate(fb.deadline)}
    </button>
  );
}

// ── SVG icons ─────────────────────────────────────────────────────────────────
function BugIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2l1.5 1.5" /><path d="M14.5 3.5L16 2" />
      <path d="M9 9a3 3 0 0 1 6 0v5a3 3 0 0 1-6 0V9Z" />
      <path d="M6.5 9H4a1 1 0 0 0-1 1v1a5 5 0 0 0 2.8 4.5" />
      <path d="M17.5 9H20a1 1 0 0 1 1 1v1a5 5 0 0 1-2.8 4.5" />
      <path d="M9 17.5a5 5 0 0 0 6 0" /><path d="M9 12h6" />
    </svg>
  );
}
function FeatureIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  );
}
function UnclearIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><path d="M12 17h.01" />
    </svg>
  );
}
function ChevronDown({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}
function CheckIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  );
}

// ── Type cell (dropdown) ─────────────────────────────────────────────────────
const TYPE_OPTIONS = [
  { value: "bug", label: "Bug", Icon: BugIcon },
  { value: "feature", label: "Feature", Icon: FeatureIcon },
  { value: "unclear", label: "Chưa rõ", Icon: UnclearIcon },
];

function TypeCell({ fb, onSaved }: { fb: Feedback; onSaved: (patch: Partial<Feedback>) => void }) {
  const [open, setOpen] = useState(false);

  async function select(value: string) {
    setOpen(false);
    if (value === (fb.feedback_type ?? "")) return;
    const prev = fb.feedback_type;
    onSaved({ feedback_type: value as import("@/lib/types").FeedbackType });
    try {
      const updated = await api.feedbacks.update(fb.id, { feedback_type: value });
      onSaved({ feedback_type: (updated as Feedback).feedback_type });
    } catch {
      onSaved({ feedback_type: prev });
    }
  }

  const typeOption = TYPE_OPTIONS.find((o) => o.value === fb.feedback_type);
  const typeColor = fb.feedback_type
    ? (FEEDBACK_TYPE_COLORS[fb.feedback_type] ?? "bg-gray-100 text-gray-500")
    : "";

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium transition cursor-pointer hover:ring-1 hover:ring-gray-400 ${
              typeOption ? typeColor : "text-gray-300 hover:text-gray-500"
            }`}
            title={typeOption ? `${typeOption.label} — click để đổi` : "Chọn loại"}
          >
            {typeOption ? (
              <>
                <typeOption.Icon className="w-3 h-3 shrink-0" />
                <span className="whitespace-nowrap">{typeOption.label}</span>
              </>
            ) : (
              <span>—</span>
            )}
            <ChevronDown className="w-2.5 h-2.5 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="start" sideOffset={4}>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition cursor-pointer ${
                fb.feedback_type === opt.value
                  ? "bg-gray-100 text-gray-900 font-semibold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <opt.Icon className="w-3 h-3 shrink-0" />
              <span className="flex-1 text-left">{opt.label}</span>
              {fb.feedback_type === opt.value && (
                <CheckIcon className="w-3 h-3 text-gray-500 shrink-0" />
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Status cell (dropdown) ────────────────────────────────────────────────────
function DraftIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}
function EvaluatingIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
    </svg>
  );
}
function PlannedIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  );
}
function InProgressIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22a10 10 0 1 1 0-20 10 10 0 0 1 0 20z" /><path d="M12 6v6l4 2" />
    </svg>
  );
}
function UATIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" /><path d="M21 12c-1 0-3-1-3-3s2-3 3-3 3 1 3 3-2 3-3 3" /><path d="M3 12c1 0 3-1 3-3S4 6 3 6 0 7 0 9s2 3 3 3" /><path d="M12 3c0 1-1 3-3 3s-3-2-3-3 1-3 3-3 3 2 3 3" /><path d="M12 21c0-1-1-3-3-3s-3 2-3 3 1 3 3 3 3-2 3-3" />
    </svg>
  );
}
function DoneIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function SolutionDraftedIcon({ className = "w-3 h-3" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><path d="m9 15 2 2 4-4" />
    </svg>
  );
}

const STATUS_OPTIONS = [
  { value: "draft", label: "Nháp", Icon: DraftIcon },
  { value: "evaluating", label: "Đang đánh giá", Icon: EvaluatingIcon },
  { value: "planned", label: "Đã lên kế hoạch", Icon: PlannedIcon },
  { value: "in_progress", label: "Đang thực hiện", Icon: InProgressIcon },
  { value: "solution_drafted", label: "Có solution draft", Icon: SolutionDraftedIcon },
  { value: "uat", label: "Sẵn sàng UAT", Icon: UATIcon },
  { value: "done", label: "Done", Icon: DoneIcon },
];

/** Hàng ẩn: width cột = label dài nhất trong options (+ sprint dài nhất) */
function FeedbackTableColumnSizer({ longestSprintName }: { longestSprintName: string }) {
  const statusLongest = STATUS_OPTIONS.reduce((a, b) =>
    a.label.length >= b.label.length ? a : b,
  );
  const typeLongest = TYPE_OPTIONS.reduce((a, b) =>
    a.label.length >= b.label.length ? a : b,
  );
  const badge = "inline-flex items-center gap-1 text-xs px-1.5 py-0.5 whitespace-nowrap";
  return (
    <tr className="h-0 overflow-hidden border-0" aria-hidden>
      <th className="p-0 border-0 font-normal">
        <span className="invisible block h-0 overflow-hidden">.</span>
      </th>
      <th className="p-0 border-0 font-normal">
        <span className={`${badge} invisible`}>B2C ▾</span>
      </th>
      <th className="p-0 border-0 font-normal">
        <span className={`${badge} invisible`}>
          <typeLongest.Icon className="w-3 h-3" />
          {typeLongest.label} ▾
        </span>
      </th>
      <th className="p-0 border-0 font-normal">
        <span className={`${badge} invisible`}>
          <statusLongest.Icon className="w-3 h-3" />
          {statusLongest.label} ▾
        </span>
      </th>
      <th colSpan={5} className="p-0 border-0" />
      <th className="p-0 border-0 font-normal">
        <span className={`${badge} invisible text-blue-700`}>
          {longestSprintName || "Sprint 00"} ▾
        </span>
      </th>
      <th colSpan={2} className="p-0 border-0" />
    </tr>
  );
}

function StatusCell({ fb, onSaved }: { fb: Feedback; onSaved: (patch: Partial<Feedback>) => void }) {
  const [open, setOpen] = useState(false);

  async function select(value: string) {
    setOpen(false);
    if (value === fb.status) return;
    const prev = fb.status;
    onSaved({ status: value as import("@/lib/types").FeedbackStatus });
    try {
      const updated = await api.feedbacks.update(fb.id, { status: value });
      onSaved({ status: (updated as Feedback).status });
    } catch {
      onSaved({ status: prev });
    }
  }

  const statusOption = STATUS_OPTIONS.find((o) => o.value === fb.status);
  const statusColor =
    FEEDBACK_STATUS_COLORS[fb.status] ?? "bg-gray-100 text-gray-500";

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium transition cursor-pointer hover:ring-1 hover:ring-gray-400 ${statusColor}`}
            title={statusOption ? `${statusOption.label} — click để đổi` : "Chọn trạng thái"}
          >
            {statusOption && (
              <statusOption.Icon className="w-3 h-3 shrink-0" />
            )}
            <span className="whitespace-nowrap">{statusOption?.label ?? fb.status}</span>
            <ChevronDown className="w-2.5 h-2.5 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-max min-w-[12rem] p-1" align="start" sideOffset={4}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition cursor-pointer ${
                fb.status === opt.value
                  ? "bg-gray-100 text-gray-900 font-semibold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <opt.Icon className="w-3 h-3 shrink-0" />
              <span className="flex-1 text-left">{opt.label}</span>
              {fb.status === opt.value && (
                <CheckIcon className="w-3 h-3 text-gray-500 shrink-0" />
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Team cell (dropdown) ──────────────────────────────────────────────────────
const TEAM_OPTIONS = [
  { value: "TEL", label: "TEL" },
  { value: "B2C", label: "B2C" },
  { value: "C2C", label: "C2C" },
];

function TeamCell({ fb, onSaved }: { fb: Feedback; onSaved: (patch: Partial<Feedback>) => void }) {
  const [open, setOpen] = useState(false);

  async function select(value: string | null) {
    setOpen(false);
    if (value === (fb.team ?? null)) return;
    const prev = fb.team;
    onSaved({ team: value });
    try {
      const updated = await api.feedbacks.update(fb.id, { team: value });
      onSaved({ team: (updated as Feedback).team });
    } catch {
      onSaved({ team: prev });
    }
  }

  const color = fb.team ? (TEAM_COLORS[fb.team] ?? "bg-gray-100 text-gray-600") : "";

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium transition cursor-pointer hover:ring-1 hover:ring-gray-400 ${
              fb.team ? color : "text-gray-300 hover:text-gray-500"
            }`}
            title={fb.team ? `${fb.team} — click để đổi` : "Chọn team"}
          >
            <span className="whitespace-nowrap">{fb.team ?? "—"}</span>
            <ChevronDown className="w-2.5 h-2.5 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-28 p-1" align="start" sideOffset={4}>
          <button
            onClick={() => select(null)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded text-gray-400 hover:bg-gray-50 cursor-pointer"
          >
            <span className="flex-1 text-left">Bỏ chọn</span>
            {!fb.team && <CheckIcon className="w-3 h-3 text-gray-400 shrink-0" />}
          </button>
          {TEAM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition cursor-pointer ${
                fb.team === opt.value
                  ? "bg-gray-100 text-gray-900 font-semibold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TEAM_COLORS[opt.value]}`}>
                {opt.label}
              </span>
              {fb.team === opt.value && (
                <CheckIcon className="w-3 h-3 text-gray-500 shrink-0 ml-auto" />
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}

// ── Notified cell ─────────────────────────────────────────────────────────────
function NotifiedCell({ fb, onSaved }: { fb: Feedback; onSaved: (patch: Partial<Feedback>) => void }) {
  const [saving, setSaving] = useState(false);

  async function toggle(e: React.MouseEvent) {
    e.stopPropagation();
    if (fb.status !== "done") return;
    setSaving(true);
    try {
      const updated = await api.feedbacks.update(fb.id, { notified: !fb.notified });
      onSaved({ notified: (updated as Feedback).notified });
    } finally {
      setSaving(false);
    }
  }

  if (fb.status !== "done") return <span className="text-gray-200 text-xs">—</span>;

  return (
    <button
      onClick={toggle}
      disabled={saving}
      title={fb.notified ? "Đã thông báo — click để bỏ" : "Chưa thông báo — click để đánh dấu"}
      className={`cursor-pointer transition ${saving ? "opacity-40" : ""} ${fb.notified ? "text-green-500" : "text-gray-300 hover:text-gray-500"}`}
    >
      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
        <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
      </svg>
    </button>
  );
}

// ── Title cell (inline edit in table) ────────────────────────────────────────
function TitleCell({
  fb,
  onSaved,
}: {
  fb: Feedback;
  onSaved: (patch: Partial<Feedback>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(fb.title ?? fb.raw_content ?? "");

  useEffect(() => { setDraft(fb.title ?? fb.raw_content ?? ""); }, [fb.title, fb.raw_content]);

  async function commit(val: string) {
    setEditing(false);
    if (val === (fb.title ?? "")) return;
    const updated = await api.feedbacks.update(fb.id, { title: val || undefined });
    onSaved({ title: (updated as Feedback).title });
  }

  if (editing) {
    return (
      <span onClick={e => e.stopPropagation()}>
        <input
          type="text"
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onBlur={e => commit(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") commit(draft);
            if (e.key === "Escape") { setEditing(false); setDraft(fb.title ?? fb.raw_content ?? ""); }
          }}
          className="w-full text-sm border border-blue-300 rounded px-2 py-0.5 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </span>
    );
  }

  return (
    <button
      onClick={e => { e.stopPropagation(); setEditing(true); }}
      className="text-left w-full text-sm font-medium text-gray-900 truncate leading-snug hover:text-blue-700 hover:underline transition group/title"
      title="Click để sửa tiêu đề"
    >
      {fb.title ?? fb.raw_content}
      <svg className="inline ml-1 w-3 h-3 opacity-0 group-hover/title:opacity-40 transition-opacity" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
    </button>
  );
}

// ── Feedback row (table) ──────────────────────────────────────────────────────
function FeedbackRow({
  fb,
  sprints,
  onRated,
  onOpen,
}: {
  fb: Feedback;
  sprints: import("@/lib/types").Sprint[];
  onRated: (id: string, updated: Partial<Feedback>) => void;
  onOpen: (id: string) => void;
}) {
  async function saveRating(field: "user_priority" | "tu_danh_gia" | "tech_rating", val: number) {
    const updated = await api.feedbackRating.rate(fb.id, { [field]: val });
    onRated(fb.id, updated);
  }

  return (
    <tr className="border-b border-gray-100 hover:bg-red-50/30 transition-colors group">
      {/* Title — chiếm phần còn lại; chỉ title bị truncate */}
      <td className="py-2 pl-3 pr-2 w-full max-w-0">
        <div className="min-w-0">
          <TitleCell fb={fb} onSaved={p => onRated(fb.id, p)} />
          {fb.product_name && (
            <p className="text-xs text-gray-400 truncate">{fb.product_name}</p>
          )}
        </div>
      </td>

      {/* Team — rộng theo giá trị dài nhất (B2C/TEL/C2C) */}
      <td className="py-2 px-2 whitespace-nowrap">
        <TeamCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>

      {/* Type — rộng theo label dài nhất (Chưa rõ) */}
      <td className="py-2 px-2 whitespace-nowrap">
        <TypeCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>

      {/* Status — rộng theo label dài nhất (Có solution draft) */}
      <td className="py-2 px-2 whitespace-nowrap">
        <StatusCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>

      {/* User rating */}
      <td className="py-2 px-1 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
        <RatingCell value={fb.user_priority} onSave={v => saveRating("user_priority", v)} />
      </td>

      {/* PO rating */}
      <td className="py-2 px-1 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
        <RatingCell value={fb.tu_danh_gia} onSave={v => saveRating("tu_danh_gia", v)} />
      </td>

      {/* Dev rating */}
      <td className="py-2 px-1 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
        <RatingCell value={fb.tech_rating} onSave={v => saveRating("tech_rating", v)} />
      </td>

      {/* Priority score */}
      <td className="py-2 px-2 whitespace-nowrap text-center">
        {fb.priority_score != null ? (
          <span className="text-xs font-bold text-orange-600">{fb.priority_score.toFixed(1)}</span>
        ) : (
          <span className="text-xs text-gray-300">—</span>
        )}
      </td>

      {/* Deadline */}
      <td className="py-2 px-2 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
        <DeadlineCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>

      {/* Sprint — rộng theo tên sprint dài nhất */}
      <td className="py-2 pl-2 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
        <SprintCell fb={fb} sprints={sprints} onSaved={p => onRated(fb.id, p)} />
      </td>

      {/* Notified */}
      <td className="py-2 px-2 whitespace-nowrap text-center" onClick={e => e.stopPropagation()}>
        <NotifiedCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>

      {/* Open modal */}
      <td className="py-2 pr-3 pl-1 whitespace-nowrap text-center">
        <button
          onClick={e => { e.stopPropagation(); onOpen(fb.id); }}
          className="text-gray-300 hover:text-red-500 transition opacity-0 group-hover:opacity-100 focus:opacity-100"
          title="Xem chi tiết"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </button>
      </td>
    </tr>
  );
}

const MemoFeedbackRow = memo(FeedbackRow);

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

const RATING_FILTERS = [
  { value: "", label: "Tất cả" },
  { value: "none", label: "Chưa ai đánh giá" },
  { value: "no_user", label: "Chưa User" },
  { value: "no_po", label: "Chưa PO" },
  { value: "no_dev", label: "Chưa Dev" },
];

function applyRatingFilter(feedbacks: Feedback[], ratingFilter: string): Feedback[] {
  switch (ratingFilter) {
    case "none":    return feedbacks.filter(fb => fb.user_priority == null && fb.tu_danh_gia == null && fb.tech_rating == null);
    case "no_user": return feedbacks.filter(fb => fb.user_priority == null);
    case "no_po":   return feedbacks.filter(fb => fb.tu_danh_gia == null);
    case "no_dev":  return feedbacks.filter(fb => fb.tech_rating == null);
    default:        return feedbacks;
  }
}

const PAGE_SIZE = 50;

const TEAM_OPTIONS_IMPORT = ["B2C", "TEL", "C2C"];

function ImportSheetModal({
  defaultProductId,
  onClose,
  onImported,
}: {
  defaultProductId: string;
  onClose: () => void;
  onImported: () => void;
}) {
  const [sheetUrl, setSheetUrl] = useState("");
  const [productId, setProductId] = useState(defaultProductId);
  const [team, setTeam] = useState("B2C");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ inserted: number; skipped: number } | null>(null);
  const [error, setError] = useState("");

  async function handleImport() {
    if (!sheetUrl.trim() || !productId.trim()) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await api.feedbacks.importSheet({ sheet_url: sheetUrl.trim(), product_id: productId.trim(), team, sheet_type: "b2c_bug" });
      setResult(res);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Import thất bại");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Import từ Google Sheet</h2>
        <p className="text-xs text-gray-500 mb-4">Hỗ trợ định dạng B2C bug sheet (18 cột). Sheet phải public hoặc export được.</p>

        <div className="space-y-3 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">URL Google Sheet *</label>
            <input
              type="url"
              value={sheetUrl}
              onChange={e => setSheetUrl(e.target.value)}
              placeholder="https://docs.google.com/spreadsheets/d/..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Product ID *</label>
            <input
              type="text"
              value={productId}
              onChange={e => setProductId(e.target.value)}
              placeholder="UUID của product"
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500 font-mono"
            />
            {defaultProductId && <p className="text-xs text-gray-400 mt-0.5">Đã điền từ filter hiện tại</p>}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Team</label>
            <div className="flex gap-2">
              {TEAM_OPTIONS_IMPORT.map(t => (
                <button
                  key={t}
                  onClick={() => setTeam(t)}
                  className={`px-3 py-1.5 text-xs rounded-lg border transition ${team === t ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:border-gray-400"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <p className="text-xs text-red-600 mb-3">{error}</p>}
        {result && (
          <div className="text-xs text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3">
            ✓ Import xong: <strong>{result.inserted}</strong> feedbacks đã thêm.
          </div>
        )}

        <div className="flex gap-3 justify-end">
          <button onClick={result ? onImported : onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50">
            {result ? "Đóng & tải lại" : "Huỷ"}
          </button>
          {!result && (
            <button
              onClick={handleImport}
              disabled={loading || !sheetUrl.trim() || !productId.trim()}
              className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 font-medium"
            >
              {loading ? "Đang import..." : "Import"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function FeedbackListPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [ratingFilter, setRatingFilter] = useState("");
  const [productId, setProductId] = useState<string>(() =>
    typeof window !== "undefined" ? localStorage.getItem(PRODUCT_FILTER_KEY) || "" : "",
  );
  const hasLoadedOnce = useRef(false);
  const [syncing, setSyncing] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showImportSheet, setShowImportSheet] = useState(false);
  const [openModalId, setOpenModalId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [sprints, setSprints] = useState<import("@/lib/types").Sprint[]>([]);

  const loadSprints = useCallback((pid: string) => {
    api.sprints
      .list(pid || undefined)
      .then((s: import("@/lib/types").Sprint[]) => setSprints(s))
      .catch(() => setSprints([]));
  }, []);

  const loadFeedbacks = useCallback(
    (pid: string, status: string, type: string, team: string, opts?: { isInitial?: boolean }) => {
      if (opts?.isInitial) setInitialLoading(true);
      else setRefreshing(true);
      setPage(1);
      api.feedbacks
        .list({
          product_id: pid || undefined,
          status: status || undefined,
          feedback_type: type || undefined,
          team: team || undefined,
        })
        .then(r => setFeedbacks(r as Feedback[]))
        .finally(() => {
          hasLoadedOnce.current = true;
          setInitialLoading(false);
          setRefreshing(false);
        });
    },
    [],
  );

  useEffect(() => {
    loadSprints(productId);
  }, [productId, loadSprints]);

  useEffect(() => {
    loadFeedbacks(productId, statusFilter, typeFilter, teamFilter, {
      isInitial: !hasLoadedOnce.current,
    });
  }, [productId, statusFilter, typeFilter, teamFilter, loadFeedbacks]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === PRODUCT_FILTER_KEY) {
        setProductId(e.newValue || "");
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  function handleStatusChange(s: string) { setStatusFilter(s); }
  function handleTypeChange(t: string) { setTypeFilter(t); }
  function handleTeamChange(t: string) { setTeamFilter(t); }

  async function handleSync() {
    if (!productId) return;
    setSyncing(true);
    try {
      const data = await api.feedbacks.syncSheet(productId);
      alert(`Sync xong: ${data.imported} mới, ${data.skipped} đã có`);
      loadFeedbacks(productId, statusFilter, typeFilter, teamFilter);
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

  const visibleFeedbacks = useMemo(() => applyRatingFilter(feedbacks, ratingFilter), [feedbacks, ratingFilter]);
  const pagedFeedbacks = useMemo(() => visibleFeedbacks.slice(0, page * PAGE_SIZE), [visibleFeedbacks, page]);
  const hasMore = pagedFeedbacks.length < visibleFeedbacks.length;
  const hasActiveFilter = statusFilter !== "" || typeFilter !== "" || teamFilter !== "" || ratingFilter !== "";

  const ratingCounts = useMemo(
    () => ({
      none: feedbacks.filter(fb => fb.user_priority == null && fb.tu_danh_gia == null && fb.tech_rating == null).length,
      no_user: feedbacks.filter(fb => fb.user_priority == null).length,
      no_po: feedbacks.filter(fb => fb.tu_danh_gia == null).length,
      no_dev: feedbacks.filter(fb => fb.tech_rating == null).length,
    }),
    [feedbacks],
  );

  const longestSprintName = useMemo(
    () =>
      sprints.reduce(
        (longest, s) => (s.name.length > longest.length ? s.name : longest),
        "",
      ),
    [sprints],
  );

  return (
    <div className="space-y-4">
      {showExport && (
        <ExportModal productId={productId} statusFilter={statusFilter} typeFilter={typeFilter} onClose={() => setShowExport(false)} />
      )}
      {showImportSheet && (
        <ImportSheetModal
          defaultProductId={productId}
          onClose={() => setShowImportSheet(false)}
          onImported={() => {
            setShowImportSheet(false);
            loadFeedbacks(productId, statusFilter, typeFilter, teamFilter);
          }}
        />
      )}
      {openModalId && (
        <FeedbackDetailModal
          feedbackId={openModalId}
          onClose={() => setOpenModalId(null)}
          onUpdated={handleModalUpdated}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl font-bold text-gray-900">Phản hồi</h1>
          {!initialLoading && (
            <span className="text-sm text-gray-400">
              {pagedFeedbacks.length}/{visibleFeedbacks.length}
              {feedbacks.length !== visibleFeedbacks.length ? ` (${feedbacks.length} tổng)` : ""}
              {refreshing ? " · đang tải…" : ""}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowExport(true)} className="text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600 transition">
            ↓ Excel
          </button>
          {productId && (
            <button onClick={handleSync} disabled={syncing} className="text-xs px-3 py-1.5 rounded-lg border border-green-800 text-green-400 hover:bg-green-900/20 transition disabled:opacity-50">
              {syncing ? "Syncing..." : "Sync Sheet"}
            </button>
          )}
          <button onClick={() => setShowImportSheet(true)} className="text-xs px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-400 hover:text-zinc-200 hover:border-zinc-600 transition">
            ↑ Import Sheet
          </button>
          <Link href="/feedback/new" className="bg-red-600 text-white text-xs px-3 py-1.5 rounded-lg hover:bg-red-700 transition font-medium">
            + Thêm
          </Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 space-y-2">
        {/* Status */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-500 w-14 shrink-0">Trạng thái</span>
          <div className="flex flex-wrap gap-1">
            {STATUS_TABS.map(tab => (
              <button key={tab.value} onClick={() => handleStatusChange(tab.value)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  statusFilter === tab.value
                    ? "bg-red-600/20 text-red-400 ring-1 ring-red-600/40"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-500 w-14 shrink-0">Loại</span>
          <div className="flex flex-wrap gap-1">
            {TYPE_TABS.map(tab => (
              <button key={tab.value} onClick={() => handleTypeChange(tab.value)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  typeFilter === tab.value
                    ? "bg-red-600/20 text-red-400 ring-1 ring-red-600/40"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Team */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-500 w-14 shrink-0">Team</span>
          <div className="flex flex-wrap gap-1">
            {TEAM_TABS.map(tab => (
              <button key={tab.value} onClick={() => handleTeamChange(tab.value)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  teamFilter === tab.value
                    ? "bg-violet-600/20 text-violet-400 ring-1 ring-violet-600/40"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}>
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Rating */}
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-gray-500 w-14 shrink-0">Đánh giá</span>
          <div className="flex flex-wrap gap-1">
            {RATING_FILTERS.map(tab => (
              <button key={tab.value} onClick={() => setRatingFilter(tab.value)}
                className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                  ratingFilter === tab.value
                    ? tab.value === "none"
                      ? "bg-orange-600/20 text-orange-400 ring-1 ring-orange-600/40"
                      : "bg-red-600/20 text-red-400 ring-1 ring-red-600/40"
                    : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                }`}>
                {tab.label}
                {tab.value !== "" && (
                  <span className="ml-1 text-gray-600">
                    {tab.value === "none"
                      ? ratingCounts.none
                      : tab.value === "no_user"
                        ? ratingCounts.no_user
                        : tab.value === "no_po"
                          ? ratingCounts.no_po
                          : ratingCounts.no_dev}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Clear all */}
        {hasActiveFilter && (
          <div className="pt-1 border-t border-gray-800">
            <button
              onClick={() => { setStatusFilter(""); setTypeFilter(""); setTeamFilter(""); setRatingFilter(""); }}
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ✕ Xoá tất cả bộ lọc
            </button>
          </div>
        )}
      </div>

      {initialLoading ? (
        <div className="text-center py-16 text-gray-500">Đang tải...</div>
      ) : visibleFeedbacks.length === 0 && !refreshing ? (
        <div className="text-center py-16 text-gray-500">
          {hasActiveFilter ? "Không có feedback nào khớp bộ lọc." : "Chưa có feedback nào."}
        </div>
      ) : (
        <div className={`bg-white border border-gray-100 rounded-xl shadow-sm overflow-x-auto transition-opacity ${refreshing ? "opacity-60 pointer-events-none" : ""}`}>
          <table className="w-full table-auto">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50 text-left">
                <th className="py-2 pl-3 pr-2 text-xs font-medium text-gray-500 w-full min-w-[10rem]">Tiêu đề</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">Team</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">Loại</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-500 whitespace-nowrap">Trạng thái</th>
                <th className="py-2 px-1 text-xs font-medium text-gray-500 whitespace-nowrap text-center" title="User rating">
                  <span className="flex items-center justify-center gap-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  </span>
                </th>
                <th className="py-2 px-1 text-xs font-medium text-gray-500 whitespace-nowrap text-center" title="PO rating">
                  <span className="flex items-center justify-center gap-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><rect x="18" y="3" width="4" height="18"/><rect x="10" y="8" width="4" height="13"/><rect x="2" y="13" width="4" height="8"/></svg>
                  </span>
                </th>
                <th className="py-2 px-1 text-xs font-medium text-gray-500 whitespace-nowrap text-center" title="Dev rating">
                  <span className="flex items-center justify-center gap-0.5">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                  </span>
                </th>
                <th className="py-2 px-2 text-xs font-medium text-gray-500 whitespace-nowrap text-center" title="Priority score">
                  <svg className="w-3.5 h-3.5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                </th>
                <th className="py-2 px-2 text-xs font-medium text-gray-500 whitespace-nowrap text-center">Deadline</th>
                <th className="py-2 pl-2 text-xs font-medium text-gray-500 whitespace-nowrap text-center">Sprint</th>
                <th className="py-2 px-2 text-xs font-medium text-gray-500 whitespace-nowrap text-center" title="Đã thông báo stakeholder">
                  <svg className="w-3.5 h-3.5 mx-auto" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
                </th>
                <th className="py-2 pr-3 pl-1 whitespace-nowrap"></th>
              </tr>
              <FeedbackTableColumnSizer longestSprintName={longestSprintName} />
            </thead>
            <tbody>
              {pagedFeedbacks.map(fb => (
                <MemoFeedbackRow key={fb.id} fb={fb} sprints={sprints} onRated={handleRated} onOpen={setOpenModalId} />
              ))}
            </tbody>
          </table>
          {hasMore && (
            <div className="border-t border-gray-100 py-3 text-center">
              <button
                onClick={() => setPage(p => p + 1)}
                className="text-xs text-gray-500 hover:text-gray-800 px-4 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition"
              >
                Load thêm ({visibleFeedbacks.length - pagedFeedbacks.length} còn lại)
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
