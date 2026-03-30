from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from models.knowledge_base import KBSourceType


class KBEntryOut(BaseModel):
    id: str
    source_type: KBSourceType
    source_ref: Optional[str]
    title: str
    content: str
    is_active: bool
    imported_by_email: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class KBEntryCreate(BaseModel):
    title: str
    content: str
    source_ref: Optional[str] = None


class KBImportGdoc(BaseModel):
    url: str
    imported_by_email: Optional[str] = None


class KBImportJira(BaseModel):
    jira_url: str
    imported_by_email: Optional[str] = None
