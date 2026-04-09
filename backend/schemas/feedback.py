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
    ai_raw: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackOut(BaseModel):
    id: str
    product_id: str
    raw_content: str
    media_urls: Optional[list] = None
    submitted_by: Optional[str] = None
    source: str
    status: str
    telegram_message_id: Optional[str] = None
    telegram_group_id: Optional[str] = None
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
