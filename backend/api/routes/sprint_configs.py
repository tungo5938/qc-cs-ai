from __future__ import annotations
from datetime import date, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.sprint_config import SprintConfig
from models.base import gen_uuid
from schemas.sprint_config import SprintConfigCreate, SprintConfigOut, SprintCurrentResponse, SprintInfo

router = APIRouter(prefix="/sprint-configs", tags=["sprint-configs"])


def _calc_sprint(anchor: date, length_weeks: int, today: date) -> tuple[int, date, date]:
    """Returns (sprint_number, start_date, end_date) for the sprint containing today."""
    delta_days = (today - anchor).days
    if delta_days < 0:
        # today is before the anchor — series hasn't started yet, treat as sprint 1
        sprint_num = 1
    else:
        sprint_num = delta_days // (length_weeks * 7) + 1
    start = anchor + timedelta(weeks=(sprint_num - 1) * length_weeks)
    end = start + timedelta(weeks=length_weeks) - timedelta(days=1)
    return sprint_num, start, end


@router.get("")
async def list_sprint_configs(
    product_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(SprintConfig)
    if product_id:
        q = q.where(SprintConfig.product_id == product_id)
    result = await db.execute(q)
    configs = result.scalars().all()
    return [SprintConfigOut.model_validate(c).model_dump() for c in configs]


@router.post("", status_code=201)
async def upsert_sprint_config(
    body: SprintConfigCreate,
    db: AsyncSession = Depends(get_db),
):
    """Create or replace sprint config for a product (one config per product)."""
    await db.execute(
        delete(SprintConfig).where(SprintConfig.product_id.is_(body.product_id))
    )
    config = SprintConfig(
        id=gen_uuid(),
        product_id=body.product_id,
        anchor_date=body.anchor_date,
        sprint_length_weeks=body.sprint_length_weeks,
    )
    db.add(config)
    await db.flush()
    await db.commit()
    await db.refresh(config)
    return SprintConfigOut.model_validate(config).model_dump()


@router.get("/current")
async def get_current_sprint(
    product_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(SprintConfig)
    if product_id:
        q = q.where(SprintConfig.product_id == product_id)
    else:
        q = q.where(SprintConfig.product_id.is_(None))
    result = await db.execute(q)
    config = result.scalar_one_or_none()
    if not config:
        raise HTTPException(404, "Sprint config not found. Please set up sprint series first.")

    today = date.today()
    cur_num, cur_start, cur_end = _calc_sprint(config.anchor_date, config.sprint_length_weeks, today)
    next_num = cur_num + 1
    next_start = config.anchor_date + timedelta(weeks=(next_num - 1) * config.sprint_length_weeks)
    next_end = next_start + timedelta(weeks=config.sprint_length_weeks) - timedelta(days=1)

    return SprintCurrentResponse(
        config_id=config.id,
        product_id=config.product_id,
        anchor_date=config.anchor_date,
        sprint_length_weeks=config.sprint_length_weeks,
        current_sprint=SprintInfo(number=cur_num, start_date=cur_start, end_date=cur_end),
        next_sprint=SprintInfo(number=next_num, start_date=next_start, end_date=next_end),
    ).model_dump()
