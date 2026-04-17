from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class DocumentOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    path: str
    title: str
    content: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentCreate(BaseModel):
    product_id: Optional[str] = None
    path: str
    title: str
    content: str = ""
    created_by: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class DocumentAction(BaseModel):
    type: Literal["update_document"]
    document_path: str
    new_content: str


class DocumentChatRequest(BaseModel):
    message: str
    tagged_document_ids: list[str] = []


class DocumentChatResponse(BaseModel):
    reply: str
    actions: list[DocumentAction] = []
