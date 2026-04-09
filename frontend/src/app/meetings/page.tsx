"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Meeting, Product, MeetingType } from "@/lib/types";
import { PRODUCT_FILTER_KEY } from "@/components/NavBar";
import {
  MEETING_STATUS_LABELS,
  MEETING_STATUS_COLORS,
  MEETING_TYPE_LABELS,
} from "@/lib/constants";

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "upcoming", label: "Sắp tới" },
  { value: "in_progress", label: "Đang diễn ra" },
  { value: "done", label: "Đã xong" },
];

const MEETING_TYPES: MeetingType[] = [
  "weekly_review",
  "sprint_planning",
  "incident",
  "stakeholder",
  "other",
];

function MeetingCard({ m }: { m: Meeting }) {
  return (
    <Link
      href={`/meetings/${m.id}`}
      className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-red-200 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {m.product_name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                {m.product_name}
              </span>
            )}
            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">
              {MEETING_TYPE_LABELS[m.meeting_type] ?? m.meeting_type}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                MEETING_STATUS_COLORS[m.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {MEETING_STATUS_LABELS[m.status] ?? m.status}
            </span>
          </div>
          <p className="text-sm font-medium text-gray-800">{m.name}</p>
          <p className="text-xs text-gray-400 mt-1">
            {new Date(m.scheduled_at).toLocaleString("vi-VN", {
              dateStyle: "short",
              timeStyle: "short",
            })}{" "}
            · {m.participants?.length ?? 0} người tham dự
          </p>
        </div>
      </div>
    </Link>
  );
}

function CreateMeetingModal({
  onClose,
  onCreated,
  products,
}: {
  onClose: () => void;
  onCreated: (m: Meeting) => void;
  products: Product[];
}) {
  const [form, setForm] = useState({
    product_id: products[0]?.id ?? "",
    name: "",
    meeting_type: "weekly_review" as MeetingType,
    scheduled_at: "",
    participants: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const participants = form.participants
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const m = await api.meetings.create({ ...form, participants });
      onCreated(m as Meeting);
    } catch (err: any) {
      setError(err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
        <h3 className="font-semibold text-gray-900 mb-4">Tạo meeting mới</h3>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Sản phẩm</label>
            <select
              value={form.product_id}
              onChange={(e) => setForm({ ...form, product_id: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Tên meeting</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
              placeholder="Tên meeting..."
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Loại</label>
            <select
              value={form.meeting_type}
              onChange={(e) => setForm({ ...form, meeting_type: e.target.value as MeetingType })}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            >
              {MEETING_TYPES.map((t) => (
                <option key={t} value={t}>{MEETING_TYPE_LABELS[t]}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Thời gian</label>
            <input
              type="datetime-local"
              value={form.scheduled_at}
              onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })}
              required
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              Người tham dự (phân cách bằng dấu phẩy)
            </label>
            <input
              type="text"
              value={form.participants}
              onChange={(e) => setForm({ ...form, participants: e.target.value })}
              placeholder="Alice, Bob, Carol"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
            />
          </div>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}
          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 bg-red-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
            >
              {submitting ? "Đang tạo..." : "Tạo meeting"}
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

export default function MeetingsPage() {
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [productId, setProductId] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);

  const load = useCallback((pid: string, status: string) => {
    setLoading(true);
    api.meetings
      .list({ product_id: pid || undefined, status: status || undefined })
      .then((r) => setMeetings(r as Meeting[]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    api.products.list().then((r) => setProducts(r as Product[]));
    const pid = localStorage.getItem(PRODUCT_FILTER_KEY) || "";
    setProductId(pid);
    load(pid, "");

    function onStorage(e: StorageEvent) {
      if (e.key === PRODUCT_FILTER_KEY) {
        const newPid = e.newValue || "";
        setProductId(newPid);
        load(newPid, statusFilter);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  function handleStatusChange(s: string) {
    setStatusFilter(s);
    load(productId, s);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Meetings</h1>
        <button
          onClick={() => setShowModal(true)}
          className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
        >
          + Tạo meeting
        </button>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit flex-wrap">
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

      {loading ? (
        <div className="text-center py-16 text-gray-400">Đang tải...</div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Chưa có meeting nào.</div>
      ) : (
        <div className="space-y-3">
          {meetings.map((m) => (
            <MeetingCard key={m.id} m={m} />
          ))}
        </div>
      )}

      {showModal && (
        <CreateMeetingModal
          products={products}
          onClose={() => setShowModal(false)}
          onCreated={(m) => {
            setMeetings((prev) => [m, ...prev]);
            setShowModal(false);
          }}
        />
      )}
    </div>
  );
}
