"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Feedback } from "@/lib/types";
import { PRODUCT_FILTER_KEY } from "@/components/NavBar";
import {
  FEEDBACK_STATUS_LABELS,
  FEEDBACK_STATUS_COLORS,
  FEEDBACK_SOURCE_LABELS,
  FEEDBACK_SOURCE_COLORS,
} from "@/lib/constants";

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "new", label: "Mới" },
  { value: "analyzing", label: "Đang phân tích" },
  { value: "analyzed", label: "Đã phân tích" },
  { value: "solution_drafted", label: "Đã tạo solution" },
];

function FeedbackCard({ fb }: { fb: Feedback }) {
  return (
    <Link
      href={`/feedback/${fb.id}`}
      className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-red-200 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {fb.product_name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                {fb.product_name}
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                FEEDBACK_SOURCE_COLORS[fb.source] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {FEEDBACK_SOURCE_LABELS[fb.source] ?? fb.source}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                FEEDBACK_STATUS_COLORS[fb.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {FEEDBACK_STATUS_LABELS[fb.status] ?? fb.status}
            </span>
          </div>
          <p className="text-sm text-gray-800 line-clamp-2">{fb.raw_content}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(fb.created_at).toLocaleDateString("vi-VN")}
        </span>
      </div>
    </Link>
  );
}

export default function FeedbackListPage() {
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [productId, setProductId] = useState<string>("");

  const load = useCallback(
    (pid: string, status: string) => {
      setLoading(true);
      api.feedbacks
        .list({ product_id: pid || undefined, status: status || undefined })
        .then((r) => setFeedbacks(r as Feedback[]))
        .finally(() => setLoading(false));
    },
    []
  );

  useEffect(() => {
    const pid = localStorage.getItem(PRODUCT_FILTER_KEY) || "";
    setProductId(pid);
    load(pid, statusFilter);

    function onStorage(e: StorageEvent) {
      if (e.key === PRODUCT_FILTER_KEY) {
        const newPid = e.newValue || "";
        setProductId(newPid);
        load(newPid, statusFilter);
      }
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load, statusFilter]);

  function handleStatusChange(s: string) {
    setStatusFilter(s);
    load(productId, s);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Phản hồi</h1>
        <Link
          href="/feedback/new"
          className="bg-red-600 text-white text-sm px-4 py-2 rounded-lg hover:bg-red-700 transition font-medium"
        >
          + Thêm manual
        </Link>
      </div>

      {/* Status filter tabs */}
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
      ) : feedbacks.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Chưa có feedback nào.</div>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((fb) => (
            <FeedbackCard key={fb.id} fb={fb} />
          ))}
        </div>
      )}
    </div>
  );
}
