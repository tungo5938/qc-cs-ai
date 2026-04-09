"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { ActionItem } from "@/lib/types";
import { PRODUCT_FILTER_KEY } from "@/components/NavBar";
import { ACTION_STATUS_LABELS, ACTION_STATUS_COLORS } from "@/lib/constants";

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "todo", label: "Chưa làm" },
  { value: "in_progress", label: "Đang làm" },
  { value: "done", label: "Xong" },
  { value: "cancelled", label: "Hủy" },
];

function isOverdue(item: ActionItem): boolean {
  if (!item.deadline) return false;
  if (item.status === "done" || item.status === "cancelled") return false;
  return new Date(item.deadline) < new Date();
}

function MetricCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`text-2xl font-bold mt-0.5 ${color}`}>{value}</p>
    </div>
  );
}

function CreateActionModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (item: ActionItem) => void;
}) {
  const [form, setForm] = useState({
    title: "",
    assignee: "",
    deadline: "",
    product_id: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const item = await api.actionItems.create({
        ...form,
        deadline: form.deadline || null,
        product_id: form.product_id || undefined,
      });
      onCreated(item as ActionItem);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-gray-900 mb-4">Thêm action item thủ công</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tiêu đề</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
              placeholder="Tiêu đề action item..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Người phụ trách</label>
            <input
              type="text"
              value={form.assignee}
              onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              required
              placeholder="Tên người phụ trách"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Deadline (tùy chọn)
            </label>
            <input
              type="date"
              value={form.deadline}
              onChange={(e) => setForm({ ...form, deadline: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Đang tạo..." : "Tạo"}
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

export default function ActionsPage() {
  const [items, setItems] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [assigneeSearch, setAssigneeSearch] = useState("");
  const [productId, setProductId] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);

  const load = useCallback((pid: string, status: string, assignee: string) => {
    setLoading(true);
    api.actionItems
      .list({
        product_id: pid || undefined,
        status: status || undefined,
        assignee: assignee || undefined,
      })
      .then((r) => setItems(r as ActionItem[]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const pid = localStorage.getItem(PRODUCT_FILTER_KEY) || "";
    setProductId(pid);
    load(pid, "", "");

    function onStorage(e: StorageEvent) {
      if (e.key === PRODUCT_FILTER_KEY) {
        const newPid = e.newValue || "";
        setProductId(newPid);
        load(newPid, statusFilter, assigneeSearch);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  function handleStatusChange(s: string) {
    setStatusFilter(s);
    load(productId, s, assigneeSearch);
  }

  function handleAssigneeSearch(val: string) {
    setAssigneeSearch(val);
    load(productId, statusFilter, val);
  }

  async function toggleDone(item: ActionItem) {
    const newStatus = item.status === "done" ? "todo" : "done";
    try {
      const updated = await api.actionItems.update(item.id, { status: newStatus });
      setItems((prev) => prev.map((i) => (i.id === item.id ? (updated as ActionItem) : i)));
    } catch (e: any) {
      console.error(e);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkMarkDone() {
    const ids = [...selected];
    try {
      await api.actionItems.bulk(ids, { status: "done" });
      setItems((prev) =>
        prev.map((i) => (ids.includes(i.id) ? { ...i, status: "done" as const } : i))
      );
      setSelected(new Set());
    } catch (e: any) {
      console.error(e);
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const nextWeek = new Date(today);
  nextWeek.setDate(nextWeek.getDate() + 7);

  const overdue = items.filter(isOverdue).length;
  const todayCount = items.filter(
    (i) =>
      i.deadline &&
      new Date(i.deadline) >= today &&
      new Date(i.deadline) < tomorrow &&
      i.status !== "done" &&
      i.status !== "cancelled"
  ).length;
  const thisWeek = items.filter(
    (i) =>
      i.deadline &&
      new Date(i.deadline) >= today &&
      new Date(i.deadline) < nextWeek &&
      i.status !== "done" &&
      i.status !== "cancelled"
  ).length;
  const doneCount = items.filter((i) => i.status === "done").length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Action Items</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
        >
          + Thêm thủ công
        </button>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label="Quá hạn" value={overdue} color="text-red-600" />
        <MetricCard label="Hôm nay" value={todayCount} color="text-orange-600" />
        <MetricCard label="Tuần này" value={thisWeek} color="text-blue-600" />
        <MetricCard label="Xong" value={doneCount} color="text-green-600" />
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => handleStatusChange(tab.value)}
              className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                statusFilter === tab.value
                  ? "bg-white shadow text-gray-900"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={assigneeSearch}
          onChange={(e) => handleAssigneeSearch(e.target.value)}
          placeholder="Tìm theo người phụ trách..."
          className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
        />
      </div>

      {/* Bulk actions */}
      {selected.size > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-4">
          <span className="text-sm text-red-700">Đã chọn {selected.size} mục</span>
          <button
            onClick={bulkMarkDone}
            className="bg-green-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:bg-green-700"
          >
            Đánh dấu xong
          </button>
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Bỏ chọn
          </button>
        </div>
      )}

      {loading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Chưa có action item nào.</div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const overdue = isOverdue(item);
            return (
              <div
                key={item.id}
                className={`bg-white rounded-xl border shadow-sm p-4 flex items-start gap-3 ${
                  selected.has(item.id) ? "border-red-300 bg-red-50" : "border-gray-100"
                }`}
              >
                {/* Checkbox */}
                <input
                  type="checkbox"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                  className="mt-0.5 rounded border-gray-300 text-red-600 focus:ring-red-500"
                />
                {/* Done toggle */}
                <button
                  onClick={() => toggleDone(item)}
                  className={`mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0 transition ${
                    item.status === "done"
                      ? "bg-green-500 border-green-500"
                      : "border-gray-300 hover:border-green-400"
                  }`}
                  title={item.status === "done" ? "Đánh dấu chưa xong" : "Đánh dấu xong"}
                />
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm font-medium ${
                      item.status === "done" ? "line-through text-gray-400" : "text-gray-800"
                    }`}
                  >
                    {item.title}
                  </p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    {item.product_name && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {item.product_name}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{item.assignee}</span>
                    {item.deadline && (
                      <span
                        className={`text-xs font-medium ${
                          overdue ? "text-red-600" : "text-gray-400"
                        }`}
                      >
                        {overdue ? "Quá hạn: " : "Deadline: "}
                        {new Date(item.deadline).toLocaleDateString("vi-VN")}
                      </span>
                    )}
                    {item.meeting_id && item.meeting_name && (
                      <Link
                        href={`/meetings/${item.meeting_id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        {item.meeting_name}
                      </Link>
                    )}
                  </div>
                </div>
                <span
                  className={`text-xs px-2 py-0.5 rounded-full shrink-0 font-medium ${
                    ACTION_STATUS_COLORS[item.status] ?? "bg-gray-100 text-gray-600"
                  }`}
                >
                  {ACTION_STATUS_LABELS[item.status] ?? item.status}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {showModal && (
        <CreateActionModal
          onClose={() => setShowModal(false)}
          onCreated={(item) => {
            setItems((prev) => [item, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
