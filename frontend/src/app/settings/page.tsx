"use client";
import { useEffect, useState, useMemo } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import type { Product, PriorityConfig, MeetingTemplate, Sprint } from "@/lib/types";

const BASE = "/proxy";
const PM_EMAILS = (process.env.NEXT_PUBLIC_PM_QC_EMAILS || "").split(",").map((e) => e.trim().toLowerCase());

// ── Shared helpers ─────────────────────────────────────────────────────────────

type AllowedEntry = { id: string; email: string; added_by: string; created_at: string };

// ── AccessControl ──────────────────────────────────────────────────────────────

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
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        Tài khoản <span className="font-mono bg-gray-100 px-1 rounded">@ghn.vn</span> luôn được phép đăng nhập.
        Thêm email ngoài domain vào đây nếu cần.
      </p>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}
      <div className="flex gap-2">
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
      {loading ? (
        <p className="text-sm text-gray-400 py-4 text-center">Đang tải...</p>
      ) : entries.length === 0 ? (
        <p className="text-sm text-gray-400 py-4 text-center italic">Chưa có email nào được thêm thủ công.</p>
      ) : (
        <div className="space-y-2">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div>
                <p className="text-sm font-medium text-gray-900">{e.email}</p>
                <p className="text-xs text-gray-400">
                  Thêm bởi {e.added_by} · {new Date(e.created_at).toLocaleDateString("vi-VN")}
                </p>
              </div>
              <button
                onClick={() => removeEmail(e.id)}
                className="text-xs text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg border border-red-100 hover:border-red-200 transition"
              >
                Xóa
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── KbTable ────────────────────────────────────────────────────────────────────

type KbEntry = { title: string; content: string };

function parseKbEntries(kb_text: string): KbEntry[] {
  if (!kb_text) return [];
  try {
    const parsed = JSON.parse(kb_text);
    if (Array.isArray(parsed)) return parsed;
  } catch {}
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

  useEffect(() => { setEntries(parseKbEntries(kb_text)); }, [kb_text]);

  function save(updated: KbEntry[]) {
    setEntries(updated);
    onChange(JSON.stringify(updated, null, 0));
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-700">KB ({entries.length} mục)</span>
        <button type="button" onClick={() => setAdding(true)}
          className="text-xs text-red-600 hover:text-red-700 border border-red-200 px-2 py-1 rounded">
          + Thêm
        </button>
      </div>
      {entries.length === 0 && !adding && (
        <p className="text-xs text-gray-400 italic py-3 text-center border border-dashed border-gray-200 rounded-lg">
          Chưa có mục KB.
        </p>
      )}
      <div className="space-y-1 max-h-48 overflow-y-auto">
        {entries.map((e, i) => (
          <div key={i} className="border border-gray-100 rounded-lg overflow-hidden">
            {editIdx === i ? (
              <div className="p-2 space-y-1">
                <input type="text" value={editEntry.title}
                  onChange={ev => setEditEntry(p => ({ ...p, title: ev.target.value }))}
                  placeholder="Tiêu đề" className="w-full text-xs border border-gray-200 rounded px-2 py-1" />
                <textarea value={editEntry.content}
                  onChange={ev => setEditEntry(p => ({ ...p, content: ev.target.value }))}
                  rows={3} className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-none" />
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setEditIdx(null)} className="text-xs text-gray-500">Hủy</button>
                  <button type="button" onClick={() => { const u = [...entries]; u[editIdx] = editEntry; save(u); setEditIdx(null); }}
                    className="text-xs text-red-600 font-medium">Lưu</button>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-2 p-2">
                <div className="flex-1 min-w-0">
                  {e.title && <p className="text-xs font-medium text-gray-700 truncate">{e.title}</p>}
                  <p className="text-xs text-gray-500 line-clamp-2">{e.content}</p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button type="button" onClick={() => { setEditIdx(i); setEditEntry({ ...e }); }}
                    className="text-xs text-gray-400 hover:text-gray-600 px-1">✏️</button>
                  <button type="button" onClick={() => save(entries.filter((_, idx) => idx !== i))}
                    className="text-xs text-gray-400 hover:text-red-500 px-1">🗑</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {adding && (
        <div className="border border-red-100 rounded-lg p-2 space-y-1 mt-1">
          <input type="text" value={newEntry.title}
            onChange={e => setNewEntry(p => ({ ...p, title: e.target.value }))}
            placeholder="Tiêu đề" className="w-full text-xs border border-gray-200 rounded px-2 py-1" />
          <textarea value={newEntry.content}
            onChange={e => setNewEntry(p => ({ ...p, content: e.target.value }))}
            rows={3} placeholder="Nội dung" className="w-full text-xs border border-gray-200 rounded px-2 py-1 resize-none" />
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={() => setAdding(false)} className="text-xs text-gray-500">Hủy</button>
            <button type="button" onClick={() => { if (newEntry.content.trim()) { save([...entries, { ...newEntry }]); setNewEntry({ title: '', content: '' }); setAdding(false); } }}
              className="text-xs text-red-600 font-medium">Thêm</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── PriorityFormula ────────────────────────────────────────────────────────────

function PriorityFormula() {
  const [config, setConfig] = useState<PriorityConfig>({ user_rating_weight: 0.4, po_rating_weight: 0.4, dev_rating_weight: 0.2 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.priorityConfig.get().then(setConfig).catch((e: any) => setError(e.message)).finally(() => setLoading(false));
  }, []);

  const total = config.user_rating_weight + config.po_rating_weight + config.dev_rating_weight;
  const pct = (w: number) => total > 0 ? Math.round((w / total) * 100) : 0;

  const FIELDS: { key: keyof PriorityConfig; label: string; color: string }[] = [
    { key: "user_rating_weight", label: "User Rating", color: "bg-blue-500" },
    { key: "po_rating_weight", label: "PO Rating", color: "bg-purple-500" },
    { key: "dev_rating_weight", label: "Dev / Effort", color: "bg-green-500" },
  ];

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

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>;

  return (
    <div className="space-y-5">
      <p className="text-sm text-gray-500">
        Priority Score = (User × W₁) + (PO × W₂) + (Dev × W₃). Mặc định: 40% · 40% · 20%.
      </p>
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="flex rounded-full overflow-hidden h-3">
        {FIELDS.map(f => (
          <div key={f.key} className={`${f.color} transition-all`} style={{ width: `${pct(config[f.key])}%` }} />
        ))}
      </div>

      <div className="space-y-4">
        {FIELDS.map(f => (
          <div key={f.key} className="flex items-center gap-4">
            <div className="w-32 shrink-0">
              <p className="text-sm font-medium text-gray-800">{f.label}</p>
              <p className="text-xs text-gray-400">{pct(config[f.key])}%</p>
            </div>
            <input type="range" min={0} max={1} step={0.05} value={config[f.key]}
              onChange={e => { setConfig(p => ({ ...p, [f.key]: parseFloat(e.target.value) })); setSaved(false); }}
              className="flex-1 accent-red-600" />
            <input type="number" min={0} max={1} step={0.05} value={config[f.key]}
              onChange={e => { const n = parseFloat(e.target.value); if (!isNaN(n) && n >= 0) { setConfig(p => ({ ...p, [f.key]: n })); setSaved(false); } }}
              className="w-16 border border-gray-200 rounded px-2 py-1 text-sm text-center" />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between pt-1">
        <button onClick={() => { setConfig({ user_rating_weight: 0.4, po_rating_weight: 0.4, dev_rating_weight: 0.2 }); setSaved(false); }}
          className="text-xs text-gray-500 hover:text-gray-700 underline">Reset mặc định</button>
        <button onClick={save} disabled={saving || total <= 0}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
          {saving ? "Đang lưu..." : saved ? "✓ Đã lưu" : "Lưu công thức"}
        </button>
      </div>
    </div>
  );
}

// ── Products ───────────────────────────────────────────────────────────────────

interface ProductFormData {
  name: string; telegram_group_id: string; kb_gdoc_url: string;
  jira_project_key: string; color: string; product_goal: string;
  kb_text: string; google_sheet_url: string; root_cause_prompt: string; solution_hint_prompt: string;
}

const emptyForm = (): ProductFormData => ({
  name: "", telegram_group_id: "", kb_gdoc_url: "", jira_project_key: "",
  color: "#6B7280", product_goal: "", kb_text: "", google_sheet_url: "",
  root_cause_prompt: "", solution_hint_prompt: "",
});

function productToForm(p: Product): ProductFormData {
  return {
    name: p.name, telegram_group_id: p.telegram_group_id || "", kb_gdoc_url: p.kb_gdoc_url || "",
    jira_project_key: p.jira_project_key || "", color: p.color || "#6B7280",
    product_goal: p.product_goal || "", kb_text: p.kb_text || "",
    google_sheet_url: p.google_sheet_url || "", root_cause_prompt: p.root_cause_prompt || "",
    solution_hint_prompt: p.solution_hint_prompt || "",
  };
}

function ColorDot({ color }: { color: string | null }) {
  return <span className="inline-block w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color || "#9CA3AF" }} />;
}

interface ProductFormProps {
  form: ProductFormData; onChange: (f: ProductFormData) => void;
  onSave: () => void; onCancel: () => void; saving: boolean; saveLabel: string;
  onKbUpload?: (file: File) => void; uploading?: boolean;
}

function ProductForm({ form, onChange, onSave, onCancel, saving, saveLabel, onKbUpload, uploading }: ProductFormProps) {
  function set(field: keyof ProductFormData, value: string) { onChange({ ...form, [field]: value }); }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Tên sản phẩm *</label>
          <input type="text" value={form.name} onChange={e => set("name", e.target.value)} placeholder="CS AI"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Màu sắc</label>
          <div className="flex items-center gap-2">
            <input type="color" value={form.color} onChange={e => set("color", e.target.value)}
              className="w-9 h-9 rounded cursor-pointer border border-gray-200" />
            <input type="text" value={form.color} onChange={e => set("color", e.target.value)}
              placeholder="#EF4444" className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Mục tiêu sản phẩm</label>
        <textarea value={form.product_goal} onChange={e => set("product_goal", e.target.value)}
          placeholder="VD: Giảm thời gian xử lý ticket xuống dưới 2 phút..." rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Telegram Group ID</label>
          <input type="text" value={form.telegram_group_id} onChange={e => set("telegram_group_id", e.target.value)}
            placeholder="-1001234567890" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Jira Project Key</label>
          <input type="text" value={form.jira_project_key} onChange={e => set("jira_project_key", e.target.value)}
            placeholder="CSAI" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">KB Google Doc URL</label>
          <input type="url" value={form.kb_gdoc_url} onChange={e => set("kb_gdoc_url", e.target.value)}
            placeholder="https://docs.google.com/..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Google Sheet (nguồn feedback)</label>
          <input type="url" value={form.google_sheet_url} onChange={e => set("google_sheet_url", e.target.value)}
            placeholder="https://docs.google.com/spreadsheets/..." className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Prompt phân tích root cause <span className="text-gray-400 font-normal">(để trống = mặc định)</span>
        </label>
        <textarea value={form.root_cause_prompt} onChange={e => set("root_cause_prompt", e.target.value)}
          placeholder="Bạn là AI phân tích feedback sản phẩm..." rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-y" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">
          Prompt hướng giải quyết <span className="text-gray-400 font-normal">(để trống = mặc định)</span>
        </label>
        <textarea value={form.solution_hint_prompt} onChange={e => set("solution_hint_prompt", e.target.value)}
          placeholder="Câu đầu: tổng quan. Tiếp theo: - CDN: ..." rows={3}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-y" />
      </div>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">Knowledge Base</label>
          <label className={`text-xs cursor-pointer px-2 py-1 rounded border transition ${(uploading || !onKbUpload) ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400' : 'border-gray-300 text-gray-600 hover:border-gray-400'}`}>
            {uploading ? "Đang upload..." : "📎 Upload .docx/.xlsx/.txt"}
            <input type="file" accept=".docx,.xlsx,.txt" className="hidden"
              disabled={uploading || !onKbUpload}
              onChange={e => { const file = e.target.files?.[0]; if (file && onKbUpload) onKbUpload(file); e.target.value = ""; }} />
          </label>
        </div>
        <KbTable kb_text={form.kb_text} onChange={val => set("kb_text", val)} />
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onCancel}
          className="px-4 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:border-gray-300 transition">Hủy</button>
        <button onClick={onSave} disabled={saving || !form.name.trim()}
          className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
          {saving ? "Đang lưu..." : saveLabel}
        </button>
      </div>
    </div>
  );
}

function ProductsSection() {
  const DEFAULT_PRODUCTS = [
    { name: "CS AI", color: "#EF4444" },
    { name: "CS Chat", color: "#3B82F6" },
    { name: "Voice AI", color: "#8B5CF6" },
  ];

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ProductFormData>(emptyForm());
  const [addingNew, setAddingNew] = useState(false);
  const [newForm, setNewForm] = useState<ProductFormData>(emptyForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);

  async function loadProducts() {
    try {
      const data = await api.products.list();
      setProducts(data);
      if (data.length === 0 && !sessionStorage.getItem("pm_seeded")) {
        sessionStorage.setItem("pm_seeded", "1");
        const seeded: Product[] = [];
        for (const d of DEFAULT_PRODUCTS) {
          try { seeded.push(await api.products.create(d)); } catch {}
        }
        setProducts(seeded);
      }
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadProducts(); }, []);

  async function saveEdit(id: string) {
    setSaving(true); setError(null);
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

  async function createProduct() {
    if (!newForm.name.trim()) return;
    setSaving(true); setError(null);
    try {
      const created = await api.products.create({
        name: newForm.name, telegram_group_id: newForm.telegram_group_id || null,
        kb_gdoc_url: newForm.kb_gdoc_url || null, jira_project_key: newForm.jira_project_key || null,
        color: newForm.color || null, product_goal: newForm.product_goal || null,
        kb_text: newForm.kb_text || null, google_sheet_url: newForm.google_sheet_url || null,
        root_cause_prompt: newForm.root_cause_prompt || null, solution_hint_prompt: newForm.solution_hint_prompt || null,
      });
      setProducts(prev => [...prev, created]);
      setAddingNew(false); setNewForm(emptyForm());
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
    } catch (e: any) { setError(e.message); }
  }

  async function handleKbUpload(productId: string, file: File) {
    setUploading(productId); setError(null);
    try {
      const updated = await api.products.kbUpload(productId, file);
      setEditForm(prev => ({ ...prev, kb_text: updated.kb_text || "" }));
    } catch (e: any) { setError(e.message); } finally { setUploading(null); }
  }

  async function handleSyncSheet(productId: string) {
    setSyncing(productId); setError(null);
    try {
      const result = await api.feedbacks.syncSheet(productId);
      alert(`Sync xong: ${result.imported} mới, ${result.skipped} đã có`);
    } catch (e: any) { setError(e.message); } finally { setSyncing(null); }
  }

  if (loading) return <p className="text-sm text-gray-400 py-8 text-center">Đang tải...</p>;

  return (
    <div className="space-y-4">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      <div className="flex justify-end">
        <button onClick={() => { setAddingNew(true); setEditingId(null); setNewForm(emptyForm()); }}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition">
          + Thêm sản phẩm
        </button>
      </div>

      {addingNew && (
        <div className="border-2 border-dashed border-red-300 rounded-xl p-5 bg-red-50">
          <h3 className="font-semibold text-gray-900 mb-4">Sản phẩm mới</h3>
          <ProductForm form={newForm} onChange={setNewForm} onSave={createProduct}
            onCancel={() => { setAddingNew(false); setNewForm(emptyForm()); }}
            saving={saving} saveLabel="Tạo sản phẩm" />
        </div>
      )}

      <div className="space-y-3">
        {products.map(product => (
          <div key={product.id} className="border border-gray-200 rounded-xl overflow-hidden bg-white">
            {editingId === product.id ? (
              <div className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <ColorDot color={editForm.color} />
                  <h3 className="font-semibold text-gray-900">{product.name}</h3>
                </div>
                <ProductForm form={editForm} onChange={setEditForm}
                  onSave={() => saveEdit(product.id)} onCancel={() => setEditingId(null)}
                  saving={saving} saveLabel="Lưu thay đổi"
                  onKbUpload={(file) => handleKbUpload(product.id, file)}
                  uploading={uploading === product.id} />
              </div>
            ) : (
              <div className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <ColorDot color={product.color} />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900">{product.name}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                      {product.telegram_group_id && <span className="text-xs text-gray-400">Telegram: <span className="font-mono">{product.telegram_group_id}</span></span>}
                      {product.jira_project_key && <span className="text-xs text-gray-400">Jira: <span className="font-mono">{product.jira_project_key}</span></span>}
                      {product.kb_gdoc_url && <a href={product.kb_gdoc_url} target="_blank" rel="noopener noreferrer" className="text-xs text-blue-600 hover:underline">KB Doc</a>}
                      {!product.telegram_group_id && !product.jira_project_key && !product.kb_gdoc_url && <span className="text-xs text-gray-400 italic">Chưa cấu hình</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {product.google_sheet_url && (
                    <button onClick={() => handleSyncSheet(product.id)} disabled={syncing === product.id}
                      className="text-xs text-blue-600 border border-blue-100 px-3 py-1.5 rounded-lg hover:border-blue-200 transition disabled:opacity-50">
                      {syncing === product.id ? "Syncing..." : "Sync Sheet"}
                    </button>
                  )}
                  <button onClick={() => { setEditingId(product.id); setEditForm(productToForm(product)); setAddingNew(false); }}
                    className="text-xs text-gray-600 border border-gray-200 px-3 py-1.5 rounded-lg hover:border-gray-300 transition">Chỉnh sửa</button>
                  <button onClick={() => deleteProduct(product.id)}
                    className="text-xs text-red-500 border border-red-100 px-3 py-1.5 rounded-lg hover:border-red-200 transition">Xóa</button>
                </div>
              </div>
            )}
          </div>
        ))}
        {products.length === 0 && !addingNew && (
          <p className="text-center py-12 text-gray-400 text-sm">Chưa có sản phẩm nào.</p>
        )}
      </div>
    </div>
  );
}

// ── MeetingCeremony ────────────────────────────────────────────────────────────

const VI_DAY_NAMES = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
const DAY_LABELS: Record<number, string> = { 1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 7: "Chủ nhật" };
const WEEK_LABELS: Record<number, string> = { 0: "Hàng ngày", 1: "Tuần 1", 2: "Tuần 2", 3: "Tuần 3", 4: "Tuần 4" };

type TemplateForm = { product_id: string; name: string; ceremony_type: string; day_of_week: number; week_in_sprint: number; pic: string[]; output_template: string };
const emptyTemplateForm = (): TemplateForm => ({ product_id: "", name: "", ceremony_type: "Meeting", day_of_week: 1, week_in_sprint: 0, pic: [], output_template: "" });

function TemplateModal({ form, products, onChange, onSave, onClose, saving, title }: {
  form: TemplateForm; products: Product[]; onChange: (f: TemplateForm) => void;
  onSave: () => void; onClose: () => void; saving: boolean; title: string;
}) {
  const [picInput, setPicInput] = useState("");
  function addPic() {
    const val = picInput.trim();
    if (val && !form.pic.includes(val)) onChange({ ...form, pic: [...form.pic, val] });
    setPicInput("");
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sản phẩm</label>
            <select value={form.product_id} onChange={(e) => onChange({ ...form, product_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
              <option value="">— Chọn sản phẩm —</option>
              {products.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tên meeting</label>
            <input type="text" value={form.name} onChange={(e) => onChange({ ...form, name: e.target.value })}
              placeholder="Sprint Planning"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Type", value: form.ceremony_type, onChange: (v: string) => onChange({ ...form, ceremony_type: v }), options: [["Meeting", "Meeting"], ["Action", "Action"]] },
              { label: "Ngày", value: String(form.day_of_week), onChange: (v: string) => onChange({ ...form, day_of_week: Number(v) }), options: Object.entries(DAY_LABELS) },
              { label: "Lịch lặp", value: String(form.week_in_sprint), onChange: (v: string) => onChange({ ...form, week_in_sprint: Number(v) }), options: Object.entries(WEEK_LABELS) },
            ].map(({ label, value, onChange: onCh, options }) => (
              <div key={label}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
                <select value={value} onChange={e => onCh(e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500">
                  {options.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            ))}
          </div>
          {form.week_in_sprint === 0 && (
            <p className="text-xs text-blue-600 bg-blue-50 rounded-lg px-3 py-2">"Hàng ngày" — tạo cho mỗi ngày làm việc trong sprint.</p>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">PIC</label>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {form.pic.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded-full border border-red-100">
                  {tag}<button onClick={() => onChange({ ...form, pic: form.pic.filter(p => p !== tag) })} className="hover:text-red-900">×</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input type="text" value={picInput} onChange={e => setPicInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addPic())}
                placeholder="Thêm PIC rồi Enter..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
              <button onClick={addPic} className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition">+</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Output template</label>
            <textarea value={form.output_template} onChange={(e) => onChange({ ...form, output_template: e.target.value })}
              rows={4} placeholder="- [ ] ..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500 resize-none" />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-6 pb-5">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 transition">Hủy</button>
          <button onClick={onSave} disabled={saving || !form.name.trim()}
            className="px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition">
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </div>
      </div>
    </div>
  );
}

function GenerateMeetingsModal({
  productId, productName, templates, onClose, onDone,
}: {
  productId: string; productName: string;
  templates: MeetingTemplate[];
  onClose: () => void; onDone: () => void;
}) {
  const [sprintName, setSprintName] = useState(`${productName} Sprint `);
  const [startDate, setStartDate] = useState("");
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dow = startDate ? new Date(startDate + "T00:00:00").getDay() : -1;
  const isMonday = dow === 1;
  const dowLabel = startDate ? VI_DAY_NAMES[dow] : "";

  // Compute preview from templates + startDate
  const preview = useMemo(() => {
    if (!isMonday || !startDate) return [];
    const start = new Date(startDate + "T00:00:00");
    return templates
      .filter(t => t.product_id === productId && t.day_of_week)
      .flatMap(t => {
        const weeks = t.week_in_sprint === 0 ? [1, 2, 3, 4] : [t.week_in_sprint];
        return weeks.map(w => {
          const weekMonday = new Date(start);
          weekMonday.setDate(start.getDate() + (w - 1) * 7);
          const meetingDate = new Date(weekMonday);
          meetingDate.setDate(weekMonday.getDate() + (t.day_of_week! - 1));
          const label = meetingDate.toLocaleDateString("vi-VN", { weekday: "short", day: "2-digit", month: "2-digit" });
          return { week: w, name: t.name, date: label, ceremony_type: t.ceremony_type };
        });
      })
      .sort((a, b) => a.week - b.week || a.name.localeCompare(b.name));
  }, [startDate, isMonday, templates, productId]);

  const grouped = preview.reduce<Record<number, typeof preview>>((acc, t) => {
    (acc[t.week] ||= []).push(t); return acc;
  }, {});

  async function handleGenerate() {
    if (!isMonday || !sprintName.trim()) return;
    setGenerating(true); setError(null);
    try {
      await api.sprints.create({ product_id: productId, name: sprintName.trim(), start_date: startDate });
      onDone();
    } catch (e: any) { setError(e.message); } finally { setGenerating(false); }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl flex flex-col max-h-[90vh]">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <h3 className="font-semibold text-gray-900">Tạo sprint — {productName}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          {/* Sprint name */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Tên sprint</label>
            <input type="text" value={sprintName} onChange={e => setSprintName(e.target.value)}
              placeholder={`VD: ${productName} Sprint 16`}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>

          {/* Start date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Ngày bắt đầu <span className="text-gray-400">(phải là Thứ 2)</span></label>
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              {startDate && (
                <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${isMonday ? "bg-green-100 text-green-700" : "bg-red-100 text-red-600"}`}>
                  {dowLabel} {isMonday ? "✓" : "✗"}
                </span>
              )}
            </div>
            {startDate && !isMonday && <p className="text-xs text-red-600 mt-1">Vui lòng chọn Thứ 2</p>}
          </div>

          {/* Preview */}
          {isMonday && preview.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Sự kiện sẽ được tạo ({preview.length})</p>
              <div className="space-y-3 border border-gray-100 rounded-xl p-3 bg-gray-50">
                {[0, 1, 2, 3, 4].filter(w => grouped[w]?.length).map(w => (
                  <div key={w}>
                    <p className="text-[10px] font-semibold text-gray-400 uppercase mb-1">{WEEK_LABELS[w] || `Tuần ${w}`}</p>
                    <div className="space-y-1">
                      {grouped[w].map((item, i) => (
                        <div key={i} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={`px-1 py-0.5 rounded text-[10px] font-medium ${item.ceremony_type === "Meeting" ? "bg-blue-50 text-blue-600" : "bg-amber-50 text-amber-600"}`}>
                              {item.ceremony_type}
                            </span>
                            <span className="text-gray-800">{item.name}</span>
                          </div>
                          <span className="text-gray-400 shrink-0">{item.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!startDate && (
            <p className="text-xs text-gray-400 italic text-center py-2">Chọn ngày bắt đầu để xem preview sự kiện</p>
          )}

          {error && <p className="text-xs text-red-600">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 px-6 py-4 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-gray-200 rounded-lg text-gray-600 hover:border-gray-300 transition">Hủy</button>
          <button onClick={handleGenerate} disabled={generating || !startDate || !isMonday || !sprintName.trim()}
            className="px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition">
            {generating ? "Đang tạo..." : `Tạo sprint (${preview.length} sự kiện)`}
          </button>
        </div>
      </div>
    </div>
  );
}

function MeetingCeremonySection({ products: productsProp }: { products: Product[] }) {
  const [templates, setTemplates] = useState<MeetingTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<TemplateForm>(emptyTemplateForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeProductId, setActiveProductId] = useState<string>("");
  const [showGenerate, setShowGenerate] = useState(false);
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [sprintsLoading, setSprintsLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>(productsProp);

  // On mount: load templates + products + sprints for first product
  useEffect(() => {
    load();
    api.products.list().then(prods => {
      if (prods.length > 0) {
        setProducts(prods);
        setActiveProductId(prods[0].id);
        loadSprints(prods[0].id);
      }
    }).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function load() {
    setLoading(true);
    try { setTemplates(await api.meetingTemplates.list()); }
    catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  }

  async function loadSprints(pid: string) {
    if (!pid) return;
    setSprintsLoading(true);
    try { setSprints(await api.sprints.list(pid)); }
    catch (_e) { /* silent */ }
    finally { setSprintsLoading(false); }
  }

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const payload = { ...form, product_id: form.product_id || null, day_of_week: form.day_of_week || null };
      if (editId) await api.meetingTemplates.update(editId, payload);
      else await api.meetingTemplates.create(payload);
      setShowAdd(false); setEditId(null); setForm(emptyTemplateForm());
      await load();
    } catch (e: any) { setError(e.message); } finally { setSaving(false); }
  }

  async function handleDelete(id: string) {
    if (!confirm("Xóa template này?")) return;
    try { await api.meetingTemplates.delete(id); setTemplates(prev => prev.filter(t => t.id !== id)); }
    catch (e: any) { setError(e.message); }
  }

  const visibleTemplates = activeProductId ? templates.filter(t => t.product_id === activeProductId) : templates;
  const groupedTemplates = visibleTemplates.reduce<Record<number, MeetingTemplate[]>>((acc, t) => {
    (acc[t.week_in_sprint] ||= []).push(t); return acc;
  }, {});
  const activeProduct = products.find(p => p.id === activeProductId);

  return (
    <div className="space-y-6">
      {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">{error}</div>}

      {/* Product tabs */}
      {products.length > 0 && (
        <div className="flex gap-1 border-b border-gray-200">
          {products.map(p => (
            <button key={p.id} onClick={() => { setActiveProductId(p.id); loadSprints(p.id); }}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition ${activeProductId === p.id ? "border-red-500 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color || "#9CA3AF" }} />
                {p.name}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Section 1: Tạo sprint meeting */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Tạo sprint meeting</h3>
          {activeProductId && (
            <button onClick={() => setShowGenerate(true)}
              className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">
              + Tạo sprint mới
            </button>
          )}
        </div>

        {sprintsLoading ? (
          <p className="text-sm text-gray-400 text-center py-4">Đang tải...</p>
        ) : sprints.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6 italic border border-dashed border-gray-200 rounded-xl">
            Chưa có sprint nào. Nhấn &quot;+ Tạo sprint mới&quot; để bắt đầu.
          </p>
        ) : (
          <div className="space-y-2">
            {sprints.map(s => (
              <div key={s.id} className="flex items-center justify-between px-4 py-3 rounded-lg border border-gray-100 hover:border-gray-200 transition bg-gray-50">
                <div>
                  <p className="text-sm font-medium text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Bắt đầu: {new Date(s.start_date + "T00:00:00").toLocaleDateString("vi-VN")}
                    {(s.meetings?.length ?? 0) > 0 && <span className="ml-2">· {s.meetings!.length} sự kiện</span>}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-gray-100" />

      {/* Section 2: Tuỳ chỉnh sự kiện trong sprint */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-800">Tuỳ chỉnh sự kiện trong sprint</h3>
          <button onClick={() => { setShowAdd(true); setEditId(null); setForm({ ...emptyTemplateForm(), product_id: activeProductId }); }}
            className="px-3 py-1.5 text-xs bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
            + Thêm
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-gray-400 text-center py-4">Đang tải...</p>
        ) : visibleTemplates.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8 italic">Chưa có template. Nhấn &quot;+ Thêm&quot; để tạo.</p>
        ) : (
          <div className="space-y-5">
            {[0, 1, 2, 3, 4].filter(w => groupedTemplates[w]?.length).map(week => (
              <div key={week}>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{WEEK_LABELS[week]}</p>
                <div className="space-y-1.5">
                  {groupedTemplates[week].map(t => (
                    <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-gray-100 hover:border-gray-200 transition">
                      <div className="flex-1 min-w-0 flex items-center gap-2 flex-wrap">
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${t.ceremony_type === "Meeting" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                          {t.ceremony_type}
                        </span>
                        <span className="font-medium text-sm text-gray-900">{t.name}</span>
                        {t.day_of_week && <span className="text-xs text-gray-400">{DAY_LABELS[t.day_of_week]}</span>}
                        {t.pic?.map(p => <span key={p} className="text-xs bg-red-50 text-red-600 px-1.5 py-0.5 rounded-full border border-red-100">{p}</span>)}
                      </div>
                      <div className="flex gap-1.5 shrink-0">
                        <button onClick={() => { setEditId(t.id); setForm({ product_id: t.product_id || "", name: t.name, ceremony_type: t.ceremony_type, day_of_week: t.day_of_week || 1, week_in_sprint: t.week_in_sprint, pic: t.pic || [], output_template: t.output_template || "" }); }}
                          className="text-xs text-gray-500 border border-gray-200 px-2 py-1 rounded hover:border-gray-300 transition">Sửa</button>
                        <button onClick={() => handleDelete(t.id)}
                          className="text-xs text-red-400 border border-red-100 px-2 py-1 rounded hover:border-red-200 transition">Xóa</button>
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
        <TemplateModal form={form} products={products} onChange={setForm}
          onSave={handleSave} onClose={() => { setShowAdd(false); setEditId(null); setForm(emptyTemplateForm()); }}
          saving={saving} title={editId ? "Chỉnh sửa template" : "Thêm template mới"} />
      )}
      {showGenerate && activeProduct && (
        <GenerateMeetingsModal productId={activeProductId} productName={activeProduct.name}
          templates={visibleTemplates}
          onClose={() => setShowGenerate(false)}
          onDone={() => { setShowGenerate(false); loadSprints(activeProductId); }} />
      )}
    </div>
  );
}

// ── Main SettingsPage ──────────────────────────────────────────────────────────

const TABS = [
  { id: "products", label: "Sản phẩm", adminOnly: false },
  { id: "priority", label: "Công thức ưu tiên", adminOnly: false },
  { id: "ceremony", label: "Lịch Ceremony", adminOnly: false },
  { id: "access", label: "Quyền truy cập", adminOnly: true },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function SettingsPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email?.toLowerCase() || "";
  const isAdmin = PM_EMAILS.includes(userEmail);
  const [activeTab, setActiveTab] = useState<TabId>("products");
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const cached = localStorage.getItem("pm_products_cache");
      if (cached) {
        const { ts, data } = JSON.parse(cached);
        if (Date.now() - ts < 30_000) return data;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    api.products.list().then(data => {
      setProducts(data);
      localStorage.setItem("pm_products_cache", JSON.stringify({ ts: Date.now(), data }));
    }).catch(() => {});
  }, []);

  const visibleTabs = TABS.filter(t => !t.adminOnly || isAdmin);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cài đặt</h1>
        <p className="text-sm text-gray-500 mt-1">Quản lý sản phẩm, công thức ưu tiên và lịch ceremony</p>
      </div>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-gray-200">
        {visibleTabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-medium border-b-2 -mb-px transition ${activeTab === tab.id ? "border-red-500 text-red-600" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className={activeTab === "products" ? "" : "hidden"}><ProductsSection /></div>
        <div className={activeTab === "priority" ? "" : "hidden"}><PriorityFormula /></div>
        <div className={activeTab === "ceremony" ? "" : "hidden"}>
          <MeetingCeremonySection products={products} />
        </div>
        {isAdmin && <div className={activeTab === "access" ? "" : "hidden"}><AccessControl adminEmail={userEmail} /></div>}
      </div>
    </div>
  );
}
