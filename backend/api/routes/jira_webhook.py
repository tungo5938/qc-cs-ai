import hmac
import hashlib
from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.config import get_settings, Settings
from models.jira_link import JiraLink
from models.issue import Issue, IssueStatus
from worker.jira_notifier import notify_done

router = APIRouter(prefix="/jira", tags=["jira"])


@router.post("/webhook")
async def jira_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    settings: Settings = Depends(get_settings),
):
    # Verify webhook secret if configured
    if settings.jira_webhook_secret:
        secret_header = request.headers.get("X-Hub-Signature-256") or request.headers.get("X-Atlassian-Webhook-Identifier")
        body = await request.body()
        expected = hmac.new(settings.jira_webhook_secret.encode(), body, hashlib.sha256).hexdigest()
        sig = request.headers.get("X-Hub-Signature-256", "")
        if sig and not hmac.compare_digest(f"sha256={expected}", sig):
            raise HTTPException(403, "Invalid webhook signature")
    else:
        body = await request.body()

    payload = await request.json() if not body else __import__("json").loads(body)

    issue_data = payload.get("issue", {})
    ticket_key = issue_data.get("key")
    new_status = issue_data.get("fields", {}).get("status", {}).get("name", "")

    if not ticket_key:
        return {"ok": True}

    # Update jira_links
    result = await db.execute(select(JiraLink).where(JiraLink.jira_ticket_key == ticket_key))
    link = result.scalar_one_or_none()
    if not link:
        return {"ok": True}

    old_status = link.jira_status
    link.jira_status = new_status

    # Sync issue status
    issue_result = await db.execute(select(Issue).where(Issue.id == link.issue_id))
    issue = issue_result.scalar_one_or_none()

    if new_status.lower() == "done" and old_status and old_status.lower() != "done":
        if issue:
            issue.status = IssueStatus.done
        await db.commit()
        await notify_done(issue, link, settings)
    else:
        if issue and new_status.lower() == "in progress":
            issue.status = IssueStatus.in_progress
        await db.commit()

    return {"ok": True}
