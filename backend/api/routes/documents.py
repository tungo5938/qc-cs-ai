from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.document import ProductDocument
from models.base import gen_uuid
from schemas.document import DocumentOut, DocumentCreate, DocumentUpdate, DocumentChatRequest, DocumentChatResponse, DocumentAction

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
async def list_documents(product_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    q = select(ProductDocument).order_by(ProductDocument.path)
    if product_id:
        q = q.where(ProductDocument.product_id == product_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=DocumentOut)
async def create_document(body: DocumentCreate, db: AsyncSession = Depends(get_db)):
    doc = ProductDocument(
        id=gen_uuid(),
        product_id=body.product_id,
        path=body.path,
        title=body.title,
        content=body.content,
        created_by=body.created_by,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(ProductDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.patch("/{doc_id}", response_model=DocumentOut)
async def update_document(doc_id: str, body: DocumentUpdate, db: AsyncSession = Depends(get_db)):
    doc = await db.get(ProductDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if body.title is not None:
        doc.title = body.title
    if body.content is not None:
        doc.content = body.content
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(ProductDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()
    return {"ok": True}
