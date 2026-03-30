"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import JiraStatusBadge from "@/components/JiraStatusBadge";
import EmailGate from "@/components/EmailGate";
import { PRIORITY_COLORS, STATUS_COLORS, TYPE_LABELS } from "@/lib/constants";
import { ThumbsUp, Link2 } from "lucide-react";
import clsx from "clsx";

export default function IssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [jiraInput, setJiraInput] = useState("");
  const [linking, setLinking] = useState(false);
  const [voted, setVoted] = useState(false);

  useEffect(() => {
    api.issues.get(id).then(setIssue);
  }, [id]);

  const handleVote = async () => {
    const email = sessionStorage.getItem("qc_user_email");
    if (!email || voted || !issue) return;
    const res = await api.issues.vote(id, "up", email);
    setIssue((i) => i ? { ...i, vote_count: res.upvotes } : i);
    setVoted(true);
  };

  const handleLinkJira = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jiraInput.trim()) return;
    setLinking(true);
    try {
      await api.issues.linkJira(id, jiraInput.trim());
      const updated = await api.issues.get(id);
      setIssue(updated);
      setJiraInput("");
    } finally {
      setLinking(false);
    }
  };

  if (!issue) return <div className="text-center py-16 text-gray-400">Loading...</div>;

  return (
    <EmailGate>
      <div className="max-w-3xl mx-auto space-y-6">
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700">← Back</a>

        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="text-sm text-gray-500">{TYPE_LABELS[issue.type]}</span>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[issue.priority])}>
              {issue.priority}
            </span>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[issue.status])}>
              {issue.status.replace("_", " ")}
            </span>
          </div>

          <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
          <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{issue.description}</p>

          {issue.media_urls?.length > 0 && (
            <div className="flex flex-wrap gap-3">
              {issue.media_urls.map((url, i) =>
                url.includes("/video/") ? (
                  <video key={i} src={url} controls className="rounded-lg max-h-48" />
                ) : (
                  <img key={i} src={url} alt="" className="rounded-lg max-h-48 object-contain" />
                )
              )}
            </div>
          )}

          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className="text-xs text-gray-400">
              {new Date(issue.created_at).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
            </span>
            <button
              onClick={handleVote}
              disabled={voted}
              className={clsx(
                "flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition",
                voted ? "bg-red-50 border-red-300 text-red-700" : "border-gray-200 hover:border-red-300 hover:bg-red-50"
              )}
            >
              <ThumbsUp className="w-4 h-4" />
              {issue.vote_count} {voted ? "Voted" : "Vote"}
            </button>
          </div>
        </div>

        {/* Jira section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <Link2 className="w-4 h-4" /> Jira Ticket
          </h2>
          {issue.jira_link ? (
            <JiraStatusBadge jiraLink={issue.jira_link} />
          ) : (
            <form onSubmit={handleLinkJira} className="flex gap-2">
              <input
                value={jiraInput}
                onChange={(e) => setJiraInput(e.target.value)}
                placeholder="Paste Jira URL (e.g. https://company.atlassian.net/browse/GHN-123)"
                className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
              <button
                type="submit"
                disabled={linking}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
              >
                {linking ? "Linking..." : "Link"}
              </button>
            </form>
          )}
        </div>
      </div>
    </EmailGate>
  );
}
