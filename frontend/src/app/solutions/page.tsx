// @ts-nocheck
"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { SolutionDraft } from "@/lib/types";
import { PRODUCT_FILTER_KEY } from "@/components/NavBar";
import {
  SOLUTION_STATUS_LABELS,
  SOLUTION_STATUS_COLORS,
  EFFORT_LABELS,
  EFFORT_COLORS,
} from "@/lib/constants";

const STATUS_TABS = [
  { value: "", label: "Tất cả" },
  { value: "draft", label: "Draft" },
  { value: "approved", label: "Approved" },
  { value: "rejected", label: "Rejected" },
];

function SolutionCard({ sol }: { sol: SolutionDraft }) {
  return (
    <Link
      href={`/solutions/${sol.id}`}
      className="block bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:border-red-200 hover:shadow-md transition"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {sol.product_name && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 font-medium">
                {sol.product_name}
              </span>
            )}
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                EFFORT_COLORS[sol.effort] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {sol.effort} — {EFFORT_LABELS[sol.effort] ?? sol.effort}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                SOLUTION_STATUS_COLORS[sol.status] ?? "bg-gray-100 text-gray-600"
              }`}
            >
              {SOLUTION_STATUS_LABELS[sol.status] ?? sol.status}
            </span>
          </div>
          <p className="text-sm text-gray-800 line-clamp-2">{sol.problem_statement}</p>
        </div>
        <span className="text-xs text-gray-400 shrink-0">
          {new Date(sol.created_at).toLocaleDateString("vi-VN")}
        </span>
      </div>
    </Link>
  );
}

export default function SolutionsPage() {
  const [solutions, setSolutions] = useState<SolutionDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [productId, setProductId] = useState("");

  const load = useCallback((pid: string, status: string) => {
    setLoading(true);
    api.solutions
      .list({ product_id: pid || undefined, status: status || undefined })
      .then((r) => setSolutions(r as SolutionDraft[]))
      .finally(() => setLoading(false));
  }, []);

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
      <h1 className="text-2xl font-bold text-gray-900">Solutions</h1>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
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
      ) : solutions.length === 0 ? (
        <div className="text-center py-16 text-gray-400">Chưa có solution nào.</div>
      ) : (
        <div className="space-y-3">
          {solutions.map((sol) => (
            <SolutionCard key={sol.id} sol={sol} />
          ))}
        </div>
      )}
    </div>
  );
}
