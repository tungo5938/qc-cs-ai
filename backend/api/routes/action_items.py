from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.action_item import ActionItem
from models.product import Product
from models.base import gen_uuid
from schemas.action_item import ActionItemOut, ActionItemCreate, ActionItemUpdate, ActionItemBulkUpdate

router = APIRouter(prefix="/action-items", tags=["action-items"])


@router.get("")
async def list_action_items(
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    assignee: Optional[str] = None,
    source_feedback_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(ActionItem)
    if product_id:
        query = query.where(ActionItem.product_id == product_id)
    if status:
        query = query.where(ActionItem.status == status)
    if assignee:
        query = query.where(ActionItem.assignee == assignee)
    if source_feedback_id:
        query = query.where(ActionItem.source_feedback_id == source_feedback_id)
    query = query.order_by(ActionItem.created_at.desc())
    result = await db.execute(query)
    items = result.scalars().all()
    return [ActionItemOut.model_validate(item).model_dump() for item in items]


@router.post("", status_code=201)
async def create_action_item(
    body: ActionItemCreate,
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, body.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    item = ActionItem(
        id=gen_uuid(),
        product_id=body.product_id,
        title=body.title,
        assignee=body.assignee,
        deadline=body.deadline,
        source_meeting_id=body.source_meeting_id,
        source_feedback_id=body.source_feedback_id,
        status="todo",
    )
    db.add(item)
    await db.flush()
    await db.commit()
    await db.refresh(item)
    return ActionItemOut.model_validate(item).model_dump()


@router.patch("/{item_id}")
async def update_action_item(
    item_id: str,
    body: ActionItemUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ActionItem).where(ActionItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Action item not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(item, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(item)
    return ActionItemOut.model_validate(item).model_dump()


@router.post("/bulk")
async def bulk_update_action_items(
    body: ActionItemBulkUpdate,
    db: AsyncSession = Depends(get_db),
):
    if not body.ids:
        raise HTTPException(400, "No IDs provided")

    result = await db.execute(
        select(ActionItem).where(ActionItem.id.in_(body.ids))
    )
    items = result.scalars().all()

    if not items:
        raise HTTPException(404, "No matching action items found")

    update_data = body.model_dump(exclude_unset=True, exclude={"ids"})
    for item in items:
        for field, value in update_data.items():
            setattr(item, field, value)

    await db.flush()
    await db.commit()

    # Reload updated items
    result = await db.execute(
        select(ActionItem).where(ActionItem.id.in_(body.ids))
    )
    updated_items = result.scalars().all()
    return [ActionItemOut.model_validate(item).model_dump() for item in updated_items]


@router.delete("/{item_id}", status_code=204)
async def delete_action_item(
    item_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(ActionItem).where(ActionItem.id == item_id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(404, "Action item not found")

    await db.delete(item)
    await db.commit()
