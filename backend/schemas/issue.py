from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime
from models.issue import IssueType, IssueStatus, IssuePriority, IssueSource


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
    media_urls: list
    is_public: bool
    vote_count: int = 0
    jira_link: Optional[JiraLinkOut] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class IssueInternal(IssuePublic):
    root_cause: Optional[str] = None
    submitted_by_email: Optional[str] = None
    approved_by_email: Optional[str] = None
    telegram_group_id: Optional[int] = None
    ai_classification_raw: Optional[dict] = None


class IssueCreate(BaseModel):
    title: str
    description: str
    type: IssueType = IssueType.unclear
    media_urls: list[str] = []
    submitted_by_email: str


class IssueUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    type: Optional[IssueType] = None
    priority: Optional[IssuePriority] = None
    root_cause: Optional[str] = None
    status: Optional[IssueStatus] = None


class VoteRequest(BaseModel):
    voter_email: str
    vote_type: str  # "up" | "down"


class JiraLinkRequest(BaseModel):
    jira_url: str
