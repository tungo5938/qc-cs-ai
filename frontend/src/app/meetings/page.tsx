"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { api } from "@/lib/api";
import type { Meeting, ActionItem, Product, MeetingType } from "@/lib/types";
import { PRODUCT_FILTER_KEY } from "@/components/NavBar";
import {
  MEETING_STATUS_LABELS,
  MEETING_STATUS_COLORS,
  MEETING_TYPE_LABELS,
  ACTION_STATUS_LABELS,
  ACTION_STATUS_COLORS,
  ACTION_STATUS_OPTIONS,
  PRODUCT_COLORS,
} from "@/lib/constants";

const MEETING_TYPES: MeetingType[] = [
  "weekly_review",
  "sprint_planning",
  "incident",
  "stakeholder",
  "other",
];

const DAYS_OF_WEEK = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
const PIC_STORAGE_KEY = "meeting_pic_list";

// Note placeholder to guide thorough information capture
const NOTE_PLACEHOLDER = `Ghi chú nội dung họp...

Gợi ý để AI tạo action items tốt hơn:
• Ai làm gì? (VD: Tuấn sẽ viết tài liệu API)
• Deadline cụ thể (VD: trước thứ 6, ngày 20/4)
• Output mong đợi (VD: Google Doc, PR trên Github)`;

function getCalendarDays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days: (Date | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(new Date(year, month, d));
  return days;
}

function fmtDate(d: string | null | undefined) {
  if (!d) return "";
  return new Date(d).toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── PIC helpers (localStorage) ───────────────────────────────────────────────

function loadPicList(): string[] {
  try {
    const raw = localStorage.getItem(PIC_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function savePicList(list: string[]) {
  localStorage.setItem(PIC_STORAGE_KEY, JSON.stringify(list));
}

// ── PIC Combobox ─────────────────────────────────────────────────────────────

function PicCombobox({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const [picList, setPicList] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [newPic, setNewPic] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setPicList(loadPicList());
  }, []);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function select(pic: string) {
    onChange(pic);
    setOpen(false);
  }

  function addNew() {
    const trimmed = newPic.trim();
    if (!trimmed) return;
    const updated = picList.includes(trimmed) ? picList : [...picList, trimmed];
    savePicList(updated);
    setPicList(updated);
    onChange(trimmed);
    setNewPic("");
    setOpen(false);
  }

  const filtered = picList.filter((p) =>
    p.toLowerCase().includes(value.toLowerCase()) && p !== value
  );

  return (
    <div ref={ref} className={`relative ${className}`}>
      <div className="flex items-center border border-gray-200 rounded focus-within:ring-1 focus-within:ring-red-400 bg-white">
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder="Chọn hoặc nhập PIC..."
          className="flex-1 px-2 py-1 text-sm outline-none rounded bg-transparent"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="px-2 text-gray-400 hover:text-gray-600"
        >
          ▾
        </button>
      </div>

      {open && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
          {filtered.length > 0 && (
            <div className="max-h-32 overflow-y-auto">
              {filtered.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => select(p)}
                  className="w-full text-left px-3 py-1.5 text-sm hover:bg-gray-50"
                >
                  👤 {p}
                </button>
              ))}
            </div>
          )}
          <div className="flex gap-1 p-2 border-t border-gray-100 bg-gray-50">
            <input
              type="text"
              value={newPic}
              onChange={(e) => setNewPic(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addNew()}
              placeholder="Thêm PIC mới..."
              className="flex-1 text-xs border border-gray-200 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-red-400"
            />
            <button
              type="button"
              onClick={addNew}
              disabled={!newPic.trim()}
              className="text-xs bg-red-600 text-white px-2 py-1 rounded hover:bg-red-700 disabled:opacity-40"
            >
              + Thêm
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Note quality check ───────────────────────────────────────────────────────

function checkNoteQuality(notes: string): string | null {
  if (!notes.trim()) return "Chưa có ghi chú nào để phân tích.";
  const hasWho = /\b(tuấn|giang|alice|bob|carol|anh|chị|em|tôi|mình|team|[a-z]+@[a-z]+\.[a-z]+)\b/i.test(notes);
  const hasWhat = notes.length > 30;
  const hasDeadline = /(thứ|ngày|tháng|deadline|trước|sau|hôm|tuần|\d+\/\d+|\d{1,2}\/\d{1,2})/i.test(notes);

  const missing: string[] = [];
  if (!hasWho) missing.push("người phụ trách (PIC)");
  if (!hasWhat) missing.push("nội dung công việc cụ thể");
  if (!hasDeadline) missing.push("deadline");

  if (missing.length >= 2) {
    return `Ghi chú chưa đủ thông tin. Thiếu: **${missing.join(", ")}**. AI có thể sẽ không tạo được action items chính xác. Bạn có muốn tiếp tục không?`;
  }
  return null;
}

// ── Action Item Row ──────────────────────────────────────────────────────────

function ActionItemRow({
  item,
  products,
  onUpdated,
}: {
  item: ActionItem;
  products: Product[];
  onUpdated: (updated: ActionItem) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState({
    title: item.title,
    assignee: item.assignee ?? "",
    deadline: item.deadline ?? "",
    output_url: item.output_url ?? "",
    status: item.status,
  });
  const [saving, setSaving] = useState(false);

  // Sync when item prop changes (e.g. status updated externally)
  useEffect(() => {
    setDraft({
      title: item.title,
      assignee: item.assignee ?? "",
      deadline: item.deadline ?? "",
      output_url: item.output_url ?? "",
      status: item.status,
    });
  }, [item]);

  const productName = products.find((p) => p.id === item.product_id)?.name ?? item.product_name ?? "";
  const colorClass = PRODUCT_COLORS[productName] ?? "bg-gray-100 text-gray-600";

  async function save() {
    setSaving(true);
    try {
      const updated = await api.actionItems.update(item.id, {
        title: draft.title,
        assignee: draft.assignee || null,
        deadline: draft.deadline || null,
        output_url: draft.output_url || null,
        status: draft.status,
      });
      onUpdated(updated as ActionItem);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  async function cycleStatus() {
    const opts = ACTION_STATUS_OPTIONS as readonly string[];
    const idx = opts.indexOf(item.status);
    const next = opts[(idx + 1) % opts.length];
    const updated = await api.actionItems.update(item.id, { status: next });
    onUpdated(updated as ActionItem);
  }

  if (editing) {
    return (
      <div className="bg-blue-50 rounded-lg p-3 space-y-2 text-sm border border-blue-100">
        <input
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          placeholder="Tiêu đề"
        />
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">PIC</label>
            <PicCombobox
              value={draft.assignee}
              onChange={(v) => setDraft({ ...draft, assignee: v })}
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-0.5">Deadline</label>
            <input
              type="date"
              className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
              value={draft.deadline}
              onChange={(e) => setDraft({ ...draft, deadline: e.target.value })}
            />
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-0.5">Trạng thái</label>
          <select
            value={draft.status}
            onChange={(e) => setDraft({ ...draft, status: e.target.value as import("@/lib/types").ActionStatus })}
            className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          >
            {(ACTION_STATUS_OPTIONS as readonly string[]).map((s) => (
              <option key={s} value={s}>{ACTION_STATUS_LABELS[s] ?? s}</option>
            ))}
          </select>
        </div>
        <input
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white"
          value={draft.output_url}
          onChange={(e) => setDraft({ ...draft, output_url: e.target.value })}
          placeholder="Link output (Google Doc, Notion...)"
        />
        <div className="flex gap-2">
          <button
            onClick={save}
            disabled={saving}
            className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Lưu..." : "Lưu"}
          </button>
          <button
            onClick={() => setEditing(false)}
            className="border border-gray-200 text-gray-600 px-3 py-1 rounded text-xs hover:bg-white bg-white"
          >
            Hủy
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-2.5 border-b border-gray-100 last:border-0 group">
      <div className="flex-1 min-w-0">
        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-1">
          {productName && (
            <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${colorClass}`}>
              {productName}
            </span>
          )}
          {/* Status — click to cycle */}
          <button
            onClick={cycleStatus}
            className={`text-xs px-2 py-0.5 rounded-full font-medium transition-all cursor-pointer border-0 ${
              ACTION_STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"
            }`}
            title="Click để chuyển trạng thái"
          >
            {ACTION_STATUS_LABELS[item.status] ?? item.status}
          </button>
          {item.assignee && (
            <span className="text-xs text-gray-500 flex items-center gap-0.5">👤 {item.assignee}</span>
          )}
          {item.deadline && (
            <span className="text-xs text-gray-400 flex items-center gap-0.5">📅 {fmtDate(item.deadline)}</span>
          )}
        </div>
        {/* Title */}
        <p className="text-sm text-gray-800 leading-snug">{item.title}</p>
        {/* Output link */}
        {item.output_url && (
          <a
            href={item.output_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-500 hover:underline truncate block mt-0.5"
          >
            🔗 {item.output_url}
          </a>
        )}
      </div>
      <button
        onClick={() => setEditing(true)}
        className="text-gray-300 hover:text-gray-500 opacity-0 group-hover:opacity-100 transition-opacity text-sm flex-shrink-0 mt-0.5"
        title="Chỉnh sửa"
      >
        ✏️
      </button>
    </div>
  );
}

// ── Meeting Detail Panel ─────────────────────────────────────────────────────

function MeetingDetailPanel({
  meetingId,
  products,
  onClose,
}: {
  meetingId: string;
  products: Product[];
  onClose: () => void;
}) {
  const [meeting, setMeeting] = useState<Meeting | null>(null);
  const [loading, setLoading] = useState(true);
  const [extracting, setExtracting] = useState(false);
  const [extractWarning, setExtractWarning] = useState<string | null>(null);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [showAddAction, setShowAddAction] = useState(false);
  const [newAction, setNewAction] = useState({ title: "", assignee: "", deadline: "", output_url: "" });
  const [addingAction, setAddingAction] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const m = await api.meetings.get(meetingId) as any;
      setMeeting(m as Meeting);
      setActionItems((m.action_items ?? []) as ActionItem[]);
    } finally {
      setLoading(false);
    }
  }, [meetingId]);

  useEffect(() => { load(); }, [load]);

  async function addNote() {
    if (!newNote.trim()) return;
    setAddingNote(true);
    try {
      await api.meetings.addNote(meetingId, newNote.trim());
      setNewNote("");
      await load();
    } finally {
      setAddingNote(false);
    }
  }

  function handleExtractClick() {
    // Check note quality before calling AI
    const allNotes = (meeting?.notes ?? []).map((n) => n.content).join("\n");
    const warning = checkNoteQuality(allNotes);
    if (warning) {
      setExtractWarning(warning);
    } else {
      runExtract();
    }
  }

  async function runExtract() {
    setExtractWarning(null);
    setExtracting(true);
    try {
      const result = await api.meetings.extractActions(meetingId) as any;
      setActionItems((prev) => [...prev, ...(result.extracted ?? [])]);
    } finally {
      setExtracting(false);
    }
  }

  async function addActionManual() {
    if (!newAction.title.trim() || !meeting) return;
    setAddingAction(true);
    try {
      const created = await api.actionItems.create({
        product_id: meeting.product_id,
        title: newAction.title.trim(),
        assignee: newAction.assignee || null,
        deadline: newAction.deadline || null,
        output_url: newAction.output_url || null,
        source_meeting_id: meetingId,
      });
      setActionItems((prev) => [...prev, created as ActionItem]);
      setNewAction({ title: "", assignee: "", deadline: "", output_url: "" });
      setShowAddAction(false);
    } finally {
      setAddingAction(false);
    }
  }

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 bg-white rounded-xl border border-gray-100">
        Đang tải...
      </div>
    );
  }

  if (!meeting) return null;

  return (
    <div className="flex flex-col bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden h-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 p-4 border-b border-gray-100 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-1.5 mb-1">
            {meeting.product_name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                {meeting.product_name}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              {MEETING_TYPE_LABELS[meeting.meeting_type] ?? meeting.meeting_type}
            </span>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MEETING_STATUS_COLORS[meeting.status] ?? ""}`}>
              {MEETING_STATUS_LABELS[meeting.status] ?? meeting.status}
            </span>
          </div>
          <h2 className="text-base font-semibold text-gray-900 leading-tight">{meeting.name}</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {new Date(meeting.scheduled_at).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" })}
            {meeting.participants?.length ? ` · ${meeting.participants.join(", ")}` : ""}
          </p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none mt-0.5 flex-shrink-0">✕</button>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {/* Notes */}
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Ghi chú</h3>
          {meeting.notes && meeting.notes.length > 0 ? (
            <div className="space-y-2 mb-3">
              {meeting.notes.map((n) => (
                <div key={n.id} className="bg-gray-50 rounded-lg p-2.5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                  {n.content}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400 mb-3">Chưa có ghi chú.</p>
          )}
          <div className="flex gap-2 items-end">
            <textarea
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              placeholder={NOTE_PLACEHOLDER}
              rows={4}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none leading-relaxed"
            />
            <button
              onClick={addNote}
              disabled={addingNote || !newNote.trim()}
              className="bg-gray-800 text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-gray-900 disabled:opacity-40 flex-shrink-0"
            >
              {addingNote ? "..." : "Thêm"}
            </button>
          </div>
        </div>

        {/* Action Items */}
        <div className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
              Action Items ({actionItems.length})
            </h3>
            <div className="flex gap-2">
              <button
                onClick={handleExtractClick}
                disabled={extracting}
                className="text-xs bg-purple-600 text-white px-2.5 py-1 rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 flex items-center gap-1 whitespace-nowrap"
              >
                {extracting ? "⏳ Đang xử lý..." : "🤖 AI → Action Items"}
              </button>
              <button
                onClick={() => setShowAddAction((v) => !v)}
                className="text-xs border border-gray-200 text-gray-600 px-2.5 py-1 rounded-lg hover:bg-gray-50 whitespace-nowrap"
              >
                + Thêm thủ công
              </button>
            </div>
          </div>

          {/* Warning dialog when notes incomplete */}
          {extractWarning && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-3 text-sm">
              <p className="text-yellow-800 mb-2">⚠️ {extractWarning.replace(/\*\*/g, "")}</p>
              <div className="flex gap-2">
                <button
                  onClick={runExtract}
                  className="bg-yellow-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-yellow-700"
                >
                  Vẫn tiếp tục
                </button>
                <button
                  onClick={() => setExtractWarning(null)}
                  className="border border-yellow-300 text-yellow-700 px-3 py-1 rounded text-xs hover:bg-yellow-100"
                >
                  Bổ sung ghi chú trước
                </button>
              </div>
            </div>
          )}

          {/* Manual add form */}
          {showAddAction && (
            <div className="bg-gray-50 rounded-lg p-3 mb-3 space-y-2 text-sm border border-gray-200">
              <input
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                value={newAction.title}
                onChange={(e) => setNewAction({ ...newAction, title: e.target.value })}
                placeholder="Tiêu đề action item"
              />
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">PIC</label>
                  <PicCombobox
                    value={newAction.assignee}
                    onChange={(v) => setNewAction({ ...newAction, assignee: v })}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-0.5">Deadline</label>
                  <input
                    type="date"
                    className="w-full border border-gray-200 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                    value={newAction.deadline}
                    onChange={(e) => setNewAction({ ...newAction, deadline: e.target.value })}
                  />
                </div>
              </div>
              <input
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-red-400 bg-white"
                value={newAction.output_url}
                onChange={(e) => setNewAction({ ...newAction, output_url: e.target.value })}
                placeholder="Link output (Google Doc, Notion...)"
              />
              <div className="flex gap-2">
                <button
                  onClick={addActionManual}
                  disabled={addingAction || !newAction.title.trim()}
                  className="bg-red-600 text-white px-3 py-1 rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
                >
                  {addingAction ? "..." : "Thêm"}
                </button>
                <button
                  onClick={() => setShowAddAction(false)}
                  className="border border-gray-200 text-gray-600 px-3 py-1 rounded text-xs hover:bg-white bg-white"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          {actionItems.length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có action item nào.</p>
          ) : (
            <div>
              {actionItems.map((item) => (
                <ActionItemRow
                  key={item.id}
                  item={item}
                  products={products}
                  onUpdated={(updated) =>
                    setActionItems((prev) => prev.map((a) => (a.id === updated.id ? updated : a)))
                  }
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Create Meeting Modal ─────────────────────────────────────────────────────

function CreateMeetingModal({
  onClose,
  onCreated,
  products,
  defaultProductId,
}: {
  onClose: () => void;
  onCreated: (m: Meeting) => void;
  products: Product[];
  defaultProductId?: string;
}) {
  const [form, setForm] = useState({
    product_id: defaultProductId || products[0]?.id || "",
    name: "",
    meeting_type: "weekly_review" as MeetingType,
    scheduled_at: "",
    participants: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (form.product_id === "" && products.length > 0) {
      setForm((f) => ({ ...f, product_id: defaultProductId || products[0].id }));
    }
  }, [products, defaultProductId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const participants = form.participants.split(",").map((s) => s.trim()).filter(Boolean);
      const m = await api.meetings.create({ ...form, participants });
      onCreated(m as Meeting);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-gray-900 mb-4">Tạo meeting mới</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sản phẩm</label>
            <select
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên meeting</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Tên meeting..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loại</label>
            <select
              value={form.meeting_type}
              onChange={(e) => setForm({ ...form, meeting_type: e.target.value as MeetingType })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {MEETING_TYPES.map((t) => (
                <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Thời gian</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Người tham dự (phân cách bằng dấu phẩy)
            </label>
            <input
              type="text"
              value={form.participants}
              onChange={(e) => setForm({ ...form, participants: e.target.value })}
              placeholder="Alice, Bob, Carol"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Đang tạo..." : "Tạo meeting"}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
            >
              Hủy
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function MeetingsCalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const load = useCallback((pid: string) => {
    setLoading(true);
    api.meetings
      .list({ product_id: pid || undefined })
      .then((r) => setMeetings(r as Meeting[]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.products.list().then((r) => setProducts(r as Product[]));
    const pid = localStorage.getItem(PRODUCT_FILTER_KEY) || "";
    load(pid);

    function onStorage(e: StorageEvent) {
      if (e.key === PRODUCT_FILTER_KEY) load(e.newValue || "");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
  }

  const calDays = getCalendarDays(year, month);

  function meetingsOnDay(d: Date): Meeting[] {
    return meetings.filter((m) => {
      const md = new Date(m.scheduled_at);
      return md.getFullYear() === d.getFullYear() &&
        md.getMonth() === d.getMonth() &&
        md.getDate() === d.getDate();
    });
  }

  const isToday = (d: Date) =>
    d.getFullYear() === today.getFullYear() &&
    d.getMonth() === today.getMonth() &&
    d.getDate() === today.getDate();

  return (
    <div className="flex gap-4 h-[calc(100vh-120px)] min-w-0">
      {/* Calendar column */}
      <div className={`flex flex-col min-w-0 transition-all duration-200 ${selectedMeetingId ? "w-[58%]" : "w-full"}`}>
        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2">
          <h1 className="text-2xl font-bold text-gray-900 whitespace-nowrap">Meetings</h1>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">◀</button>
              <span className="text-sm font-medium text-gray-700 min-w-[100px] text-center">
                Tháng {month + 1}/{year}
              </span>
              <button onClick={nextMonth} className="p-1.5 rounded hover:bg-gray-100 text-gray-600">▶</button>
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium whitespace-nowrap"
            >
              + Tạo meeting
            </button>
          </div>
        </div>

        {/* Calendar grid */}
        <div className="flex-1 bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 flex-shrink-0">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="py-2 text-center text-xs font-semibold text-gray-500">
                {d}
              </div>
            ))}
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-24 text-gray-400">Đang tải...</div>
          ) : (
            <div className="grid grid-cols-7 flex-1 overflow-auto" style={{ gridAutoRows: "minmax(72px, 1fr)" }}>
              {calDays.map((d, i) => {
                if (!d) return <div key={`empty-${i}`} className="bg-gray-50/50 border-b border-r border-gray-100" />;
                const dayMeetings = meetingsOnDay(d);
                const isSelected = dayMeetings.some((m) => m.id === selectedMeetingId);
                return (
                  <div
                    key={d.toISOString()}
                    className={`border-b border-r border-gray-100 p-1 flex flex-col gap-0.5 ${
                      isToday(d) ? "bg-red-50" : ""
                    } ${isSelected ? "ring-2 ring-inset ring-red-400" : ""}`}
                  >
                    <span
                      className={`text-xs font-semibold self-end w-5 h-5 flex items-center justify-center rounded-full text-[11px] ${
                        isToday(d) ? "bg-red-600 text-white" : "text-gray-500"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {dayMeetings.slice(0, 2).map((m) => (
                      <button
                        key={m.id}
                        onClick={() => setSelectedMeetingId(m.id === selectedMeetingId ? null : m.id)}
                        className={`w-full text-left text-[11px] px-1 py-0.5 rounded font-medium truncate transition leading-tight ${
                          m.id === selectedMeetingId
                            ? "bg-red-600 text-white"
                            : "bg-purple-100 text-purple-800 hover:bg-purple-200"
                        }`}
                        title={m.name}
                      >
                        {new Date(m.scheduled_at).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })}{" "}
                        {m.name}
                      </button>
                    ))}
                    {dayMeetings.length > 2 && (
                      <span className="text-[10px] text-gray-400 px-1">+{dayMeetings.length - 2} nữa</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Panel */}
      {selectedMeetingId && (
        <div className="flex-1 overflow-hidden min-w-[340px]">
          <MeetingDetailPanel
            key={selectedMeetingId}
            meetingId={selectedMeetingId}
            products={products}
            onClose={() => setSelectedMeetingId(null)}
          />
        </div>
      )}

      {showCreateModal && (
        <CreateMeetingModal
          products={products}
          defaultProductId={localStorage.getItem(PRODUCT_FILTER_KEY) || products[0]?.id || ""}
          onClose={() => setShowCreateModal(false)}
          onCreated={(m) => {
            setMeetings((prev) => [m, ...prev]);
            setShowCreateModal(false);
            setSelectedMeetingId(m.id);
          }}
        />
      )}
    </div>
  );
}
