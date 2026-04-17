"use client";
import { useState, useEffect, useRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { diffLines, Change } from "diff";
import { api } from "@/lib/api";
import type { ProductDocument, DocumentAction, DocumentChatMessage } from "@/lib/types";

// ─── File Tree ────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  fullPath: string;
  doc?: ProductDocument;
  children: TreeNode[];
}

function buildTree(docs: ProductDocument[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const doc of docs) {
    const parts = doc.path.split("/");
    let nodes = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const fullPath = parts.slice(0, i + 1).join("/");
      let node = nodes.find(n => n.name === name);
      if (!node) {
        node = { name, fullPath, children: [] };
        nodes.push(node);
      }
      if (i === parts.length - 1) node.doc = doc;
      nodes = node.children;
    }
  }
  return root;
}

function TreeNodeView({
  node,
  activeId,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  activeId: string | null;
  onSelect: (doc: ProductDocument) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const isFolder = node.children.length > 0;
  const isActive = node.doc?.id === activeId;

  return (
    <div>
      {node.doc ? (
        <button
          onClick={() => onSelect(node.doc!)}
          className={`w-full text-left px-2 py-1 rounded text-sm truncate flex items-center gap-1 ${
            isActive ? "bg-blue-100 text-blue-800 font-medium" : "text-gray-700 hover:bg-gray-100"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-gray-400 shrink-0">📄</span>
          <span className="truncate">{node.name}.md</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full text-left px-2 py-1 text-sm font-medium text-gray-500 flex items-center gap-1 hover:bg-gray-50 rounded"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span>{open ? "▾" : "▸"}</span>
          <span>{node.name}</span>
        </button>
      )}
      {isFolder && open && (
        <div>
          {node.children.map(child => (
            <TreeNodeView key={child.fullPath} node={child} activeId={activeId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function DocumentSidebar({
  docs,
  activeId,
  onSelect,
  onNewDoc,
}: {
  docs: ProductDocument[];
  activeId: string | null;
  onSelect: (doc: ProductDocument) => void;
  onNewDoc: () => void;
}) {
  const tree = buildTree(docs);
  return (
    <div className="w-60 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tài liệu</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {tree.map(node => (
          <TreeNodeView key={node.fullPath} node={node} activeId={activeId} onSelect={onSelect} />
        ))}
        {docs.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-2">Chưa có tài liệu nào.</p>
        )}
      </div>
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={onNewDoc}
          className="w-full text-sm text-blue-600 hover:text-blue-800 text-left px-1"
        >
          + New file
        </button>
      </div>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function DocumentEditor({
  doc,
  pendingContent,
  onSaved,
  onClearPending,
}: {
  doc: ProductDocument | null;
  pendingContent: string | null;
  onSaved: (updated: ProductDocument) => void;
  onClearPending: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (doc) {
      setDraft(doc.content);
      setEditMode(false);
    }
  }, [doc?.id]);

  useEffect(() => {
    if (pendingContent !== null) {
      setDraft(pendingContent);
      setEditMode(true);
    }
  }, [pendingContent]);

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    try {
      const updated = await api.documents.update(doc.id, { content: draft });
      onSaved(updated as ProductDocument);
      setEditMode(false);
      onClearPending();
    } finally {
      setSaving(false);
    }
  }

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Chọn tài liệu từ sidebar để xem
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{doc.title}</h1>
          <p className="text-xs text-gray-400">{doc.path}.md</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => { setEditMode(false); setDraft(doc.content); onClearPending(); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded border border-gray-200"
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {editMode ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full h-full min-h-[400px] p-6 font-mono text-sm text-gray-800 resize-none focus:outline-none border-none"
            spellCheck={false}
          />
        ) : (
          <div className="prose prose-sm max-w-none p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content || "_Tài liệu trống. Nhấn ✏️ Edit để bắt đầu._"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Diff Preview ─────────────────────────────────────────────────────────────

function DiffPreview({
  oldContent,
  newContent,
  docPath,
  onApply,
  onDismiss,
}: {
  oldContent: string;
  newContent: string;
  docPath: string;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const changes: Change[] = diffLines(oldContent, newContent);
  const hasChanges = changes.some(c => c.added || c.removed);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-600">📄 {docPath}.md</span>
        <div className="flex items-center gap-2">
          <button onClick={onApply} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700">
            ✅ Apply
          </button>
          <button onClick={onDismiss} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded border border-gray-200">
            ✗ Bỏ qua
          </button>
        </div>
      </div>
      {hasChanges ? (
        <div className="font-mono text-xs max-h-40 overflow-y-auto">
          {changes.map((change, i) => {
            if (!change.added && !change.removed) return null;
            const lines = change.value.split("\n").filter((l, idx, arr) => idx < arr.length - 1 || l !== "");
            return lines.map((line, j) => (
              <div
                key={`${i}-${j}`}
                className={`px-3 py-0.5 ${change.added ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
              >
                {change.added ? "+ " : "- "}{line}
              </div>
            ));
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 px-3 py-2">Không có thay đổi.</p>
      )}
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function DocumentChatPanel({
  activeDoc,
  allDocs,
  onApplyAction,
}: {
  activeDoc: ProductDocument | null;
  allDocs: ProductDocument[];
  onApplyAction: (docPath: string, newContent: string) => void;
}) {
  const [messages, setMessages] = useState<DocumentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [taggedDocs, setTaggedDocs] = useState<ProductDocument[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState("");
  const [sending, setSending] = useState(false);
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    const lastSlash = val.lastIndexOf("/");
    if (lastSlash !== -1 && lastSlash === val.length - 1) {
      setShowDropdown(true);
      setDropdownFilter("");
    } else if (lastSlash !== -1 && lastSlash < val.length - 1 && showDropdown) {
      setDropdownFilter(val.slice(lastSlash + 1));
    } else if (!val.includes("/")) {
      setShowDropdown(false);
    }
  }

  function handleTagDoc(doc: ProductDocument) {
    if (!taggedDocs.find(d => d.id === doc.id)) {
      setTaggedDocs(prev => [...prev, doc]);
    }
    const lastSlash = input.lastIndexOf("/");
    setInput(lastSlash !== -1 ? input.slice(0, lastSlash) : input);
    setShowDropdown(false);
  }

  function removeTag(docId: string) {
    setTaggedDocs(prev => prev.filter(d => d.id !== docId));
  }

  async function handleSend() {
    if (!input.trim() || !activeDoc) return;
    const msg = input.trim();
    setInput("");
    setTaggedDocs([]);
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setSending(true);
    try {
      const res = await api.documents.chat(activeDoc.id, msg, taggedDocs.map(d => d.id));
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.reply,
        actions: res.actions as DocumentAction[],
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Lỗi: ${e.message}` }]);
    } finally {
      setSending(false);
    }
  }

  const filteredDocs = allDocs.filter(d =>
    d.path.toLowerCase().includes(dropdownFilter.toLowerCase()) ||
    d.title.toLowerCase().includes(dropdownFilter.toLowerCase())
  );

  return (
    <div className="border-t border-gray-200 flex flex-col bg-white" style={{ height: "220px" }}>
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 text-sm">
        {messages.length === 0 && (
          <p className="text-gray-400 text-xs pt-1">Chat với AI về tài liệu đang mở. Gõ <code>/</code> để tag thêm tài liệu.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`inline-block px-3 py-1.5 rounded-lg max-w-[90%] ${
              msg.role === "user"
                ? "bg-blue-600 text-white ml-auto block"
                : "bg-gray-100 text-gray-800"
            }`}>
              {msg.content}
            </div>
            {msg.actions?.map((action, j) => {
              const actionKey = `${i}-${j}`;
              if (dismissedActions.has(actionKey)) return null;
              const targetDoc = allDocs.find(d => d.path === action.document_path);
              return (
                <DiffPreview
                  key={actionKey}
                  oldContent={targetDoc?.content ?? ""}
                  newContent={action.new_content}
                  docPath={action.document_path}
                  onApply={() => {
                    onApplyAction(action.document_path, action.new_content);
                    setDismissedActions(prev => new Set(prev).add(actionKey));
                  }}
                  onDismiss={() => setDismissedActions(prev => new Set(prev).add(actionKey))}
                />
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-gray-100 px-3 py-2 relative">
        {taggedDocs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {taggedDocs.map(d => (
              <span key={d.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                /{d.path}
                <button onClick={() => removeTag(d.id)} className="text-blue-400 hover:text-blue-700">×</button>
              </span>
            ))}
          </div>
        )}

        {showDropdown && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-20">
            {filteredDocs.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-2">Không tìm thấy tài liệu.</p>
            ) : (
              filteredDocs.map(d => (
                <button
                  key={d.id}
                  onClick={() => handleTagDoc(d)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="text-gray-400">📄</span>
                  <span className="font-mono text-gray-700">{d.path}.md</span>
                  <span className="text-gray-400 truncate">{d.title}</span>
                </button>
              ))
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && !showDropdown) {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") setShowDropdown(false);
            }}
            placeholder={activeDoc ? `Hỏi về ${activeDoc.title}... (gõ / để tag tài liệu)` : "Chọn tài liệu trước"}
            disabled={!activeDoc || sending}
            rows={1}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !activeDoc || sending}
            className="shrink-0 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            {sending ? "..." : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Doc Modal ────────────────────────────────────────────────────────────

function NewDocModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (doc: ProductDocument) => void;
}) {
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!path.trim() || !title.trim()) return;
    setSaving(true);
    try {
      const doc = await api.documents.create({ path: path.trim(), title: title.trim() });
      onCreate(doc as ProductDocument);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl space-y-4">
        <h2 className="text-lg font-semibold">Tạo tài liệu mới</h2>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Path (e.g. cs-ai/roadmap)</label>
          <input
            value={path}
            onChange={e => setPath(e.target.value)}
            placeholder="cs-ai/roadmap"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tiêu đề</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="CS AI — Roadmap"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-gray-500 px-3 py-1.5 rounded border border-gray-200">Huỷ</button>
          <button
            onClick={handleCreate}
            disabled={!path.trim() || !title.trim() || saving}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Đang tạo..." : "Tạo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [docs, setDocs] = useState<ProductDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<ProductDocument | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  useEffect(() => {
    api.documents.list().then(d => {
      const sorted = (d as ProductDocument[]).sort((a, b) => a.path.localeCompare(b.path));
      setDocs(sorted);
      if (sorted.length > 0 && !activeDoc) setActiveDoc(sorted[0]);
    });
  }, []);

  function handleDocSaved(updated: ProductDocument) {
    setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
    setActiveDoc(updated);
  }

  function handleApplyAction(docPath: string, newContent: string) {
    const target = docs.find(d => d.path === docPath);
    if (!target) return;
    if (target.id === activeDoc?.id) {
      setPendingContent(newContent);
    } else {
      api.documents.update(target.id, { content: newContent }).then(updated => {
        setDocs(prev => prev.map(d => d.id === (updated as ProductDocument).id ? updated as ProductDocument : d));
      });
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex flex-1 min-h-0">
        <DocumentSidebar
          docs={docs}
          activeId={activeDoc?.id ?? null}
          onSelect={doc => { setActiveDoc(doc); setPendingContent(null); }}
          onNewDoc={() => setShowNewModal(true)}
        />
        <DocumentEditor
          doc={activeDoc}
          pendingContent={pendingContent}
          onSaved={handleDocSaved}
          onClearPending={() => setPendingContent(null)}
        />
      </div>
      <DocumentChatPanel
        activeDoc={activeDoc}
        allDocs={docs}
        onApplyAction={handleApplyAction}
      />
      {showNewModal && (
        <NewDocModal
          onClose={() => setShowNewModal(false)}
          onCreate={doc => {
            setDocs(prev => [...prev, doc].sort((a, b) => a.path.localeCompare(b.path)));
            setActiveDoc(doc);
            setShowNewModal(false);
          }}
        />
      )}
    </div>
  );
}
