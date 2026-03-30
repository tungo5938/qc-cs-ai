"use client";
import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { Issue } from "@/lib/types";
import JiraStatusBadge from "@/components/JiraStatusBadge";
import { PRIORITY_COLORS, STATUS_COLORS, TYPE_LABELS } from "@/lib/constants";
import clsx from "clsx";

export default function AdminIssueDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [issue, setIssue] = useState<Issue | null>(null);
  const [rootCause, setRootCause] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.issues.get(id).then((i) => {
      setIssue(i);
      setRootCause(i.root_cause || "");
    });
  }, [id]);

  const saveRootCause = async () => {
    if (!issue) return;
    setSaving(true);
    await api.issues.update(id, { root_cause: rootCause });
    setSaving(false);
  };

  if (!issue) return <div className="text-center py-12 text-gray-400">Loading...</div>;

  return (
    <div className="max-w-3xl space-y-6">
      <a href="/admin" className="text-sm text-gray-500 hover:text-gray-700">← Back to Queue</a>

      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
        <div className="flex flex-wrap gap-2">
          <span className="text-sm">{TYPE_LABELS[issue.type]}</span>
          <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[issue.priority])}>{issue.priority}</span>
          <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[issue.status])}>{issue.status.replace("_", " ")}</span>
          <span className="text-xs text-gray-400 ml-auto">ID: {issue.id.slice(0, 8)}</span>
        </div>

        <h1 className="text-xl font-bold text-gray-900">{issue.title}</h1>
        <p className="text-gray-600 whitespace-pre-wrap">{issue.description}</p>

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

        <div className="text-xs text-gray-400 space-y-0.5">
          {issue.submitted_by_email && <p>Submitted by: {issue.submitted_by_email}</p>}
          {issue.approved_by_email && <p>Approved by: {issue.approved_by_email}</p>}
          <p>Source: {issue.source} · Created: {new Date(issue.created_at).toLocaleString()}</p>
        </div>
      </div>

      {/* Root Cause (internal only) */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Root Cause Analysis</h2>
        {issue.ai_classification_raw && (
          <div className="bg-gray-50 rounded-lg p-3 text-xs text-gray-500 font-mono overflow-auto max-h-32">
            {JSON.stringify(issue.ai_classification_raw, null, 2).slice(0, 400)}
          </div>
        )}
        <textarea
          value={rootCause}
          onChange={(e) => setRootCause(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500 h-28 resize-none"
          placeholder="Document root cause here (internal only, not visible to users)..."
        />
        <button
          onClick={saveRootCause}
          disabled={saving}
          className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition"
        >
          {saving ? "Saving..." : "Save Root Cause"}
        </button>
      </div>

      {/* Jira */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-3">
        <h2 className="font-semibold text-gray-900">Jira Ticket</h2>
        <JiraStatusBadge jiraLink={issue.jira_link} />
      </div>
    </div>
  );
}
