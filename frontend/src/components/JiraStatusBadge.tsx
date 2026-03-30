import { JiraLink } from "@/lib/types";
import { ExternalLink } from "lucide-react";

export default function JiraStatusBadge({ jiraLink }: { jiraLink: JiraLink | null }) {
  if (!jiraLink) return null;
  return (
    <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-sm">
      <span className="font-medium text-blue-800">{jiraLink.jira_ticket_key}</span>
      {jiraLink.jira_status && (
        <span className="text-blue-600">· {jiraLink.jira_status}</span>
      )}
      {jiraLink.jira_summary && (
        <span className="text-gray-500 truncate max-w-[200px]">{jiraLink.jira_summary}</span>
      )}
      <a href={jiraLink.jira_url} target="_blank" rel="noopener noreferrer" className="ml-auto text-blue-500 hover:text-blue-700">
        <ExternalLink className="w-4 h-4" />
      </a>
    </div>
  );
}
