from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime


class SprintConfigCreate(BaseModel):
    product_id: Optional[str] = None
    anchor_date: date
    sprint_length_weeks: int = 2

    @field_validator("anchor_date")
    @classmethod
    def must_be_monday(cls, v: date) -> date:
        if v.weekday() != 0:
            day_names = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
            raise ValueError(f"anchor_date phải là Thứ 2. Ngày {v} là {day_names[v.weekday()]}.")
        return v

    @field_validator("sprint_length_weeks")
    @classmethod
    def valid_length(cls, v: int) -> int:
        if v not in (2, 3, 4):
            raise ValueError("sprint_length_weeks phải là 2, 3 hoặc 4")
        return v


class SprintConfigOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    anchor_date: date
    sprint_length_weeks: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SprintInfo(BaseModel):
    number: int
    start_date: date
    end_date: date


class SprintCurrentResponse(BaseModel):
    config_id: str
    product_id: Optional[str]
    anchor_date: date
    sprint_length_weeks: int
    current_sprint: SprintInfo
    next_sprint: SprintInfo
