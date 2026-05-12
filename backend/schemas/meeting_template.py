from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class MeetingTemplateOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    product_name: Optional[str] = None
    name: str
    ceremony_type: str
    day_of_week: Optional[int] = None
    week_in_sprint: int
    pic: Optional[list] = None
    output_template: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class MeetingTemplateCreate(BaseModel):
    product_id: Optional[str] = None
    name: str
    ceremony_type: str = "Meeting"
    day_of_week: Optional[int] = None
    week_in_sprint: int = 0
    pic: Optional[list] = None
    output_template: Optional[str] = None


class MeetingTemplateUpdate(BaseModel):
    product_id: Optional[str] = None
    name: Optional[str] = None
    ceremony_type: Optional[str] = None
    day_of_week: Optional[int] = None
    week_in_sprint: Optional[int] = None
    pic: Optional[list] = None
    output_template: Optional[str] = None


class GenerateMeetingsRequest(BaseModel):
    sprint_start_date: str  # ISO date, e.g. "2026-04-28" (Monday of week 1)
    product_id: Optional[str] = None  # filter templates by product, None = all
    sprint_number: Optional[int] = None  # if provided, included in meeting name
