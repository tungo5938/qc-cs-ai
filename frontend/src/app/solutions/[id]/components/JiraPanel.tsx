"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { JiraTicket } from "@/lib/types";

interface JiraPanelProps {
  solutionId: string;
  initialEpicKey: string | null;
  productJiraKey: string | null;
  onTicketsChange: (tickets: JiraTicket[]) => void;
}

export function JiraPanel({ solutionId, initialEpicKey, productJiraKey, onTicketsChange }: JiraPanelProps) {
  const [epicKey, setEpicKey] = useState(initialEpicKey || "");
  const [tickets, setTickets] = useState<JiraTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function syncTickets() {
    if (!epicKey.trim()) return;
    setLoading(true);
    await api.solutions.patchJiraEpic(solutionId, epicKey).catch(() => {});
    const result = (await api.jira.getEpicTickets(epicKey).catch(() => [])) as JiraTicket[];
    setTickets(result);
    onTicketsChange(result);
    setLoading(false);
  }

  async function createTicket() {
    if (!newTitle.trim() || !productJiraKey) return;
    setCreating(true);
    try {
      const result = await api.jira.createTicket({
        project_key: productJiraKey,
        title: newTitle,
        description: newDesc,
      });
      const newTicket: JiraTicket = { key: result.key, title: newTitle, status: "To Do", type: "Task", url: result.url };
      const updated = [newTicket, ...tickets];
      setTickets(updated);
      onTicketsChange(updated);
      setNewTitle("");
      setNewDesc("");
      setShowForm(false);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  const STATUS_COLORS: Record<string, string> = {
    "To Do": "bg-yellow-100 text-yellow-800",
    "In Progress": "bg-blue-100 text-blue-800",
    Done: "bg-green-100 text-green-800",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
        <span className="text-xs font-semibold text-amber-800">🎫 Jira</span>
        <input
          value={epicKey}
          onChange={(e) => setEpicKey(e.target.value)}
          placeholder="Epic key, vd: CSAI-10"
          className="border border-amber-200 rounded px-2 py-0.5 text-xs w-28"
        />
        <button
          onClick={syncTickets}
          disabled={loading}
          className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded hover:bg-amber-600 disabled:opacity-50"
        >
          {loading ? "..." : "Sync"}
        </button>
        <button
          onClick={() => setShowForm(!showForm)}
          disabled={!productJiraKey}
          title={!productJiraKey ? "Cần cấu hình Jira project key cho sản phẩm" : ""}
          className="bg-green-600 text-white text-xs px-2 py-0.5 rounded hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          + New
        </button>
      </div>

      {showForm && (
        <div className="p-2 border-b bg-gray-50 flex flex-col gap-1">
          <input
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ticket title..."
            className="border rounded px-2 py-1 text-xs w-full"
          />
          <input
            value={newDesc}
            onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)"
            className="border rounded px-2 py-1 text-xs w-full"
          />
          <div className="flex gap-1">
            <button
              onClick={createTicket}
              disabled={creating}
              className="bg-green-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50"
            >
              {creating ? "Creating..." : "Create"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 px-2">
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {tickets.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">Nhập epic key và nhấn Sync</p>
        )}
        {tickets.map((t) => (
          <a
            key={t.key}
            href={t.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white border border-gray-100 rounded-md px-2.5 py-1.5 hover:border-blue-200 transition"
          >
            <span className="bg-blue-50 text-blue-700 text-xs font-mono px-1.5 py-0.5 rounded">{t.key}</span>
            <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[t.status] || "bg-gray-100 text-gray-600"}`}>
              {t.status}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
