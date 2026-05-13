from pydantic import BaseModel
from typing import Optional
from datetime import date, datetime


class PhaseCreate(BaseModel):
    product_id: str
    name: str
    description: Optional[str] = None
    order_index: int = 0


class PhaseUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    order_index: Optional[int] = None


class SprintTaskCount(BaseModel):
    total: int
    done: int
    overdue: int


class SprintOut(BaseModel):
    id: str
    phase_id: str
    sprint_config_id: Optional[str] = None
    name: str
    sprint_number: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    order_index: int
    created_at: datetime
    task_counts: SprintTaskCount = SprintTaskCount(total=0, done=0, overdue=0)

    class Config:
        from_attributes = True


class PhaseOut(BaseModel):
    id: str
    product_id: str
    name: str
    description: Optional[str] = None
    order_index: int
    created_at: datetime
    sprints: list[SprintOut] = []

    class Config:
        from_attributes = True


class SprintCreate(BaseModel):
    phase_id: str
    sprint_config_id: Optional[str] = None
    name: str
    sprint_number: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    order_index: int = 0


class SprintUpdate(BaseModel):
    name: Optional[str] = None
    sprint_number: Optional[int] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    order_index: Optional[int] = None
