from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class SolutionDraftOut(BaseModel):
    id: str
    feedback_id: str
    product_id: str
    product_name: Optional[str] = None  # denormalized for display convenience
    problem_statement: Optional[str] = None
    proposed_solution: Optional[str] = None
    success_metrics: Optional[str] = None
    effort_estimate: Optional[str] = None
    open_questions: Optional[str] = None
    status: str
    rejection_reason: Optional[str] = None
    gdoc_url: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SolutionDraftUpdate(BaseModel):
    problem_statement: Optional[str] = None
    proposed_solution: Optional[str] = None
    success_metrics: Optional[str] = None
    effort_estimate: Optional[str] = None
    open_questions: Optional[str] = None


class SolutionDraftReject(BaseModel):
    rejection_reason: str
