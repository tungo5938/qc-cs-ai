"use client";
import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { api } from "@/lib/api";
import { PRODUCT_FILTER_KEY } from "@/components/NavBar";
import type { RoadmapPhase, RoadmapSprint, ActionItem } from "@/lib/types";

const PM_EMAILS = (process.env.NEXT_PUBLIC_PM_QC_EMAILS || "").split(",").map((e) => e.trim());

const PRODUCT_TABS = [
  { id: "cs-ai", label: "CS AI" },
  { id: "cs-chat", label: "CS Chat" },
  { id: "voice-ai", label: "Voice AI" },
];

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    todo: "bg-gray-700 text-gray-300",
    confirmed: "bg-blue-900/40 text-blue-300",
    in_progress: "bg-yellow-900/40 text-yellow-300",
    done: "bg-green-900/40 text-green-300",
    cancelled: "bg-red-900/40 text-red-300",
  };
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${colors[status] ?? "bg-gray-700 text-gray-300"}`}>
      {status}
    </span>
  );
}

function PhaseModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: { id: string; name: string; description: string | null };
  onClose: () => void;
  onSave: (name: string, description: string) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave(name, description);
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6">
        <h2 className="text-white font-semibold text-lg mb-4">
          {initial ? "Chỉnh sửa Phase" : "Thêm Phase"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Tên phase</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Mô tả (tuỳ chọn)</label>
            <textarea
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500 resize-none"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SprintModal({
  phaseId,
  initial,
  onClose,
  onSave,
}: {
  phaseId: string;
  initial?: RoadmapSprint;
  onClose: () => void;
  onSave: (data: {
    name: string;
    start_date: string | null;
    end_date: string | null;
  }) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [startDate, setStartDate] = useState(initial?.start_date ?? "");
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await onSave({ name, start_date: startDate || null, end_date: endDate || null });
    setSaving(false);
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6">
        <h2 className="text-white font-semibold text-lg mb-4">
          {initial ? "Chỉnh sửa Sprint" : "Thêm Sprint"}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Tên sprint</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Ngày bắt đầu</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm text-gray-400 mb-1 block">Ngày kết thúc</label>
              <input
                type="date"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function CreateTaskModal({
  phaseId,
  sprintId,
  productId,
  onClose,
  onCreated,
}: {
  phaseId: string;
  sprintId: string;
  productId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [form, setForm] = useState({
    title: "",
    assignee: "",
    deadline: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.actionItems.create({
        title: form.title,
        assignee: form.assignee || undefined,
        deadline: form.deadline || null,
        product_id: productId,
        phase_id: phaseId,
        sprint_id: sprintId,
      });
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6">
        <h2 className="text-white font-semibold text-lg mb-4">Thêm Task</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Tiêu đề</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Assignee</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Deadline</label>
            <input
              type="date"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Thêm task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function EditTaskModal({
  task,
  onClose,
  onSaved,
}: {
  task: ActionItem;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
    title: task.title,
    assignee: task.assignee ?? "",
    deadline: task.deadline ?? "",
    status: task.status,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await api.actionItems.update(task.id, {
        title: form.title,
        assignee: form.assignee || null,
        deadline: form.deadline || null,
        status: form.status,
      });
      onSaved();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const STATUS_OPTIONS = [
    { value: "todo", label: "Todo" },
    { value: "confirmed", label: "Confirmed" },
    { value: "in_progress", label: "In Progress" },
    { value: "done", label: "Done" },
    { value: "cancelled", label: "Cancelled" },
  ];

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-white font-semibold text-lg">Chỉnh sửa Task</h2>
          <a
            href={`/actions`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-500 hover:text-red-400 flex items-center gap-1 transition-colors"
            title="Xem trong Action Items"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
            Actions
          </a>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Tiêu đề</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Status</label>
            <select
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value as any })}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Assignee</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 mb-1 block">Deadline</label>
            <input
              type="date"
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:ring-1 focus:ring-red-500"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors">
              Huỷ
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium disabled:opacity-50"
            >
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function SprintRow({
  sprint,
  isPM,
  onEdit,
  onDelete,
  onAddTask,
  tasks,
  onTaskUpdated,
}: {
  sprint: RoadmapSprint;
  isPM: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onAddTask: () => void;
  tasks: ActionItem[];
  onTaskUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [editingTask, setEditingTask] = useState<ActionItem | null>(null);
  const dateRange =
    sprint.start_date && sprint.end_date
      ? `${sprint.start_date} – ${sprint.end_date}`
      : sprint.start_date || "";

  async function handleDeleteTask(taskId: string) {
    if (!confirm("Xoá task này?")) return;
    await api.actionItems.delete(taskId);
    onTaskUpdated();
  }

  return (
    <div className="ml-4 border-l border-gray-700 pl-4 mb-2">
      <div className="flex items-center gap-2 py-1.5 group">
        <button onClick={() => setExpanded(!expanded)} className="text-gray-500 hover:text-gray-300 text-xs w-4">
          {expanded ? "▼" : "▶"}
        </button>
        <span className="text-sm font-medium text-gray-200">{sprint.name}</span>
        {dateRange && <span className="text-xs text-gray-500">({dateRange})</span>}
        <span className="text-xs text-gray-600">
          {sprint.task_counts.done}/{sprint.task_counts.total} done
          {sprint.task_counts.overdue > 0 && (
            <span className="text-red-400 ml-1">· {sprint.task_counts.overdue} overdue ⚠</span>
          )}
        </span>
        {isPM && (
          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button onClick={onAddTask} className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">
              + Task
            </button>
            <button onClick={onEdit} className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded">
              Edit
            </button>
            <button onClick={onDelete} className="text-xs px-2 py-0.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 rounded">
              Delete
            </button>
          </div>
        )}
      </div>
      {expanded && tasks.length > 0 && (
        <div className="ml-6 space-y-0.5 mt-1">
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center gap-2 py-1 text-sm group/task">
              <span className="text-gray-600 text-xs">☐</span>
              <span className="text-gray-200 flex-1 min-w-0 truncate">{task.title}</span>
              {task.assignee && <span className="text-xs text-gray-500 shrink-0">{task.assignee}</span>}
              {task.deadline && (
                <span className={`text-xs shrink-0 ${new Date(task.deadline) < new Date() && task.status !== "done" ? "text-red-400" : "text-gray-500"}`}>
                  {task.deadline}
                </span>
              )}
              <StatusBadge status={task.status} />
              <div className="flex items-center gap-1 opacity-0 group-hover/task:opacity-100 transition-opacity shrink-0">
                <button
                  onClick={() => setEditingTask(task)}
                  className="text-xs px-1.5 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                  title="Chỉnh sửa task"
                >
                  Edit
                </button>
                {isPM && (
                  <button
                    onClick={() => handleDeleteTask(task.id)}
                    className="text-xs px-1.5 py-0.5 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded"
                    title="Xoá task"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {expanded && tasks.length === 0 && (
        <p className="ml-6 text-xs text-gray-600 py-1">Chưa có task</p>
      )}

      {editingTask && (
        <EditTaskModal
          task={editingTask}
          onClose={() => setEditingTask(null)}
          onSaved={() => {
            setEditingTask(null);
            onTaskUpdated();
          }}
        />
      )}
    </div>
  );
}

export default function RoadmapPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? "";
  const isPM = PM_EMAILS.includes(userEmail);

  const [productId, setProductId] = useState<string>(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(PRODUCT_FILTER_KEY) || "cs-ai";
    }
    return "cs-ai";
  });
  const [productIdMap, setProductIdMap] = useState<Record<string, string>>({});
  const [phases, setPhases] = useState<RoadmapPhase[]>([]);
  const [tasksBySprintId, setTasksBySprintId] = useState<Record<string, ActionItem[]>>({});
  const [loading, setLoading] = useState(false);

  // Modals
  const [phaseModal, setPhaseModal] = useState<
    null | { mode: "create" } | { mode: "edit"; phase: RoadmapPhase }
  >(null);
  const [sprintModal, setSprintModal] = useState<
    null | { mode: "create"; phaseId: string } | { mode: "edit"; sprint: RoadmapSprint }
  >(null);
  const [taskModal, setTaskModal] = useState<null | { phaseId: string; sprintId: string }>(null);

  useEffect(() => {
    api.products.list().then((products: any[]) => {
      const map: Record<string, string> = {};
      for (const p of products) {
        const slug = p.name.toLowerCase().replace(/\s+/g, "-");
        map[slug] = p.id;
      }
      setProductIdMap(map);
    }).catch(() => {});
  }, []);

  const loadPhases = useCallback(async () => {
    setLoading(true);
    try {
      const realProductId = productIdMap[productId] ?? productId;
      const data = await api.roadmap.listPhases(realProductId);
      setPhases(data);
      // Load tasks for all sprints
      const allSprints = data.flatMap((p) => p.sprints);
      const taskMap: Record<string, ActionItem[]> = {};
      await Promise.all(
        allSprints.map(async (s) => {
          const tasks = await api.roadmap.listTasks({ sprint_id: s.id });
          taskMap[s.id] = tasks;
        })
      );
      setTasksBySprintId(taskMap);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [productId, productIdMap]);

  useEffect(() => {
    loadPhases();
  }, [loadPhases]);

  useEffect(() => {
    function onStorage(e: StorageEvent) {
      if (e.key === PRODUCT_FILTER_KEY && e.newValue) {
        const newProduct = e.newValue || "cs-ai";
        setProductId(newProduct);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  async function handleDeletePhase(phaseId: string) {
    if (!confirm("Xoá phase này? Tasks sẽ không bị xoá nhưng sẽ không còn liên kết.")) return;
    await api.roadmap.deletePhase(phaseId);
    loadPhases();
  }

  async function handleDeleteSprint(sprintId: string) {
    if (!confirm("Xoá sprint này?")) return;
    await api.roadmap.deleteSprint(sprintId);
    loadPhases();
  }

  // Find effective product tab (default to first if stored value not in PRODUCT_TABS)
  const activeTab = PRODUCT_TABS.find((t) => t.id === productId) ? productId : "cs-ai";

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-white">Roadmap</h1>
        </div>

        {/* Product tabs */}
        <div className="flex gap-1 mb-6 bg-gray-900 rounded-xl p-1 w-fit border border-gray-800">
          {PRODUCT_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setProductId(tab.id);
                localStorage.setItem(PRODUCT_FILTER_KEY, tab.id);
              }}
              className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "bg-red-600/20 text-red-400 ring-1 ring-red-600/30"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Phase list */}
        {loading ? (
          <p className="text-gray-500 text-sm">Đang tải...</p>
        ) : phases.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-500 text-sm">Chưa có phase nào.</p>
            {isPM && (
              <button
                onClick={() => setPhaseModal({ mode: "create" })}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm rounded-lg font-medium"
              >
                + Thêm Phase đầu tiên
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {phases.map((phase) => (
              <div key={phase.id} className="bg-gray-900 rounded-xl border border-gray-800 p-4">
                {/* Phase header */}
                <div className="flex items-center gap-2 mb-3 group">
                  <span className="text-sm font-semibold text-gray-100 flex-1">
                    ── {phase.name}
                  </span>
                  {phase.description && (
                    <span className="text-xs text-gray-500">{phase.description}</span>
                  )}
                  {isPM && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setSprintModal({ mode: "create", phaseId: phase.id })}
                        className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                      >
                        + Sprint
                      </button>
                      <button
                        onClick={() => setPhaseModal({ mode: "edit", phase })}
                        className="text-xs px-2 py-0.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeletePhase(phase.id)}
                        className="text-xs px-2 py-0.5 bg-red-900/40 hover:bg-red-900/60 text-red-400 rounded"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>

                {/* Sprints */}
                {phase.sprints.map((sprint) => (
                  <SprintRow
                    key={sprint.id}
                    sprint={sprint}
                    isPM={isPM}
                    tasks={tasksBySprintId[sprint.id] ?? []}
                    onEdit={() => setSprintModal({ mode: "edit", sprint })}
                    onDelete={() => handleDeleteSprint(sprint.id)}
                    onAddTask={() => setTaskModal({ phaseId: phase.id, sprintId: sprint.id })}
                    onTaskUpdated={loadPhases}
                  />
                ))}
                {phase.sprints.length === 0 && (
                  <p className="ml-4 text-xs text-gray-600">Chưa có sprint</p>
                )}
              </div>
            ))}

            {isPM && (
              <button
                onClick={() => setPhaseModal({ mode: "create" })}
                className="text-sm text-gray-500 hover:text-gray-300 transition-colors px-2 py-1"
              >
                + Add Phase
              </button>
            )}
          </div>
        )}
      </div>

      {/* Phase modal */}
      {phaseModal && (
        <PhaseModal
          initial={phaseModal.mode === "edit" ? phaseModal.phase : undefined}
          onClose={() => setPhaseModal(null)}
          onSave={async (name, description) => {
            if (phaseModal.mode === "create") {
              await api.roadmap.createPhase({ product_id: productIdMap[productId] ?? productId, name, description });
            } else {
              await api.roadmap.updatePhase(phaseModal.phase.id, { name, description });
            }
            setPhaseModal(null);
            loadPhases();
          }}
        />
      )}

      {/* Sprint modal */}
      {sprintModal && (
        <SprintModal
          phaseId={sprintModal.mode === "create" ? sprintModal.phaseId : sprintModal.sprint.phase_id}
          initial={sprintModal.mode === "edit" ? sprintModal.sprint : undefined}
          onClose={() => setSprintModal(null)}
          onSave={async (data) => {
            if (sprintModal.mode === "create") {
              await api.roadmap.createSprint({
                phase_id: sprintModal.phaseId,
                ...data,
              });
            } else {
              await api.roadmap.updateSprint(sprintModal.sprint.id, data);
            }
            setSprintModal(null);
            loadPhases();
          }}
        />
      )}

      {/* Task modal */}
      {taskModal && (
        <CreateTaskModal
          phaseId={taskModal.phaseId}
          sprintId={taskModal.sprintId}
          productId={productIdMap[productId] ?? productId}
          onClose={() => setTaskModal(null)}
          onCreated={() => {
            setTaskModal(null);
            loadPhases();
          }}
        />
      )}
    </div>
  );
}
