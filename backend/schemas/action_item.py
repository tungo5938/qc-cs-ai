from pydantic import BaseModel
from typing import Optional
from datetime import datetime, date


class ActionItemOut(BaseModel):
    id: str
    product_id: str
    product_name: Optional[str] = None
    title: str
    assignee: Optional[str] = None
    deadline: Optional[date] = None
    status: str
    output_url: Optional[str] = None
    source_meeting_id: Optional[str] = None
    source_feedback_id: Optional[str] = None
    phase_id: Optional[str] = None
    sprint_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ActionItemCreate(BaseModel):
    product_id: str
    title: str
    assignee: Optional[str] = None
    deadline: Optional[date] = None
    output_url: Optional[str] = None
    source_meeting_id: Optional[str] = None
    source_feedback_id: Optional[str] = None
    phase_id: Optional[str] = None
    sprint_id: Optional[str] = None


class ActionItemUpdate(BaseModel):
    title: Optional[str] = None
    assignee: Optional[str] = None
    deadline: Optional[date] = None
    status: Optional[str] = None
    output_url: Optional[str] = None


class ActionItemBulkUpdate(BaseModel):
    ids: list[str]
    status: Optional[str] = None
    deadline: Optional[date] = None
