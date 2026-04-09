from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class ProductOut(BaseModel):
    id: str
    name: str
    telegram_group_id: Optional[str] = None
    kb_gdoc_url: Optional[str] = None
    jira_project_key: Optional[str] = None
    color: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class ProductCreate(BaseModel):
    name: str
    telegram_group_id: Optional[str] = None
    kb_gdoc_url: Optional[str] = None
    jira_project_key: Optional[str] = None
    color: Optional[str] = None


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    telegram_group_id: Optional[str] = None
    kb_gdoc_url: Optional[str] = None
    jira_project_key: Optional[str] = None
    color: Optional[str] = None
