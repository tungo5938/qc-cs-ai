from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.solution_draft import SolutionDraft
from schemas.solution_draft import SolutionDraftOut, SolutionDraftUpdate, SolutionDraftReject, CanvasPatch, PrdPatch, JiraEpicPatch

router = APIRouter(prefix="/solutions", tags=["solutions"])


def _to_out(draft: SolutionDraft) -> dict:
    out = SolutionDraftOut.model_validate(draft)
    # Attach product name for display convenience
    if draft.product:
        out.product_name = draft.product.name
    return out.model_dump()


@router.get("")
async def list_solutions(
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = (
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .order_by(SolutionDraft.created_at.desc())
    )
    if product_id:
        query = query.where(SolutionDraft.product_id == product_id)
    if status:
        query = query.where(SolutionDraft.status == status)

    result = await db.execute(query)
    drafts = result.scalars().all()
    return [_to_out(d) for d in drafts]


@router.get("/{solution_id}")
async def get_solution(
    solution_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(404, "Không tìm thấy bản thảo giải pháp")
    return _to_out(draft)


@router.put("/{solution_id}")
async def update_solution(
    solution_id: str,
    body: SolutionDraftUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(404, "Không tìm thấy bản thảo giải pháp")

    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(draft, field, value)

    await db.commit()
    await db.refresh(draft)

    # Reload with relationship
    result = await db.execute(
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    return _to_out(draft)


@router.post("/{solution_id}/approve")
async def approve_solution(
    solution_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(404, "Không tìm thấy bản thảo giải pháp")

    draft.status = "approved"
    draft.rejection_reason = None
    await db.commit()

    result = await db.execute(
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    return _to_out(draft)


@router.patch("/{solution_id}/canvas")
async def patch_canvas(solution_id: str, body: CanvasPatch, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SolutionDraft).options(selectinload(SolutionDraft.product)).where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(404, "Không tìm thấy bản thảo giải pháp")
    draft.tldraw_data = body.tldraw_data
    await db.commit()
    await db.refresh(draft)
    return _to_out(draft)


@router.patch("/{solution_id}/prd")
async def patch_prd(solution_id: str, body: PrdPatch, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SolutionDraft).options(selectinload(SolutionDraft.product)).where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(404, "Không tìm thấy bản thảo giải pháp")
    draft.prd_content = body.prd_content
    await db.commit()
    await db.refresh(draft)
    return _to_out(draft)


@router.patch("/{solution_id}/jira-epic")
async def patch_jira_epic(solution_id: str, body: JiraEpicPatch, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(SolutionDraft).options(selectinload(SolutionDraft.product)).where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(404, "Không tìm thấy bản thảo giải pháp")
    draft.jira_epic_key = body.jira_epic_key
    await db.commit()
    await db.refresh(draft)
    return _to_out(draft)


@router.post("/{solution_id}/reject")
async def reject_solution(
    solution_id: str,
    body: SolutionDraftReject,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(404, "Không tìm thấy bản thảo giải pháp")

    draft.status = "rejected"
    draft.rejection_reason = body.rejection_reason
    await db.commit()

    result = await db.execute(
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    return _to_out(draft)
