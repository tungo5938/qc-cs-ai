"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import IssueCard from "@/components/IssueCard";
import EmailGate from "@/components/EmailGate";
import { TYPE_LABELS, TEAM_LABELS } from "@/lib/constants";

type FilterType = "all" | "bug" | "feature_request";
type SortType = "score" | "newest";
type FilterTeam = "all" | "cs_b2c" | "cs_c2c" | "telesales";

export default function Home() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("score");
  const [teamFilter, setTeamFilter] = useState<FilterTeam>("all");

  useEffect(() => {
    api.issues.list().then(setIssues).finally(() => setLoading(false));
  }, []);

  const filtered = issues
    .filter((i) => filter === "all" || i.type === filter)
    .filter((i) => teamFilter === "all" || i.team === teamFilter)
    .sort((a, b) =>
      sort === "score"
        ? (b.composite_score ?? 0) - (a.composite_score ?? 0)
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  const teams: FilterTeam[] = ["all", "cs_b2c", "cs_c2c", "telesales"];

  return (
    <EmailGate>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Phản hồi</h1>
          <span className="text-sm text-gray-500">{issues.length} mục</span>
        </div>

        <div className="flex flex-wrap gap-3">
          {/* Type filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["all", "bug", "feature_request"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                  filter === f ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f === "all" ? "Tất cả" : TYPE_LABELS[f]}
              </button>
            ))}
          </div>

          {/* Team filter */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
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

          {/* Sort */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
            {(["score", "newest"] as SortType[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                  sort === s ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "score" ? "Điểm cao nhất" : "Mới nhất"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Đang tải...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">Chưa có vấn đề nào.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue) => (
              <IssueCard key={issue.id} issue={issue} />
            ))}
          </div>
        )}
      </div>
    </EmailGate>
  );
}
