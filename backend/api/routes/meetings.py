from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.meeting import Meeting
from models.meeting_note import MeetingNote
from models.action_item import ActionItem
from models.product import Product
from models.base import gen_uuid
from schemas.meeting import MeetingOut, MeetingCreate, MeetingUpdate, NoteCreate
from schemas.action_item import ActionItemOut
from services import ai_service

router = APIRouter(prefix="/meetings", tags=["meetings"])


@router.get("")
async def list_meetings(
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Meeting).options(selectinload(Meeting.notes))
    if product_id:
        query = query.where(Meeting.product_id == product_id)
    if status:
        query = query.where(Meeting.status == status)
    query = query.order_by(Meeting.created_at.desc())
    result = await db.execute(query)
    meetings = result.scalars().all()
    return [MeetingOut.model_validate(m).model_dump() for m in meetings]


@router.post("", status_code=201)
async def create_meeting(
    body: MeetingCreate,
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, body.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    meeting = Meeting(
        id=gen_uuid(),
        product_id=body.product_id,
        name=body.name,
        meeting_type=body.meeting_type,
        participants=body.participants,
        scheduled_at=body.scheduled_at,
        status="upcoming",
    )
    db.add(meeting)
    await db.flush()
    await db.commit()
    await db.refresh(meeting)
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.notes)).where(Meeting.id == meeting.id)
    )
    meeting = result.scalar_one()
    return MeetingOut.model_validate(meeting).model_dump()


@router.get("/{meeting_id}")
async def get_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting)
        .options(
            selectinload(Meeting.notes),
            selectinload(Meeting.action_items),
        )
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    meeting_data = MeetingOut.model_validate(meeting).model_dump()
    meeting_data["action_items"] = [
        ActionItemOut.model_validate(ai).model_dump() for ai in meeting.action_items
    ]
    return meeting_data


@router.put("/{meeting_id}")
async def update_meeting(
    meeting_id: str,
    body: MeetingUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.notes)).where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(meeting, field, value)

    await db.flush()
    await db.commit()
    await db.refresh(meeting)
    result = await db.execute(
        select(Meeting).options(selectinload(Meeting.notes)).where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one()
    return MeetingOut.model_validate(meeting).model_dump()


@router.post("/{meeting_id}/notes", status_code=201)
async def add_note(
    meeting_id: str,
    body: NoteCreate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Meeting).where(Meeting.id == meeting_id))
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    note = MeetingNote(
        id=gen_uuid(),
        meeting_id=meeting_id,
        content=body.content,
    )
    db.add(note)
    await db.flush()
    await db.commit()
    await db.refresh(note)
    return {"id": note.id, "meeting_id": note.meeting_id, "content": note.content, "created_at": note.created_at}


@router.post("/{meeting_id}/finish")
async def finish_meeting(
    meeting_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Meeting)
        .options(
            selectinload(Meeting.notes),
            selectinload(Meeting.action_items),
        )
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one_or_none()
    if not meeting:
        raise HTTPException(404, "Meeting not found")

    # Get product name for AI context
    product_name = ""
    if meeting.product_id:
        product = await db.get(Product, meeting.product_id)
        if product:
            product_name = product.name

    # Set status to done
    meeting.status = "done"
    await db.flush()

    # Concatenate all notes content
    notes_text = "\n\n".join(note.content for note in meeting.notes)

    # Extract action items via AI
    extracted = []
    if notes_text.strip():
        extracted = await ai_service.extract_action_items(
            meeting_notes=notes_text,
            product_name=product_name,
        )

    # Create ActionItem records for each extracted item
    created_items = []
    for item in extracted:
        action_item = ActionItem(
            id=gen_uuid(),
            product_id=meeting.product_id,
            title=item.get("title", ""),
            assignee=item.get("assignee"),
            deadline=item.get("deadline"),
            source_meeting_id=meeting_id,
            status="todo",
        )
        db.add(action_item)
        created_items.append(action_item)

    await db.flush()
    await db.commit()

    # Reload meeting with relationships
    result = await db.execute(
        select(Meeting)
        .options(
            selectinload(Meeting.notes),
            selectinload(Meeting.action_items),
        )
        .where(Meeting.id == meeting_id)
    )
    meeting = result.scalar_one()

    return {
        "meeting": MeetingOut.model_validate(meeting).model_dump(),
        "extracted_action_items": [
            ActionItemOut.model_validate(ai).model_dump() for ai in meeting.action_items
        ],
    }
