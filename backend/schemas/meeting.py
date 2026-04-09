from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MeetingNoteOut(BaseModel):
    id: str
    meeting_id: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class MeetingOut(BaseModel):
    id: str
    product_id: str
    name: str
    meeting_type: str
    participants: Optional[list] = None
    scheduled_at: Optional[datetime] = None
    status: str
    created_at: datetime
    notes: list[MeetingNoteOut] = []

    class Config:
        from_attributes = True


class MeetingCreate(BaseModel):
    product_id: str
    name: str
    meeting_type: str = "daily"
    participants: Optional[list] = None
    scheduled_at: Optional[datetime] = None


class MeetingUpdate(BaseModel):
    name: Optional[str] = None
    meeting_type: Optional[str] = None
    participants: Optional[list] = None
    scheduled_at: Optional[datetime] = None
    status: Optional[str] = None


class NoteCreate(BaseModel):
    content: str
