from __future__ import annotations
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.roadmap_phase import RoadmapPhase
from models.roadmap_sprint import RoadmapSprint
from models.action_item import ActionItem
from models.sprint_config import SprintConfig
from models.base import gen_uuid
from schemas.roadmap import (
    PhaseCreate, PhaseUpdate, PhaseOut, SprintOut,
    SprintCreate, SprintUpdate, SprintTaskCount,
)

router = APIRouter(prefix="/roadmap", tags=["roadmap"])


async def _enrich_sprint(sprint: RoadmapSprint, db: AsyncSession) -> SprintOut:
    """Attach task counts to a sprint."""
    result = await db.execute(
        select(ActionItem).where(ActionItem.sprint_id == sprint.id)
    )
    tasks = result.scalars().all()
    today = date.today()
    done = sum(1 for t in tasks if t.status == "done")
    overdue = sum(
        1 for t in tasks
        if t.status not in ("done", "cancelled") and t.deadline and t.deadline < today
    )
    out = SprintOut.model_validate(sprint)
    out.task_counts = SprintTaskCount(total=len(tasks), done=done, overdue=overdue)
    return out


@router.get("/phases")
async def list_phases(product_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(RoadmapPhase)
        .where(RoadmapPhase.product_id == product_id)
        .order_by(RoadmapPhase.order_index)
    )
    phases = result.scalars().all()

    out = []
    for phase in phases:
        sprint_result = await db.execute(
            select(RoadmapSprint)
            .where(RoadmapSprint.phase_id == phase.id)
            .order_by(RoadmapSprint.order_index)
        )
        sprints = sprint_result.scalars().all()
        phase_out = PhaseOut(
            id=phase.id,
            product_id=phase.product_id,
            name=phase.name,
            description=phase.description,
            order_index=phase.order_index,
            created_at=phase.created_at,
            sprints=[await _enrich_sprint(s, db) for s in sprints],
        )
        out.append(phase_out)
    return out


@router.post("/phases", status_code=201)
async def create_phase(body: PhaseCreate, db: AsyncSession = Depends(get_db)):
    phase = RoadmapPhase(id=gen_uuid(), **body.model_dump())
    db.add(phase)
    await db.flush()
    await db.commit()
    await db.refresh(phase)
    return PhaseOut(
        id=phase.id,
        product_id=phase.product_id,
        name=phase.name,
        description=phase.description,
        order_index=phase.order_index,
        created_at=phase.created_at,
        sprints=[],
    )


@router.patch("/phases/{phase_id}")
async def update_phase(phase_id: str, body: PhaseUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoadmapPhase).where(RoadmapPhase.id == phase_id))
    phase = result.scalar_one_or_none()
    if not phase:
        raise HTTPException(404, "Phase not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(phase, field, value)
    await db.commit()
    # Re-fetch sprints explicitly (avoid lazy-load greenlet issue)
    sprint_result = await db.execute(
        select(RoadmapSprint)
        .where(RoadmapSprint.phase_id == phase_id)
        .order_by(RoadmapSprint.order_index)
    )
    sprints = sprint_result.scalars().all()
    enriched_sprints = [await _enrich_sprint(s, db) for s in sprints]
    return PhaseOut(
        id=phase.id,
        product_id=phase.product_id,
        name=phase.name,
        description=phase.description,
        order_index=phase.order_index,
        created_at=phase.created_at,
        sprints=enriched_sprints,
    )


@router.delete("/phases/{phase_id}", status_code=204)
async def delete_phase(phase_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoadmapPhase).where(RoadmapPhase.id == phase_id))
    phase = result.scalar_one_or_none()
    if not phase:
        raise HTTPException(404, "Phase not found")
    await db.execute(delete(RoadmapPhase).where(RoadmapPhase.id == phase_id))
    await db.commit()


@router.post("/sprints", status_code=201)
async def create_sprint(body: SprintCreate, db: AsyncSession = Depends(get_db)):
    start_date = body.start_date
    end_date = body.end_date
    sprint_number = body.sprint_number

    if body.sprint_config_id and (not start_date or not end_date):
        cfg_result = await db.execute(
            select(SprintConfig).where(SprintConfig.id == body.sprint_config_id)
        )
        config = cfg_result.scalar_one_or_none()
        if config and sprint_number:
            start_date = config.anchor_date + timedelta(weeks=(sprint_number - 1) * config.sprint_length_weeks)
            end_date = start_date + timedelta(weeks=config.sprint_length_weeks) - timedelta(days=1)

    sprint = RoadmapSprint(
        id=gen_uuid(),
        phase_id=body.phase_id,
        sprint_config_id=body.sprint_config_id,
        name=body.name,
        sprint_number=sprint_number,
        start_date=start_date,
        end_date=end_date,
        order_index=body.order_index,
    )
    db.add(sprint)
    await db.flush()
    await db.commit()
    await db.refresh(sprint)
    return await _enrich_sprint(sprint, db)


@router.patch("/sprints/{sprint_id}")
async def update_sprint(sprint_id: str, body: SprintUpdate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoadmapSprint).where(RoadmapSprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(404, "Sprint not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(sprint, field, value)
    await db.commit()
    await db.refresh(sprint)
    return await _enrich_sprint(sprint, db)


@router.delete("/sprints/{sprint_id}", status_code=204)
async def delete_sprint(sprint_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(RoadmapSprint).where(RoadmapSprint.id == sprint_id))
    sprint = result.scalar_one_or_none()
    if not sprint:
        raise HTTPException(404, "Sprint not found")
    await db.execute(delete(RoadmapSprint).where(RoadmapSprint.id == sprint_id))
    await db.commit()


@router.get("/tasks")
async def list_tasks(
    sprint_id: Optional[str] = None,
    phase_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(ActionItem)
    if sprint_id:
        q = q.where(ActionItem.sprint_id == sprint_id)
    elif phase_id:
        q = q.where(ActionItem.phase_id == phase_id)
    else:
        raise HTTPException(400, "Provide sprint_id or phase_id")
    result = await db.execute(q)
    return result.scalars().all()
