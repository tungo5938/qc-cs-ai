from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from core.dependencies import get_current_role, require_pm_qc
from models.issue import Issue, IssueStatus, IssueSource
from models.vote import Vote, VoteType
from models.jira_link import JiraLink
from models.base import gen_uuid
from schemas.issue import IssuePublic, IssueInternal, IssueCreate, IssueUpdate, VoteRequest, JiraLinkRequest
from services import jira_service, kb_service

router = APIRouter(prefix="/issues", tags=["issues"])


def _enrich(issue: Issue, vote_count: int, role: str) -> dict:
    base = IssuePublic.model_validate(issue).model_dump()
    base["vote_count"] = vote_count
    if role == "pm_qc":
        internal = IssueInternal.model_validate(issue).model_dump()
        internal["vote_count"] = vote_count
        return internal
    return base


@router.get("")
async def list_issues(
    db: AsyncSession = Depends(get_db),
    role: str = Depends(get_current_role),
):
    query = select(Issue).options(selectinload(Issue.jira_link), selectinload(Issue.votes))
    if role != "pm_qc":
        query = query.where(Issue.is_public == True)
    query = query.order_by(Issue.created_at.desc())
    result = await db.execute(query)
    issues = result.scalars().all()
    return [_enrich(i, len(i.votes), role) for i in issues]


@router.post("", status_code=201)
async def create_issue(
    body: IssueCreate,
    db: AsyncSession = Depends(get_db),
):
    issue = Issue(
        id=gen_uuid(),
        title=body.title,
        description=body.description,
        type=body.type,
        source=IssueSource.portal,
        submitted_by_email=body.submitted_by_email,
        media_urls=body.media_urls,
        is_public=False,
        status=IssueStatus.pending_review,
    )
    db.add(issue)
    await db.flush()
    return {"id": issue.id, "status": issue.status}


@router.get("/{issue_id}")
async def get_issue(
    issue_id: str,
    db: AsyncSession = Depends(get_db),
    role: str = Depends(get_current_role),
):
    result = await db.execute(
        select(Issue)
        .options(selectinload(Issue.jira_link), selectinload(Issue.votes))
        .where(Issue.id == issue_id)
    )
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(404, "Issue not found")
    if not issue.is_public and role != "pm_qc":
        raise HTTPException(404, "Issue not found")
    return _enrich(issue, len(issue.votes), role)


@router.patch("/{issue_id}")
async def update_issue(
    issue_id: str,
    body: IssueUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(404, "Issue not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(issue, field, val)
    await db.flush()
    return {"ok": True}


@router.post("/{issue_id}/approve")
async def approve_issue(
    issue_id: str,
    x_user_email: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(404, "Issue not found")
    issue.is_public = True
    issue.status = IssueStatus.approved
    issue.approved_by_email = x_user_email
    await db.flush()
    return {"ok": True}


@router.post("/{issue_id}/reject")
async def reject_issue(
    issue_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(404, "Issue not found")
    issue.status = IssueStatus.rejected
    await db.flush()
    return {"ok": True}


@router.post("/{issue_id}/vote")
async def vote_issue(
    issue_id: str,
    body: VoteRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Issue).where(Issue.id == issue_id, Issue.is_public == True))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(404, "Issue not found")

    existing = await db.execute(
        select(Vote).where(Vote.issue_id == issue_id, Vote.voter_email == body.voter_email)
    )
    vote = existing.scalar_one_or_none()
    if vote:
        vote.vote_type = VoteType(body.vote_type)
    else:
        db.add(Vote(id=gen_uuid(), issue_id=issue_id, voter_email=body.voter_email, vote_type=VoteType(body.vote_type)))
    await db.flush()

    count = await db.scalar(select(func.count()).where(Vote.issue_id == issue_id, Vote.vote_type == VoteType.up))
    return {"upvotes": count}


@router.post("/{issue_id}/jira-link")
async def link_jira(
    issue_id: str,
    body: JiraLinkRequest,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Issue).where(Issue.id == issue_id))
    issue = result.scalar_one_or_none()
    if not issue:
        raise HTTPException(404, "Issue not found")

    ticket_key = jira_service.extract_ticket_key(body.jira_url)
    if not ticket_key:
        raise HTTPException(400, "Cannot extract Jira ticket key from URL")

    # Upsert jira link
    existing_link = await db.execute(select(JiraLink).where(JiraLink.issue_id == issue_id))
    link = existing_link.scalar_one_or_none()

    ticket_data = await jira_service.fetch_ticket(ticket_key)

    if link:
        link.jira_url = body.jira_url
        link.jira_ticket_key = ticket_key
        if ticket_data:
            link.jira_status = ticket_data["status"]
            link.jira_summary = ticket_data["summary"]
            link.jira_description = ticket_data["description"]
    else:
        link = JiraLink(
            id=gen_uuid(),
            issue_id=issue_id,
            jira_url=body.jira_url,
            jira_ticket_key=ticket_key,
            jira_status=ticket_data["status"] if ticket_data else None,
            jira_summary=ticket_data["summary"] if ticket_data else None,
            jira_description=ticket_data["description"] if ticket_data else None,
        )
        db.add(link)

    # Append to KB
    if ticket_data:
        await kb_service.append_from_jira(db, ticket_data)

    await db.flush()
    return {"jira_ticket_key": ticket_key, "jira_status": link.jira_status}
