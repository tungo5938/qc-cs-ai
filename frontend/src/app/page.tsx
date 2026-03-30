"use client";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import IssueCard from "@/components/IssueCard";
import EmailGate from "@/components/EmailGate";
import { TYPE_LABELS } from "@/lib/constants";

type FilterType = "all" | "bug" | "feature_request";
type SortType = "votes" | "newest";

export default function Home() {
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("all");
  const [sort, setSort] = useState<SortType>("votes");

  useEffect(() => {
    api.issues.list().then(setIssues).finally(() => setLoading(false));
  }, []);

  const handleVote = async (id: string) => {
    const email = sessionStorage.getItem("qc_user_email");
    if (!email) return;
    const res = await api.issues.vote(id, "up", email);
    setIssues((prev) =>
      prev.map((i) => (i.id === id ? { ...i, vote_count: res.upvotes } : i))
    );
  };

  const filtered = issues
    .filter((i) => filter === "all" || i.type === filter)
    .sort((a, b) =>
      sort === "votes"
        ? b.vote_count - a.vote_count
        : new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

  return (
    <EmailGate>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">Feedback</h1>
          <span className="text-sm text-gray-500">{issues.length} items</span>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {(["all", "bug", "feature_request"] as FilterType[]).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                  filter === f ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {f === "all" ? "All" : TYPE_LABELS[f]}
              </button>
            ))}
          </div>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 ml-auto">
            {(["votes", "newest"] as SortType[]).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={`text-xs px-3 py-1.5 rounded-md font-medium transition ${
                  sort === s ? "bg-white shadow text-gray-900" : "text-gray-500 hover:text-gray-700"
                }`}
              >
                {s === "votes" ? "Top Voted" : "Newest"}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="text-center py-16 text-gray-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-400">No issues found.</div>
        ) : (
          <div className="space-y-3">
            {filtered.map((issue) => (
              <IssueCard key={issue.id} issue={issue} onVote={handleVote} />
            ))}
          </div>
        )}
      </div>
    </EmailGate>
  );
}
