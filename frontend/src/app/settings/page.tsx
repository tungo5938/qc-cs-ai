"use client";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Product } from "@/lib/types";

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
  };
}

export default function SettingsPage() {
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
        <div className="flex items-center justify-between mb-1">
          <label className="block text-xs font-medium text-gray-700">Knowledge Base (text)</label>
          <label className={`text-xs cursor-pointer px-2 py-1 rounded border transition ${uploading ? 'opacity-50 cursor-not-allowed border-gray-200 text-gray-400' : 'border-gray-300 text-gray-600 hover:border-gray-400 hover:text-gray-800'}`}>
            {uploading ? "Đang upload..." : "📎 Upload .docx/.xlsx/.txt"}
            <input
              type="file"
              accept=".docx,.xlsx,.txt"
              className="hidden"
              disabled={uploading || !onKbUpload}
              onChange={e => {
                const file = e.target.files?.[0];
                if (file && onKbUpload) onKbUpload(file);
                e.target.value = ""; // reset so same file can be re-uploaded
              }}
            />
          </label>
        </div>
        <textarea
          value={form.kb_text}
          onChange={e => set("kb_text", e.target.value)}
          placeholder="Nhập nội dung KB hoặc upload file .docx/.xlsx/.txt..."
          rows={6}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 resize-y"
        />
        {form.kb_text && (
          <p className="text-xs text-gray-400 mt-1 text-right">
            {form.kb_text.length.toLocaleString()} ký tự
          </p>
        )}
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
