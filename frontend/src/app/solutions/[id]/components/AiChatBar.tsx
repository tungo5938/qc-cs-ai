"use client";
import { useState, useRef } from "react";
import { api } from "@/lib/api";
import type { JiraTicket, WorkspaceAction } from "@/lib/types";

interface AiChatBarProps {
  solutionId: string;
  jiraTickets: JiraTicket[];
  productJiraKey: string | null;
  onJiraTicketCreated: (ticket: JiraTicket) => void;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export function AiChatBar({ solutionId, jiraTickets, productJiraKey, onJiraTicketCreated }: AiChatBarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const action: WorkspaceAction = await api.solutions.chat(solutionId, userMsg, jiraTickets);

      if (action.action === "update_prd" && action.prd_patch) {
        const applyPatch = (window as any).__prdApplyPatch;
        if (applyPatch) applyPatch(action.prd_patch.new_content);
      }

      if (action.action === "create_jira_ticket" && action.jira_ticket && productJiraKey) {
        try {
          const result = await api.jira.createTicket({
            project_key: productJiraKey,
            title: action.jira_ticket.title,
            description: action.jira_ticket.description,
            issue_type: action.jira_ticket.type || "Task",
          });
          onJiraTicketCreated({
            key: result.key,
            title: action.jira_ticket.title,
            status: "To Do",
            type: action.jira_ticket.type,
            url: result.url,
          });
        } catch (e) {
          console.error("Failed to create Jira ticket:", e);
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: action.message || "Xong!" }]);
    } catch {
      setMessages((prev) => [...prev, { role: "assistant", content: "Có lỗi xảy ra, thử lại nhé." }]);
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-green-200 bg-green-50">
      {expanded && messages.length > 0 && (
        <div className="max-h-40 overflow-y-auto px-4 py-2 flex flex-col gap-1.5 border-b border-green-100">
          {messages.map((m, i) => (
            <div
              key={i}
              className={`text-xs px-3 py-1.5 rounded-lg max-w-[80%] ${
                m.role === "user"
                  ? "bg-white border border-gray-200 self-end"
                  : "bg-green-100 text-green-900 self-start"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center gap-2 px-4 py-2">
        <button onClick={() => setExpanded(!expanded)} className="text-green-700 font-semibold text-sm">
          🤖
        </button>
        {messages.length > 0 && (
          <span className="text-xs text-green-600 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            {expanded ? "▼" : "▲"} {messages.length} messages
          </span>
        )}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Ví dụ: "Tạo jira ticket cho user flow" · "Cập nhật PRD section 1 với..."'
          className="flex-1 bg-white border border-green-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          disabled={loading}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
