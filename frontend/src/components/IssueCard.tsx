"use client";
import Link from "next/link";
import { Issue } from "@/lib/types";
import { PRIORITY_COLORS, STATUS_COLORS, TYPE_LABELS } from "@/lib/constants";
import { ThumbsUp, ExternalLink } from "lucide-react";
import clsx from "clsx";

interface Props {
  issue: Issue;
  onVote?: (id: string) => void;
  showVote?: boolean;
}

export default function IssueCard({ issue, onVote, showVote = true }: Props) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-300 transition">
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap gap-2 mb-2">
            <span className="text-xs font-medium text-gray-500">{TYPE_LABELS[issue.type]}</span>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", PRIORITY_COLORS[issue.priority])}>
              {issue.priority}
            </span>
            <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", STATUS_COLORS[issue.status])}>
              {issue.status.replace("_", " ")}
            </span>
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
        {showVote && (
          <button
            onClick={() => onVote?.(issue.id)}
            className="flex flex-col items-center gap-1 px-3 py-2 rounded-lg border border-gray-200 hover:border-red-300 hover:bg-red-50 transition min-w-[52px]"
          >
            <ThumbsUp className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-semibold text-gray-700">{issue.vote_count}</span>
          </button>
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
