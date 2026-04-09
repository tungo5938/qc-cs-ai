"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { KBEntry } from "@/lib/types";
import { Trash2, Plus, FileText, Link2 } from "lucide-react";

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<KBEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"list" | "add" | "gdoc" | "jira">("list");
  const [form, setForm] = useState({ title: "", content: "" });
  const [gdocUrl, setGdocUrl] = useState("");
  const [jiraUrl, setJiraUrl] = useState("");
  const [importing, setImporting] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => api.kb.list().then(setEntries).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  const deleteEntry = async (id: string) => {
    await api.kb.delete(id);
    setEntries((prev) => prev.filter((e) => e.id !== id));
  };

  const addManual = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title || !form.content) return;
    await api.kb.create(form);
    setForm({ title: "", content: "" });
    setTab("list");
    load();
  };

  const importGdoc = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setMsg("");
    try {
      const res = await api.kb.importGdoc(gdocUrl, sessionStorage.getItem("qc_user_email") || undefined);
      setMsg(`Đã nhập ${res.imported} mục`);
      setGdocUrl("");
      load();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  const importJira = async (e: React.FormEvent) => {
    e.preventDefault();
    setImporting(true);
    setMsg("");
    try {
      await api.kb.importJira(jiraUrl, sessionStorage.getItem("qc_user_email") || undefined);
      setMsg("Ticket Jira đã được nhập vào cơ sở tri thức");
      setJiraUrl("");
      load();
    } catch (err: any) {
      setMsg(`Error: ${err.message}`);
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Cơ sở tri thức</h1>
        <span className="text-sm text-gray-500">{entries.length} mục</span>
      </div>

      <div className="flex gap-2">
        {[
          { key: "list", label: "Danh sách" },
          { key: "add", label: "+ Thủ công" },
          { key: "gdoc", label: "Nhập Google Doc" },
          { key: "jira", label: "Nhập Jira" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => { setTab(key as any); setMsg(""); }}
            className={`text-sm px-3 py-1.5 rounded-lg border transition ${
              tab === key ? "bg-red-600 text-white border-red-600" : "border-gray-200 text-gray-600 hover:border-gray-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {msg && <p className="text-sm text-green-600 bg-green-50 border border-green-200 rounded-lg px-3 py-2">{msg}</p>}

      {tab === "list" && (
        <div className="space-y-2">
          {loading ? (
            <div className="text-center py-8 text-gray-400">Đang tải...</div>
          ) : entries.length === 0 ? (
            <div className="text-center py-8 text-gray-400">Chưa có mục nào. Nhập từ Google Doc hoặc thêm thủ công.</div>
          ) : (
            entries.map((entry) => (
              <div key={entry.id} className="bg-white rounded-xl border border-gray-200 p-4 flex gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{entry.source_type}</span>
                    {entry.source_ref && <span className="text-xs text-gray-400 truncate max-w-[200px]">{entry.source_ref}</span>}
                  </div>
                  <h3 className="font-medium text-gray-900 text-sm">{entry.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{entry.content}</p>
                </div>
                <button onClick={() => deleteEntry(entry.id)} className="text-gray-300 hover:text-red-500 transition shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {tab === "add" && (
        <form onSubmit={addManual} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-gray-900">Thêm mục thủ công</h2>
          <input
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            placeholder="Tiêu đề"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <textarea
            value={form.content}
            onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            placeholder="Nội dung..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 h-32 resize-none"
          />
          <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 transition">
            Thêm mục
          </button>
        </form>
      )}

      {tab === "gdoc" && (
        <form onSubmit={importGdoc} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-gray-900">Nhập từ Google Doc</h2>
          <p className="text-sm text-gray-500">Tài liệu phải được đặt ở chế độ "Bất kỳ ai có link đều có thể xem".</p>
          <input
            value={gdocUrl}
            onChange={(e) => setGdocUrl(e.target.value)}
            placeholder="https://docs.google.com/document/d/..."
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button type="submit" disabled={importing || !gdocUrl} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">
            {importing ? "Đang nhập..." : "Nhập"}
          </button>
        </form>
      )}

      {tab === "jira" && (
        <form onSubmit={importJira} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4 max-w-2xl">
          <h2 className="font-semibold text-gray-900">Nhập ticket Jira vào cơ sở tri thức</h2>
          <p className="text-sm text-gray-500">Dán URL Jira — tiêu đề và mô tả ticket sẽ được thêm vào cơ sở tri thức.</p>
          <input
            value={jiraUrl}
            onChange={(e) => setJiraUrl(e.target.value)}
            placeholder="https://yourcompany.atlassian.net/browse/GHN-123"
            className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
          />
          <button type="submit" disabled={importing || !jiraUrl} className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition">
            {importing ? "Importing..." : "Import"}
          </button>
        </form>
      )}
    </div>
  );
}
