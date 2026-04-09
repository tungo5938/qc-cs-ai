"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { DashboardData } from "@/lib/types";
import { PRODUCT_FILTER_KEY } from "@/components/NavBar";
import { FEEDBACK_STATUS_COLORS, FEEDBACK_STATUS_LABELS } from "@/lib/constants";

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Chào buổi sáng, PM!";
  if (hour < 18) return "Chào buổi chiều, PM!";
  return "Chào buổi tối, PM!";
}

function formatDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function MetricCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${color}`}>{value}</p>
    </div>
  );
}

function ProgressBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(Math.max(value, 0), 100);
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-700">{label}</span>
        <span className="font-medium text-gray-900">{pct.toFixed(1)}%</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback((productId: string) => {
    setLoading(true);
    setError(null);
    api.dashboard
      .get(productId || undefined)
      .then((d) => setData(d as DashboardData))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const productId = localStorage.getItem(PRODUCT_FILTER_KEY) || "";
    load(productId);

    function onStorage(e: StorageEvent) {
      if (e.key === PRODUCT_FILTER_KEY) load(e.newValue || "");
    }
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [load]);

  if (loading)
    return (
      <div className="flex items-center justify-center py-24 text-gray-400">
        Đang tải...
      </div>
    );

  if (error)
    return (
      <div className="rounded-xl bg-red-50 border border-red-200 p-6 text-red-700">
        Lỗi tải dữ liệu: {error}
      </div>
    );

  const d = data!;
  const kpis = d.kpis ?? { cs_ai_automation: 0, cs_chat_uptime: 0, voice_ai_accuracy: 0 };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">{getGreeting()}</h1>
        <p className="text-gray-500 mt-0.5">{formatDate(new Date())}</p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard
          label="Feedback chờ xử lý"
          value={d.pending_feedbacks ?? 0}
          color="text-blue-600"
        />
        <MetricCard
          label="Action items quá hạn"
          value={d.overdue_actions ?? 0}
          color="text-red-600"
        />
        <MetricCard
          label="Solutions chờ duyệt"
          value={d.pending_solutions ?? 0}
          color="text-yellow-600"
        />
        <MetricCard
          label="Meeting hôm nay"
          value={d.meetings_today ?? 0}
          color="text-green-600"
        />
      </div>

      {/* Widgets */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Overdue actions */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Action items quá hạn</h2>
            <Link href="/actions" className="text-xs text-red-600 hover:underline">
              Xem tất cả
            </Link>
          </div>
          {(d.overdue_action_items ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Không có action item quá hạn.</p>
          ) : (
            <ul className="space-y-2">
              {(d.overdue_action_items ?? []).slice(0, 3).map((item) => (
                <li key={item.id}>
                  <Link
                    href="/actions"
                    className="block px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    <p className="text-sm font-medium text-gray-800 truncate">{item.title}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {item.assignee} ·{" "}
                      {item.deadline
                        ? new Date(item.deadline).toLocaleDateString("vi-VN")
                        : "Không có deadline"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Recent feedbacks */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Feedback mới từ Telegram</h2>
            <Link href="/feedback" className="text-xs text-red-600 hover:underline">
              Xem tất cả
            </Link>
          </div>
          {(d.recent_feedbacks ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Chưa có feedback mới.</p>
          ) : (
            <ul className="space-y-2">
              {(d.recent_feedbacks ?? []).slice(0, 3).map((fb) => (
                <li key={fb.id}>
                  <Link
                    href={`/feedback/${fb.id}`}
                    className="block px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          FEEDBACK_STATUS_COLORS[fb.status] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {FEEDBACK_STATUS_LABELS[fb.status] ?? fb.status}
                      </span>
                      {fb.product_name && (
                        <span className="text-xs text-gray-400">{fb.product_name}</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-700 truncate">{fb.raw_content}</p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Today's meetings */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">Meeting hôm nay</h2>
            <Link href="/meetings" className="text-xs text-red-600 hover:underline">
              Xem tất cả
            </Link>
          </div>
          {(d.todays_meetings ?? []).length === 0 ? (
            <p className="text-sm text-gray-400">Không có meeting nào hôm nay.</p>
          ) : (
            <ul className="space-y-2">
              {(d.todays_meetings ?? []).map((m) => (
                <li key={m.id}>
                  <Link
                    href={`/meetings/${m.id}`}
                    className="block px-3 py-2 rounded-lg hover:bg-gray-50 transition"
                  >
                    <p className="text-sm font-medium text-gray-800">{m.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(m.scheduled_at).toLocaleTimeString("vi-VN", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}{" "}
                      · {m.product_name ?? ""}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* KPIs */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
          <h2 className="font-semibold text-gray-900 mb-4">Metabase KPIs</h2>
          <div className="space-y-4">
            <ProgressBar label="CS AI — Tỷ lệ tự động hoá" value={kpis.cs_ai_automation} />
            <ProgressBar label="CS Chat — Uptime" value={kpis.cs_chat_uptime} />
            <ProgressBar label="Voice AI — Độ chính xác" value={kpis.voice_ai_accuracy} />
          </div>
        </div>
      </div>
    </div>
  );
}
