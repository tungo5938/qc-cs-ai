"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import { PRIORITY_COLORS, PRIORITY_LABELS, TYPE_LABELS, TEAM_LABELS, TEAM_COLORS, SOURCE_LABELS } from "@/lib/constants";
import clsx from "clsx";
import { Check, X, ChevronDown, ChevronUp } from "lucide-react";

export default function AdminQueuePage() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [teamFilter, setTeamFilter] = useState<string>("all");

  const load = () =>
    api.issues.list().then((all) => {
      setIssues(all.filter((i: Issue) => i.status === "pending_review"));
      setLoading(false);
    });

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    await api.issues.approve(id);
    setIssues((prev) => prev.filter((i) => i.id !== id));
  };

  const reject = async (id: string) => {
    await api.issues.reject(id);
    setIssues((prev) => prev.filter((i) => i.id !== id));
  };

  const teams = ["all", "cs_b2c", "cs_c2c", "telesales", "unknown"];
  const filtered = teamFilter === "all" ? issues : issues.filter((i) => i.team === teamFilter);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Hàng đợi phê duyệt</h1>
        <span className="text-sm text-gray-500">{filtered.length} đang chờ</span>
      </div>

      {/* Team filter */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
        {teams.map((t) => (
          <button
            key={t}
            onClick={() => setTeamFilter(t)}
            className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
              teamFilter === t ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t === "all" ? "Tất cả team" : TEAM_LABELS[t]}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Đang tải...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-gray-400">Không có vấn đề nào đang chờ duyệt.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((issue) => (
            <div key={issue.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap gap-2 mb-1">
                    <span className="text-xs text-gray-500">{TYPE_LABELS[issue.type]}</span>
                    <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[issue.priority])}>
                      {PRIORITY_LABELS[issue.priority] ?? issue.priority}
                    </span>
                    {issue.team && (
                      <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", TEAM_COLORS[issue.team])}>
                        {TEAM_LABELS[issue.team]}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{SOURCE_LABELS[issue.source] ?? issue.source}</span>
                  </div>
                  <h3 className="font-medium text-gray-900">{issue.title}</h3>
                  <p className="text-sm text-gray-500 mt-0.5 truncate">{issue.description}</p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => setExpanded(expanded === issue.id ? null : issue.id)}
                    className="p-1.5 text-gray-400 hover:text-gray-600 transition"
                  >
                    {expanded === issue.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  <button
                    onClick={() => reject(issue.id)}
                    className="p-1.5 rounded-lg border border-gray-200 text-red-500 hover:bg-red-50 transition"
                    title="Từ chối"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => approve(issue.id)}
                    className="p-1.5 rounded-lg border border-gray-200 text-green-600 hover:bg-green-50 transition"
                    title="Phê duyệt"
                  >
                    <Check className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {expanded === issue.id && (
                <div className="px-4 pb-4 pt-0 border-t border-gray-100 bg-gray-50 space-y-3">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{issue.description}</p>
                  {issue.root_cause && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-yellow-800 mb-1">🤖 Gợi ý nguyên nhân từ AI</p>
                      <p className="text-sm text-yellow-700 whitespace-pre-wrap">{issue.root_cause}</p>
                    </div>
                  )}
                  {issue.ai_classification_raw && (issue.ai_classification_raw as any).kb_references?.length > 0 && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <p className="text-xs font-semibold text-blue-800 mb-1">📚 KB liên quan</p>
                      <ul className="text-sm text-blue-700 list-disc list-inside space-y-0.5">
                        {((issue.ai_classification_raw as any).kb_references as string[]).map((ref, i) => (
                          <li key={i}>{ref}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {issue.media_urls?.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {issue.media_urls.map((url, i) =>
                        url.includes("/video/") ? (
                          <video key={i} src={url} controls className="rounded h-32" />
                        ) : (
                          <img key={i} src={url} alt="" className="rounded h-32 object-contain" />
                        )
                      )}
                    </div>
                  )}
                  {issue.submitted_by_email && (
                    <p className="text-xs text-gray-400">Gửi bởi: {issue.submitted_by_email}</p>
                  )}
                  <a href={`/admin/issues/${issue.id}`} className="text-xs text-red-600 hover:underline">
                    Xem chi tiết nội bộ →
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
