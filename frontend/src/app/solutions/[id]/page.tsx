// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { Panel, Group as PanelGroup, Separator as PanelResizeHandle } from "react-resizable-panels";
import { api } from "@/lib/api";
import type { SolutionDraft, JiraTicket } from "@/lib/types";
import { SOLUTION_STATUS_LABELS, SOLUTION_STATUS_COLORS } from "@/lib/constants";
import { WorkspaceProvider } from "./components/WorkspaceContext";
import { CanvasPanel } from "./components/CanvasPanel";
import { PrdEditor } from "./components/PrdEditor";
import { JiraPanel } from "./components/JiraPanel";
import { AiChatBar } from "./components/AiChatBar";

export default function SolutionWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [sol, setSol] = useState<SolutionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);

  useEffect(() => {
    api.solutions
      .get(id)
      .then((r) => setSol(r as SolutionDraft))
      .finally(() => setLoading(false));
  }, [id]);

  const handleJiraTicketCreated = useCallback((ticket: JiraTicket) => {
    setJiraTickets((prev) => [ticket, ...prev]);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen text-gray-400 text-sm">
        Đang tải...
      </div>
    );
  }
  if (!sol) {
    return (
      <div className="flex items-center justify-center h-screen text-red-400 text-sm">
        Không tìm thấy solution.
      </div>
    );
  }

  return (
    <WorkspaceProvider>
      <div className="flex flex-col h-screen bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 text-white text-sm shrink-0">
          <span className="font-semibold truncate max-w-xs">
            {sol.problem_statement || "Solution Workspace"}
          </span>
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              SOLUTION_STATUS_COLORS[sol.status] || "bg-gray-600"
            }`}
          >
            {SOLUTION_STATUS_LABELS[sol.status] || sol.status}
          </span>
          <div className="flex-1" />
          <span className="text-xs text-slate-400">Auto-saved</span>
        </div>

        {/* Main area */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup orientation="horizontal" id={`workspace-h-${id}`}>
            <Panel defaultSize={50} minSize={20}>
              <CanvasPanel solutionId={id} initialData={(sol as any).tldraw_data || null} />
            </Panel>

            <PanelResizeHandle className="w-1.5 bg-slate-300 hover:bg-blue-400 cursor-col-resize transition-colors" />

            <Panel defaultSize={50} minSize={20}>
              <PanelGroup orientation="vertical" id={`workspace-v-${id}`}>
                <Panel defaultSize={60} minSize={20}>
                  <PrdEditor solutionId={id} initialContent={(sol as any).prd_content || null} />
                </Panel>
                <PanelResizeHandle className="h-1.5 bg-slate-300 hover:bg-blue-400 cursor-row-resize transition-colors" />
                <Panel defaultSize={40} minSize={15}>
                  <JiraPanel
                    solutionId={id}
                    initialEpicKey={(sol as any).jira_epic_key || null}
                    productJiraKey={null}
                    onTicketsChange={setJiraTickets}
                  />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>

        {/* AI Chat bar */}
        <div className="shrink-0">
          <AiChatBar
            solutionId={id}
            jiraTickets={jiraTickets}
            productJiraKey={null}
            onJiraTicketCreated={handleJiraTicketCreated}
          />
        </div>
      </div>
    </WorkspaceProvider>
  );
}
