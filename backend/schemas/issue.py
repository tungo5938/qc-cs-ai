from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models.issue import IssueType, IssueStatus, IssuePriority, IssueSource, TeamType


class JiraLinkOut(BaseModel):
    id: str
    jira_url: str
    jira_ticket_key: str
    jira_status: Optional[str]
    jira_summary: Optional[str]

    class Config:
        from_attributes = True


class IssuePublic(BaseModel):
    id: str
    type: IssueType
    title: str
    description: str
    status: IssueStatus
    priority: IssuePriority
    source: IssueSource
    team: TeamType
    media_urls: list
    is_public: bool
    jira_link: Optional[JiraLinkOut] = None
    # Scoring
    user_rating: Optional[float] = None
    po_rating: Optional[float] = None
    tech_effort: Optional[int] = None
    csat_score: Optional[float] = None
    composite_score: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IssueInternal(IssuePublic):
    root_cause: Optional[str] = None
    submitted_by_email: Optional[str] = None
    approved_by_email: Optional[str] = None
    user_rating_by: Optional[str] = None
    po_rating_by: Optional[str] = None
    effort_set_by: Optional[str] = None
    telegram_group_id: Optional[int] = None
    ai_classification_raw: Optional[dict] = None


class IssueCreate(BaseModel):
    title: str
    description: str
    type: IssueType = IssueType.unclear
    team: TeamType = TeamType.unknown
    media_urls: list[str] = []
    submitted_by_email: str


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[IssueType] = None
    priority: Optional[IssuePriority] = None
    team: Optional[TeamType] = None
    root_cause: Optional[str] = None
    status: Optional[IssueStatus] = None


class VoteRequest(BaseModel):
    voter_email: str
    vote_type: str  # "up" | "down"


class JiraLinkRequest(BaseModel):
    jira_url: str
