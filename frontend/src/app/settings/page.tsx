"use client";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import type { Product, PriorityConfig, MeetingTemplate, SprintCurrentResponse } from "@/lib/types";

// ── Access Control section (admin only) ───────────────────────────────────────

const BASE = "/proxy";
const PM_EMAILS = (process.env.NEXT_PUBLIC_PM_QC_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());

type AllowedEntry = { id: string; email: string; added_by: string; created_at: string };

function AccessControl({ adminEmail }: { adminEmail: string }) {
  const [entries, setEntries] = useState<AllowedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/auth/allowed-emails`, {
        headers: { "x-admin-email": adminEmail },
      });
      if (!res.ok) throw new Error(await res.text());
      setEntries(await res.json());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function addEmail() {
    if (!newEmail.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/auth/allowed-emails`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-email": adminEmail },
        body: JSON.stringify({ email: newEmail.trim() }),
      });
      if (!res.ok) throw new Error(await res.text());
      setNewEmail("");
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function removeEmail(id: string) {
    if (!confirm("Xóa email này khỏi danh sách?")) return;
    try {
      const res = await fetch(`${BASE}/api/auth/allowed-emails/${id}`, {
        method: "DELETE",
        headers: { "x-admin-email": adminEmail },
      });
      if (!res.ok) throw new Error(await res.text());
      setEntries((prev) => prev.filter((e) => e.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl bg-white mb-8">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Quản lý quyền truy cập</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Tài khoản <span className="font-mono">@ghn.vn</span> luôn được phép đăng nhập.
          Thêm email ngoài domain vào đây nếu cần.
        </p>
      </div>
      <div className="p-5">
        {error && (
          <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}
        {/* Add form */}
        <div className="flex gap-2 mb-4">
          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addEmail()}
            placeholder="email@example.com"
            className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button
            onClick={addEmail}
            disabled={saving || !newEmail.trim()}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
          >
            {saving ? "..." : "+ Thêm"}
          </button>
        </div>
        {/* List */}
        {loading ? (
          <p className="text-sm text-gray-400 py-4 text-center">Đang tải...</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center italic">Chưa có email nào được thêm thủ công.</p>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">{e.email}</p>
                  <p className="text-xs text-gray-400">
                    Thêm bởi {e.added_by} · {new Date(e.created_at).toLocaleDateString("vi-VN")}
                  </p>
                </div>
                <button
                  onClick={() => removeEmail(e.id)}
                  className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-100 hover:border-red-200 transition"
                >
                  Xóa
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KbTable component ──────────────────────────────────────────────────────────

type KbEntry = { title: string; content: string };

function parseKbEntries(kb_text: string): KbEntry[] {
  if (!kb_text) return [];
  try {
    const parsed = JSON.parse(kb_text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
  // Parse ### title\ncontent format
  const blocks = kb_text.split(/\n(?=### )/);
  return blocks.map(b => {
    const lines = b.trim().split('\n');
    const title = lines[0].replace(/^### /, '').trim();
    const content = lines.slice(1).join('\n').trim();
    return { title, content };
  }).filter(e => e.title || e.content);
}

function KbTable({ kb_text, onChange }: { kb_text: string; onChange: (val: string) => void }) {
  const [entries, setEntries] = useState<KbEntry[]>(() => parseKbEntries(kb_text));
  const [editIdx, setEditIdx] = useState<number | null>(null);
  const [editEntry, setEditEntry] = useState<KbEntry>({ title: '', content: '' });
  const [adding, setAdding] = useState(false);
  const [newEntry, setNewEntry] = useState<KbEntry>({ title: '', content: '' });

  useEffect(() => {
    setEntries(parseKbEntries(kb_text));
  }, [kb_text]);

  function save(updated: KbEntry[]) {
    setEntries(updated);
    onChange(JSON.stringify(updated, null, 0));
  }

  function deleteEntry(i: number) {
    save(entries.filter((_, idx) => idx !== i));
  }

  function startEdit(i: number) {
    setEditIdx(i);
    setEditEntry({ ...entries[i] });
  }

  function commitEdit() {
    if (editIdx === null) return;
    const updated = [...entries];
    updated[editIdx] = editEntry;
    save(updated);
    setEditIdx(null);
  }

  function addEntry() {
    if (!newEntry.content.trim()) return;
    save([...entries, { ...newEntry }]);
    setNewEntry({ title: '', content: '' });
    setAdding(false);
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-700">Knowledge Base ({entries.length} mục)</span>
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="text-xs text-red-600 hover:text-red-700 border border-red-200 px-2 py-1 rounded"
        >
          + Thêm mục
        </button>
      </div>

      {entries.length === 0 && !adding && (
        <p className="text-xs text-gray-400 italic py-4 text-center border border-dashed border-gray-200 rounded-lg">
          Chưa có mục KB. Upload file hoặc thêm thủ công.
        </p>
      )}

      <div className="space-y-1 max-h-64 overflow-y-auto">
        {entries.map((e, i) => (
          <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
            {editIdx === i ? (
              <div className="p-2 space-y-1">
                <input
                  type="text"
                  value={editEntry.title}
                  onChange={ev => setEditEntry(p => ({ ...p, title: ev.target.value }))}
                  placeholder="Tiêu đề"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1"
                />
                <textarea
                  value={editEntry.content}
                  onChange={ev => setEditEntry(p => ({ ...p, content: ev.target.value }))}
                  rows={3}
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditIdx(null)} className="text-xs text-gray-500">Hủy</button>
                  <button type="button" onClick={commitEdit} className="text-xs text-red-600 font-medium">Lưu</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2">
                <div className="flex-1 min-w-0">
                  {e.title && <p className="text-xs font-medium text-gray-700 truncate">{e.title}</p>}
                  <p className="text-xs text-gray-500 line-clamp-2">{e.content}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => startEdit(i)} className="text-xs text-gray-400 hover:text-gray-600">✏️</button>
                  <button type="button" onClick={() => deleteEntry(i)} className="text-xs text-gray-400 hover:text-red-500">🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {adding && (
        <div className="border border-red-100 rounded-lg p-2 space-y-1 mt-1">
          <input
            type="text"
            value={newEntry.title}
            onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
            placeholder="Tiêu đề"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1"
          />
          <textarea
            value={newEntry.content}
            onChange={e => setNewEntry(p => ({ ...p, content: e.target.value }))}
            rows={3}
            placeholder="Nội dung"
            className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-none"
          />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-500">Hủy</button>
            <button type="button" onClick={addEntry} className="text-xs text-red-600 font-medium">Thêm</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Priority Formula component ────────────────────────────────────────────────

function PriorityFormula() {
  const [config, setConfig] = useState<PriorityConfig>({
    user_rating_weight: 0.4,
    po_rating_weight: 0.4,
    dev_rating_weight: 0.2,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.priorityConfig.get()
      .then(setConfig)
      .catch((e: any) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const total = config.user_rating_weight + config.po_rating_weight + config.dev_rating_weight;
  const isValid = total > 0;

  function pct(w: number) {
    return total > 0 ? Math.round((w / total) * 100) : 0;
  }

  function handleChange(field: keyof PriorityConfig, value: string) {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
      setConfig(prev => ({ ...prev, [field]: num }));
      setSaved(false);
    }
  }

  async function save() {
    setSaving(true);
    setError(null);
    try {
      const updated = await api.priorityConfig.update(config);
      setConfig(updated);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function reset() {
    setConfig({ user_rating_weight: 0.4, po_rating_weight: 0.4, dev_rating_weight: 0.2 });
    setSaved(false);
  }

  const FIELDS: { key: keyof PriorityConfig; label: string; desc: string; color: string }[] = [
    {
      key: "user_rating_weight",
      label: "👤 User Rating",
      desc: "Mức độ ưu tiên do người dùng/CS đánh giá (pain, urgency)",
      color: "bg-blue-500",
    },
    {
      key: "po_rating_weight",
      label: "📊 PO Rating (1-10)",
      desc: "PO đánh giá dựa trên product goal và business value",
      color: "bg-purple-500",
    },
    {
      key: "dev_rating_weight",
      label: "⚙️ Dev Rating / Effort (1-10, 1=ít effort nhất)",
      desc: "Dev đánh giá effort thực thi (1 = ít effort = dễ làm hơn)",
      color: "bg-green-500",
    },
  ];

  return (
    <div className="border border-gray-200 rounded-xl bg-white mb-8">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-semibold text-gray-900">Công thức ưu tiên</h2>
        <p className="text-xs text-gray-500 mt-0.5">
          Priority Score = (User Rating × W₁) + (PO Rating × W₂) + (Dev Rating × W₃), thang điểm 1–10.
          Mặc định: User 40% · PO 40% · Dev 20%.
        </p>
      </div>
      <div className="p-5 space-y-4">
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>
        )}

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Đang tải...</p>
        ) : (
          <>
            {/* Visual bar */}
            <div className="flex rounded-full overflow-hidden h-3 gap-0.5">
              {FIELDS.map(f => (
                <div
                  key={f.key}
                  className={`${f.color} transition-all`}
                  style={{ width: `${pct(config[f.key])}%` }}
                />
              ))}
            </div>
            <div className="flex justify-between text-xs text-gray-400 -mt-1">
              {FIELDS.map(f => (
                <span key={f.key}>{pct(config[f.key])}%</span>
              ))}
            </div>

            {/* Weight inputs */}
            <div className="space-y-3">
              {FIELDS.map(f => (
                <div key={f.key} className="flex items-center gap-4">
                  <div className="flex-1">
                    <p className="text-sm font-medium text-gray-800">{f.label}</p>
                    <p className="text-xs text-gray-400">{f.desc}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="range"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config[f.key]}
                      onChange={e => handleChange(f.key, e.target.value)}
                      className="w-28 accent-red-600"
                    />
                    <input
                      type="number"
                      min={0}
                      max={1}
                      step={0.05}
                      value={config[f.key]}
                      onChange={e => handleChange(f.key, e.target.value)}
                      className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-red-500"
                    />
                  </div>
                </div>
              ))}
            </div>

            {!isValid && (
              <p className="text-xs text-red-500">Tổng trọng số phải lớn hơn 0</p>
            )}

            <div className="flex items-center justify-between pt-1">
              <button
                onClick={reset}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Reset về mặc định
              </button>
              <button
                onClick={save}
                disabled={saving || !isValid}
                className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
              >
                {saving ? "Đang lưu..." : saved ? "✓ Đã lưu" : "Lưu công thức"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Products ───────────────────────────────────────────────────────────────────

const DEFAULT_PRODUCTS = [
  { name: "CS AI", color: "#EF4444" },
  { name: "CS Chat", color: "#3B82F6" },
  { name: "Voice AI", color: "#8B5CF6" },
];

function ColorDot({ color }: { color: string | null }) {
  return (
    <span
      className="inline-block w-3 h-3 rounded-full flex-shrink-0"
      style={{ backgroundColor: color || "#9CA3AF" }}
    />
  );
}

interface ProductFormData {
  name: string;
  telegram_group_id: string;
  kb_gdoc_url: string;
  jira_project_key: string;
  color: string;
  product_goal: string;
  kb_text: string;
  google_sheet_url: string;
  root_cause_prompt: string;
  solution_hint_prompt: string;
}

const emptyForm = (): ProductFormData => ({
  name: "",
  telegram_group_id: "",
  kb_gdoc_url: "",
  jira_project_key: "",
  color: "#6B7280",
  product_goal: "",
  kb_text: "",
  google_sheet_url: "",
  root_cause_prompt: "",
  solution_hint_prompt: "",
});

function productToForm(p: Product): ProductFormData {
  return {
    name: p.name,
    telegram_group_id: p.telegram_group_id || "",
    kb_gdoc_url: p.kb_gdoc_url || "",
    jira_project_key: p.jira_project_key || "",
    color: p.color || "#6B7280",
    product_goal: p.product_goal || "",
    kb_text: p.kb_text || "",
    google_sheet_url: p.google_sheet_url || "",
    root_cause_prompt: p.root_cause_prompt || "",
    solution_hint_prompt: p.solution_hint_prompt || "",
  };
}

// ── Meeting Ceremony Config ────────────────────────────────────────────────────

const VI_DAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];

function getDayOfWeekLabel(dateStr: string): { label: string; isMonday: boolean } {
  if (!dateStr) return { label: "", isMonday: false };
  const d = new Date(dateStr + "T00:00:00"); // avoid timezone shift
  const dow = d.getDay(); // 0=Sun, 1=Mon
  return { label: VI_DAY_NAMES[dow], isMonday: dow === 1 };
}

function fmtDateVN(dateStr: string): string {
  if (!dateStr) return "";
  const [y, m, d] = dateStr.split("-");
  return `${d}/${m}/${y}`;
}

function SprintSeriesPanel({ productId }: { productId?: string }) {
  const [anchorDate, setAnchorDate] = useState("");
  const [sprintLengthWeeks, setSprintLengthWeeks] = useState(2);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [sprintInfo, setSprintInfo] = useState<SprintCurrentResponse | null>(null);
  const [loadingCurrent, setLoadingCurrent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMsg, setGenMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { label: dowLabel, isMonday } = getDayOfWeekLabel(anchorDate);

  async function loadCurrent() {
    setLoadingCurrent(true);
    setError(null);
    try {
      const data = await api.sprintConfigs.current(productId) as SprintCurrentResponse;
      setSprintInfo(data);
      setAnchorDate(data.anchor_date);
      setSprintLengthWeeks(data.sprint_length_weeks);
    } catch {
      setSprintInfo(null);
    } finally {
      setLoadingCurrent(false);
    }
  }

  useEffect(() => { loadCurrent(); }, [productId]);

  async function handleSave() {
    if (!anchorDate) { setError("Chọn ngày bắt đầu sprint 1"); return; }
    if (!isMonday) { setError("Ngày anchor phải là Thứ 2"); return; }
    setSaving(true);
    setError(null);
    setSaveMsg(null);
    try {
      await api.sprintConfigs.upsert({
        product_id: productId || null,
        anchor_date: anchorDate,
        sprint_length_weeks: sprintLengthWeeks,
      });
      setSaveMsg("Đã lưu cấu hình sprint!");
      await loadCurrent();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateNext() {
    if (!sprintInfo) return;
    setGenerating(true);
    setError(null);
    setGenMsg(null);
    try {
      const { next_sprint } = sprintInfo;
      const res = await api.meetingTemplates.generate({
        sprint_start_date: next_sprint.start_date,
        product_id: productId,
        sprint_number: next_sprint.number,
      });
      setGenMsg(`Đã tạo ${res.created} meetings cho Sprint ${next_sprint.number}!`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="px-5 py-4 border-b border-gray-100 bg-blue-50/40 space-y-4">
      <p className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Cấu hình Sprint Series</p>

      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="block text-xs text-gray-500 mb-1">Ngày bắt đầu Sprint 1</label>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => { setAnchorDate(e.target.value); setSaveMsg(null); }}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
            {anchorDate && (
              <span className={`text-xs font-medium px-2 py-1 rounded-full ${isMonday ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                {dowLabel} {isMonday ? "✓" : "✗"}
              </span>
            )}
          </div>
        </div>
        <div>
          <label className="block text-xs text-gray-500 mb-1">Độ dài sprint</label>
          <div className="flex gap-2">
            {[2, 3, 4].map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => setSprintLengthWeeks(w)}
                className={`text-xs px-3 py-1.5 rounded-lg border transition ${
                  sprintLengthWeeks === w
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-gray-200 text-gray-600 hover:border-gray-300 bg-white"
                }`}
              >
                {w} tuần
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !anchorDate || !isMonday}
          className="px-4 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {saving ? "Đang lưu..." : "Lưu cấu hình"}
        </button>
        {saveMsg && <span className="text-xs text-green-600">{saveMsg}</span>}
      </div>

      {!isMonday && anchorDate && (
        <p className="text-xs text-red-600">Vui lòng chọn Thứ 2 làm ngày bắt đầu sprint.</p>
      )}

      {loadingCurrent ? (
        <p className="text-xs text-gray-400">Đang tải thông tin sprint...</p>
      ) : sprintInfo ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-white rounded-lg border border-gray-200 px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">Sprint hiện tại</p>
            <p className="text-sm font-semibold text-gray-900">Sprint {sprintInfo.current_sprint.number}</p>
            <p className="text-xs text-gray-500">
              {fmtDateVN(sprintInfo.current_sprint.start_date)} – {fmtDateVN(sprintInfo.current_sprint.end_date)}
            </p>
          </div>
          <div className="bg-white rounded-lg border border-blue-200 px-4 py-3">
            <p className="text-xs text-blue-500 mb-1">Sprint tiếp theo</p>
            <p className="text-sm font-semibold text-blue-700">Sprint {sprintInfo.next_sprint.number}</p>
            <p className="text-xs text-gray-500">
              {fmtDateVN(sprintInfo.next_sprint.start_date)} – {fmtDateVN(sprintInfo.next_sprint.end_date)}
            </p>
            <button
              onClick={handleGenerateNext}
              disabled={generating}
              className="mt-2 px-3 py-1 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
            >
              {generating ? "Đang tạo..." : `Tạo lịch Sprint ${sprintInfo.next_sprint.number}`}
            </button>
            {genMsg && <p className="text-xs text-green-600 mt-1">{genMsg}</p>}
          </div>
        </div>
      ) : (
        <p className="text-xs text-gray-400 italic">Chưa có cấu hình. Nhập ngày anchor và lưu để bắt đầu.</p>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}

const DAY_LABELS: Record<number, string> = {
  1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 7: "Chủ nhật",
};
const WEEK_LABELS: Record<number, string> = {
  0: "Hàng tuần", 1: "Tuần 1", 2: "Tuần 2", 3: "Tuần 3", 4: "Tuần 4",
};

type TemplateForm = {
  product_id: string;
  name: string;
  ceremony_type: string;
  day_of_week: number;
  week_in_sprint: number;
  pic: string[];
  output_template: string;
};

function emptyTemplateForm(): TemplateForm {
  return { product_id: "", name: "", ceremony_type: "Meeting", day_of_week: 1, week_in_sprint: 0, pic: [], output_template: "" };
}

function TemplateModal({
  form,
  products,
  onChange,
  onSave,
  onClose,
  saving,
  title,
}: {
  form: TemplateForm;
  products: Product[];
  onChange: (f: TemplateForm) => void;
  onSave: () => void;
  onClose: () => void;
  saving: boolean;
  title: string;
}) {
  const [picInput, setPicInput] = useState("");

  function addPic() {
    const val = picInput.trim();
    if (val && !form.pic.includes(val)) {
      onChange({ ...form, pic: [...form.pic, val] });
    }
    setPicInput("");
  }

  function removePic(tag: string) {
    onChange({ ...form, pic: form.pic.filter((p) => p !== tag) });
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          {/* Product */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sản phẩm</label>
            <select
              value={form.product_id}
              onChange={(e) => onChange({ ...form, product_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              <option value="">— Chọn sản phẩm —</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tên meeting</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Sprint Planning"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {/* Type + Day + Week — row */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
              <select
                value={form.ceremony_type}
                onChange={(e) => onChange({ ...form, ceremony_type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                <option value="Meeting">Meeting</option>
                <option value="Action">Action</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Ngày</label>
              <select
                value={form.day_of_week}
                onChange={(e) => onChange({ ...form, day_of_week: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {Object.entries(DAY_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tuần sprint</label>
              <select
                value={form.week_in_sprint}
                onChange={(e) => onChange({ ...form, week_in_sprint: Number(e.target.value) })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              >
                {Object.entries(WEEK_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>
          </div>
          {/* PIC tags */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">PIC</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.pic.map((tag) => (
                <span key={tag} className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full border border-red-100">
                  {tag}
                  <button onClick={() => removePic(tag)} className="hover:text-red-900 leading-none">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={picInput}
                onChange={(e) => setPicInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addPic())}
                placeholder="Thêm PIC rồi Enter..."
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                onClick={addPic}
                className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition"
              >
                +
              </button>
            </div>
          </div>
          {/* Output */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Output</label>
            <textarea
              value={form.output_template}
              onChange={(e) => onChange({ ...form, output_template: e.target.value })}
              rows={4}
              placeholder="- [ ] ..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:border-gray-300 text-gray-600 transition">Hủy</button>
          <button
            onClick={onSave}
            disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition"
          >
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function MeetingCeremony({ products }: { products: Product[] }) {
  const [templates, setTemplates] = useState<MeetingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [seedMsg, setSeedMsg] = useState<string | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const data = await api.meetingTemplates.list();
      setTemplates(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleSeed() {
    if (!confirm("Xóa toàn bộ template hiện tại và import lại từ file mẫu CS AI & CS Chat?")) return;
    setSeeding(true);
    setError(null);
    try {
      const res = await api.meetingTemplates.seed();
      setSeedMsg(`Đã seed ${res.seeded} templates cho: ${res.products.join(", ")}`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSeeding(false);
    }
  }

  async function handleAdd() {
    setSaving(true);
    setError(null);
    try {
      await api.meetingTemplates.create({
        ...form,
        product_id: form.product_id || null,
        day_of_week: form.day_of_week || null,
      });
      setShowAdd(false);
      setForm(emptyTemplateForm());
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleEdit() {
    if (!editId) return;
    setSaving(true);
    setError(null);
    try {
      await api.meetingTemplates.update(editId, {
        ...form,
        product_id: form.product_id || null,
        day_of_week: form.day_of_week || null,
      });
      setEditId(null);
      setForm(emptyTemplateForm());
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa template này?")) return;
    try {
      await api.meetingTemplates.delete(id);
      setTemplates((prev) => prev.filter((t) => t.id !== id));
    } catch (e: any) {
      setError(e.message);
    }
  }

  function startEdit(t: MeetingTemplate) {
    setEditId(t.id);
    setForm({
      product_id: t.product_id || "",
      name: t.name,
      ceremony_type: t.ceremony_type,
      day_of_week: t.day_of_week || 1,
      week_in_sprint: t.week_in_sprint,
      pic: t.pic || [],
      output_template: t.output_template || "",
    });
  }

  const grouped = templates.reduce<Record<number, MeetingTemplate[]>>((acc, t) => {
    const key = t.week_in_sprint;
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  return (
    <div className="border border-gray-200 rounded-xl bg-white mt-8">
      <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
        <div>
          <h2 className="font-semibold text-gray-900">Lịch Ceremony</h2>
          <p className="text-xs text-gray-500 mt-0.5">Cài đặt meeting cố định theo sprint 3 tuần</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleSeed}
            disabled={seeding}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:border-gray-300 text-gray-600 transition disabled:opacity-50"
          >
            {seeding ? "Đang import..." : "Import mẫu CS AI & CS Chat"}
          </button>
          <button
            onClick={() => { setShowAdd(true); setEditId(null); setForm(emptyTemplateForm()); }}
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
          >
            + Thêm
          </button>
        </div>
      </div>
      {seedMsg && <div className="px-5 py-2 text-xs text-green-600 bg-green-50 border-b border-green-100">{seedMsg}</div>}

      <SprintSeriesPanel />

      {error && (
        <div className="mx-5 mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">{error}</div>
      )}

      <div className="p-5">
        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Đang tải...</p>
        ) : templates.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-4 italic">
            Chưa có template nào. Nhấn &quot;Import mẫu&quot; hoặc &quot;+ Thêm&quot; để bắt đầu.
          </p>
        ) : (
          <div className="space-y-5">
            {[0, 1, 2, 3, 4].filter((w) => grouped[w]?.length).map((week) => (
              <div key={week}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{WEEK_LABELS[week]}</p>
                <div className="space-y-2">
                  {grouped[week].map((t) => (
                    <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.ceremony_type === "Meeting" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                            {t.ceremony_type}
                          </span>
                          <span className="font-medium text-sm text-gray-900">{t.name}</span>
                          {t.day_of_week && (
                            <span className="text-xs text-gray-400">{DAY_LABELS[t.day_of_week]}</span>
                          )}
                          {t.product_name && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{t.product_name}</span>
                          )}
                        </div>
                        {(t.pic && t.pic.length > 0) && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {t.pic.map((p) => (
                              <span key={p} className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full border border-red-100">{p}</span>
                            ))}
                          </div>
                        )}
                        {t.output_template && (
                          <p className="text-xs text-gray-400 mt-1 font-mono truncate">{t.output_template.split("\n")[0]}</p>
                        )}
                      </div>
                      <div className="flex gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => startEdit(t)}
                          className="text-xs text-gray-500 hover:text-gray-800 px-2 py-1 border border-gray-200 rounded hover:border-gray-300 transition"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(t.id)}
                          className="text-xs text-red-400 hover:text-red-600 px-2 py-1 border border-red-100 rounded hover:border-red-200 transition"
                        >
                          Xóa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {(showAdd || editId) && (
        <TemplateModal
          form={form}
          products={products}
          onChange={setForm}
          onSave={editId ? handleEdit : handleAdd}
          onClose={() => { setShowAdd(false); setEditId(null); setForm(emptyTemplateForm()); }}
          saving={saving}
          title={editId ? "Chỉnh sửa template" : "Thêm template mới"}
        />
      )}
    </div>
  );
}

export default function SettingsPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email?.toLowerCase() || "";
  const isAdmin = PM_EMAILS.includes(userEmail);

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductFormData>(emptyForm());
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<ProductFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null); // product id being uploaded

  async function loadProducts() {
    try {
      const data = await api.products.list();
      setProducts(data);
      // Only seed if truly empty AND not already seeding (prevent duplicate on re-render)
      if (data.length === 0 && !sessionStorage.getItem("pm_seeded")) {
        sessionStorage.setItem("pm_seeded", "1");
        await seedDefaults();
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  async function seedDefaults() {
    const seeded: Product[] = [];
    for (const d of DEFAULT_PRODUCTS) {
      try {
        const p = await api.products.create(d);
        seeded.push(p);
      } catch {}
    }
    setProducts(seeded);
  }

  useEffect(() => {
    loadProducts();
  }, []);

  function startEdit(product: Product) {
    setEditingId(product.id);
    setEditForm(productToForm(product));
    setAddingNew(false);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm(emptyForm());
  }

  async function saveEdit(id: string) {
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: editForm.name || undefined,
        telegram_group_id: editForm.telegram_group_id || null,
        kb_gdoc_url: editForm.kb_gdoc_url || null,
        jira_project_key: editForm.jira_project_key || null,
        color: editForm.color || null,
        product_goal: editForm.product_goal || null,
        kb_text: editForm.kb_text || null,
        google_sheet_url: editForm.google_sheet_url || null,
        root_cause_prompt: editForm.root_cause_prompt || null,
        solution_hint_prompt: editForm.solution_hint_prompt || null,
      };
      const updated = await api.products.update(id, payload);
      setProducts(prev => prev.map(p => (p.id === id ? updated : p)));
      setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteProduct(id: string) {
    if (!confirm("Xóa sản phẩm này?")) return;
    try {
      await api.products.delete(id);
      setProducts(prev => prev.filter(p => p.id !== id));
      if (editingId === id) setEditingId(null);
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function createProduct() {
    if (!newForm.name.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: newForm.name,
        telegram_group_id: newForm.telegram_group_id || null,
        kb_gdoc_url: newForm.kb_gdoc_url || null,
        jira_project_key: newForm.jira_project_key || null,
        color: newForm.color || null,
        product_goal: newForm.product_goal || null,
        kb_text: newForm.kb_text || null,
        google_sheet_url: newForm.google_sheet_url || null,
        root_cause_prompt: newForm.root_cause_prompt || null,
        solution_hint_prompt: newForm.solution_hint_prompt || null,
      };
      const created = await api.products.create(payload);
      setProducts(prev => [...prev, created]);
      setAddingNew(false);
      setNewForm(emptyForm());
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleKbUpload(productId: string, file: File) {
    setUploading(productId);
    setError(null);
    try {
      const updated = await api.products.kbUpload(productId, file);
      setEditForm(prev => ({ ...prev, kb_text: updated.kb_text || "" }));
    } catch (e: any) {
      setError(e.message);
    } finally {
      setUploading(null);
    }
  }

  async function handleSyncSheet(productId: string) {
    setSyncing(productId);
    setError(null);
    try {
      const result = await api.feedbacks.syncSheet(productId);
      alert(`Sync xong: ${result.imported} mới, ${result.skipped} đã có`);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSyncing(null);
    }
  }

  return (
    <div className="max-w-3xl mx-auto">
        {isAdmin && <AccessControl adminEmail={userEmail} />}

        <PriorityFormula />

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Cài đặt sản phẩm</h1>
            <p className="text-sm text-gray-500 mt-1">Quản lý thông tin từng sản phẩm CS</p>
          </div>
          <button
            onClick={() => { setAddingNew(true); setEditingId(null); setNewForm(emptyForm()); }}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition"
          >
            + Thêm sản phẩm
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error}
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-gray-400">Đang tải...</div>
        ) : (
          <div className="space-y-3">
            {/* Add new product inline form */}
            {addingNew && (
              <div className="border-2 border-dashed border-red-300 rounded-xl p-5 bg-red-50">
                <h3 className="font-semibold text-gray-900 mb-4">Sản phẩm mới</h3>
                <ProductForm
                  form={newForm}
                  onChange={setNewForm}
                  onSave={createProduct}
                  onCancel={() => { setAddingNew(false); setNewForm(emptyForm()); }}
                  saving={saving}
                  saveLabel="Tạo sản phẩm"
                />
              </div>
            )}

            {products.map(product => (
              <div key={product.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                {editingId === product.id ? (
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-4">
                      <ColorDot color={editForm.color} />
                      <h3 className="font-semibold text-gray-900">{product.name}</h3>
                    </div>
                    <ProductForm
                      form={editForm}
                      onChange={setEditForm}
                      onSave={() => saveEdit(product.id)}
                      onCancel={cancelEdit}
                      saving={saving}
                      saveLabel="Lưu thay đổi"
                      onKbUpload={(file) => handleKbUpload(product.id, file)}
                      uploading={uploading === product.id}
                    />
                  </div>
                ) : (
                  <div className="p-5 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <ColorDot color={product.color} />
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900">{product.name}</p>
                        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                          {product.telegram_group_id && (
                            <span className="text-xs text-gray-500">
                              Telegram: <span className="font-mono">{product.telegram_group_id}</span>
                            </span>
                          )}
                          {product.jira_project_key && (
                            <span className="text-xs text-gray-500">
                              Jira: <span className="font-mono">{product.jira_project_key}</span>
                            </span>
                          )}
                          {product.kb_gdoc_url && (
                            <span className="text-xs text-gray-500 truncate max-w-xs">
                              KB:{" "}
                              <a
                                href={product.kb_gdoc_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline"
                              >
                                Google Doc
                              </a>
                            </span>
                          )}
                          {!product.telegram_group_id && !product.jira_project_key && !product.kb_gdoc_url && (
                            <span className="text-xs text-gray-400 italic">Chưa cấu hình</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {product.google_sheet_url && (
                        <button
                          onClick={() => handleSyncSheet(product.id)}
                          disabled={syncing === product.id}
                          className="text-sm text-blue-600 hover:text-blue-800 px-3 py-1.5 rounded-lg border border-blue-100 hover:border-blue-200 transition disabled:opacity-50"
                        >
                          {syncing === product.id ? "Syncing..." : "Sync Sheet"}
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(product)}
                        className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded-lg border border-gray-200 hover:border-gray-300 transition"
                      >
                        Chỉnh sửa
                      </button>
                      <button
                        onClick={() => deleteProduct(product.id)}
                        className="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-100 hover:border-red-200 transition"
                      >
                        Xóa
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}

            {products.length === 0 && !addingNew && (
              <div className="text-center py-12 text-gray-400">
                Chưa có sản phẩm nào. Nhấn &quot;+ Thêm sản phẩm&quot; để bắt đầu.
              </div>
            )}
          </div>
        )}

        <MeetingCeremony products={products} />
    </div>
  );
}

interface ProductFormProps {
  form: ProductFormData;
  onChange: (f: ProductFormData) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  saveLabel: string;
  onKbUpload?: (file: File) => void;
  uploading?: boolean;
}

function ProductForm({ form, onChange, onSave, onCancel, saving, saveLabel, onKbUpload, uploading }: ProductFormProps) {
  function set(field: keyof ProductFormData, value: string) {
    onChange({ ...form, [field]: value });
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
          <input
            type="text"
            value={form.name}
            onChange={e => set("name", e.target.value)}
            placeholder="CS AI"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Màu sắc</label>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={form.color}
              onChange={e => set("color", e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border border-gray-200"
            />
            <input
              type="text"
              value={form.color}
              onChange={e => set("color", e.target.value)}
              placeholder="#EF4444"
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Telegram Group ID</label>
        <input
          type="text"
          value={form.telegram_group_id}
          onChange={e => set("telegram_group_id", e.target.value)}
          placeholder="-1001234567890"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mục tiêu sản phẩm</label>
        <textarea
          value={form.product_goal}
          onChange={e => set("product_goal", e.target.value)}
          placeholder="VD: Giảm thời gian xử lý ticket CS xuống dưới 2 phút..."
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Prompt phân tích nguyên nhân gốc rễ
          <span className="ml-1 text-gray-400 font-normal">(để trống = dùng mặc định)</span>
        </label>
        <textarea
          value={form.root_cause_prompt}
          onChange={e => set("root_cause_prompt", e.target.value)}
          placeholder="Bạn là AI phân tích feedback sản phẩm..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-y font-mono"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Prompt hướng giải quyết
          <span className="ml-1 text-gray-400 font-normal">(để trống = dùng mặc định)</span>
        </label>
        <textarea
          value={form.solution_hint_prompt}
          onChange={e => set("solution_hint_prompt", e.target.value)}
          placeholder="Câu đầu: tổng quan. Tiếp theo: - CDN: ... - GHN: ... - CS: ... - Tunm1: ..."
          rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-y font-mono"
        />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">Knowledge Base</label>
          <label className={`text-xs cursor-pointer px-2 py-1 rounded border transition ${(uploading || !onKbUpload) ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
            {uploading ? "Đang upload..." : "📎 Upload .docx/.xlsx/.txt"}
            <input
              type="file"
              accept=".docx,.xlsx,.txt"
              className="hidden"
              disabled={uploading || !onKbUpload}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file && onKbUpload) onKbUpload(file);
                e.target.value = "";
              }}
            />
          </label>
        </div>
        <KbTable
          kb_text={form.kb_text}
          onChange={val => set("kb_text", val)}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Jira Project Key</label>
        <input
          type="text"
          value={form.jira_project_key}
          onChange={e => set("jira_project_key", e.target.value)}
          placeholder="CSAI"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">KB Google Doc URL</label>
        <input
          type="url"
          value={form.kb_gdoc_url}
          onChange={e => set("kb_gdoc_url", e.target.value)}
          placeholder="https://docs.google.com/..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Google Sheet URL (nguồn feedback)</label>
        <input
          type="url"
          value={form.google_sheet_url}
          onChange={e => set("google_sheet_url", e.target.value)}
          placeholder="https://docs.google.com/spreadsheets/..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button
          onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg hover:border-gray-300 transition"
        >
          Hủy
        </button>
        <button
          onClick={onSave}
          disabled={saving || !form.name.trim()}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
        >
          {saving ? "Đang lưu..." : saveLabel}
        </button>
      </div>
    </div>
  );
}
