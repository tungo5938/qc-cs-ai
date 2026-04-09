"use client";
import Link from "next/link";
import { Issue } from "@/lib/types";
import { PRIORITY_COLORS, STATUS_COLORS, TYPE_LABELS, TEAM_LABELS, TEAM_COLORS, PRIORITY_LABELS, STATUS_LABELS } from "@/lib/constants";
import { ExternalLink } from "lucide-react";
import clsx from "clsx";

interface Props {
  issue: Issue;
}

export default function IssueCard({ issue }: Props) {
  const score = issue.composite_score;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500">{TYPE_LABELS[issue.type]}</span>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[issue.priority])}>
              {PRIORITY_LABELS[issue.priority] ?? issue.priority}
            </span>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[issue.status])}>
              {STATUS_LABELS[issue.status] ?? issue.status}
            </span>
            {issue.team && issue.team !== "unknown" && (
              <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", TEAM_COLORS[issue.team])}>
                {TEAM_LABELS[issue.team]}
              </span>
            )}
            {issue.jira_link?.jira_status && (
              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-medium">
                Jira: {issue.jira_link.jira_status}
              </span>
            )}
          </div>
          <Link href={`/issues/${issue.id}`} className="block">
            <h3 className="font-semibold text-gray-900 hover:text-red-600 truncate">{issue.title}</h3>
            <p className="text-sm text-gray-500 mt-1 line-clamp-2">{issue.description}</p>
          </Link>
        </div>
        {score !== null && score !== undefined && (
          <div className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 min-w-[52px]">
            <span className="text-xs text-gray-400">Điểm</span>
            <span className="text-sm font-bold text-gray-800">{score.toFixed(1)}</span>
          </div>
        )}
      </div>
      {issue.jira_link && (
        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2">
          <a
            href={issue.jira_link.jira_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            <ExternalLink className="w-3 h-3" />
            {issue.jira_link.jira_ticket_key}
            {issue.jira_link.jira_summary ? ` — ${issue.jira_link.jira_summary.slice(0, 60)}` : ""}
          </a>
        </div>
      )}
    </div>
  );
}
