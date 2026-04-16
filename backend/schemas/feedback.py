from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FeedbackAnalysisOut(BaseModel):
    id: str
    feedback_id: str
    root_cause: Optional[str] = None
    impact_level: Optional[str] = None
    affected_area: Optional[str] = None
    kb_references: Optional[list] = None
    solution_hint: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    ai_raw: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackOut(BaseModel):
    id: str
    product_id: str
    product_name: Optional[str] = None
    title: Optional[str] = None
    raw_content: str
    media_urls: Optional[list] = None
    submitted_by: Optional[str] = None
    source: str
    status: str
    telegram_message_id: Optional[str] = None
    telegram_group_id: Optional[str] = None
    gsheet_row_index: Optional[int] = None
    feedback_type: Optional[str] = None
    user_priority: Optional[int] = None
    tu_danh_gia: Optional[int] = None
    tech_rating: Optional[int] = None
    priority_score: Optional[float] = None
    solution_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    analysis: Optional[FeedbackAnalysisOut] = None

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    product_id: str
    raw_content: str
    media_urls: Optional[list] = None
    submitted_by: Optional[str] = None


class FeedbackUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    raw_content: Optional[str] = None


class AnalysisUpdate(BaseModel):
    root_cause: Optional[str] = None
    solution_hint: Optional[str] = None


class CreateJiraBody(BaseModel):
    title: str
    raw_content: str
    root_cause: Optional[str] = None
    solution_hint: Optional[str] = None
    acceptance_criteria: str
    sprint_name: Optional[str] = None
    upload_attachments: bool = True
