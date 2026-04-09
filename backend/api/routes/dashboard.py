from __future__ import annotations
from typing import Optional
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.feedback import Feedback
from models.action_item import ActionItem
from models.solution_draft import SolutionDraft
from models.meeting import Meeting
from schemas.feedback import FeedbackOut
from schemas.action_item import ActionItemOut
from schemas.meeting import MeetingOut
from services.metabase_service import fetch_kpis

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("")
async def get_dashboard(
    product_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    today = date.today()

    # ── Metric card counts ────────────────────────────────────────────────────

    # feedback_pending: status in ('new', 'analyzing')
    fb_count_q = select(func.count(Feedback.id)).where(
        Feedback.status.in_(["new", "analyzing"])
    )
    if product_id:
        fb_count_q = fb_count_q.where(Feedback.product_id == product_id)
    feedback_pending = (await db.execute(fb_count_q)).scalar_one()

    # actions_overdue: status != 'done' AND deadline < today
    ai_count_q = select(func.count(ActionItem.id)).where(
        and_(ActionItem.status != "done", ActionItem.deadline < today)
    )
    if product_id:
        ai_count_q = ai_count_q.where(ActionItem.product_id == product_id)
    actions_overdue = (await db.execute(ai_count_q)).scalar_one()

    # solutions_pending: status = 'draft'
    sol_count_q = select(func.count(SolutionDraft.id)).where(
        SolutionDraft.status == "draft"
    )
    if product_id:
        sol_count_q = sol_count_q.where(SolutionDraft.product_id == product_id)
    solutions_pending = (await db.execute(sol_count_q)).scalar_one()

    # meetings_today: DATE(scheduled_at) = today
    mtg_count_q = select(func.count(Meeting.id)).where(
        func.date(Meeting.scheduled_at) == today
    )
    if product_id:
        mtg_count_q = mtg_count_q.where(Meeting.product_id == product_id)
    meetings_today_count = (await db.execute(mtg_count_q)).scalar_one()

    # ── Widget lists ──────────────────────────────────────────────────────────

    # Top 3 overdue action items (oldest deadline first)
    overdue_q = (
        select(ActionItem)
        .where(and_(ActionItem.status != "done", ActionItem.deadline < today))
        .order_by(ActionItem.deadline.asc())
        .limit(3)
    )
    if product_id:
        overdue_q = overdue_q.where(ActionItem.product_id == product_id)
    overdue_result = await db.execute(overdue_q)
    overdue_actions = [
        ActionItemOut.model_validate(a).model_dump()
        for a in overdue_result.scalars().all()
    ]

    # 3 most recent feedbacks with status 'new' or 'analyzing'
    new_fb_q = (
        select(Feedback)
        .where(Feedback.status.in_(["new", "analyzing"]))
        .order_by(Feedback.created_at.desc())
        .limit(3)
    )
    if product_id:
        new_fb_q = new_fb_q.where(Feedback.product_id == product_id)
    new_fb_result = await db.execute(new_fb_q)
    new_feedbacks = [
        FeedbackOut.model_validate(f).model_dump()
        for f in new_fb_result.scalars().all()
    ]

    # Today's meetings (without notes for speed)
    today_mtg_q = (
        select(Meeting)
        .where(func.date(Meeting.scheduled_at) == today)
        .order_by(Meeting.scheduled_at.asc())
    )
    if product_id:
        today_mtg_q = today_mtg_q.where(Meeting.product_id == product_id)
    today_mtg_result = await db.execute(today_mtg_q)
    meetings_today_list = []
    for m in today_mtg_result.scalars().all():
        data = MeetingOut.model_validate(m).model_dump()
        data.pop("notes", None)  # strip notes for dashboard brevity
        meetings_today_list.append(data)

    # ── Metabase KPIs ─────────────────────────────────────────────────────────
    metabase_kpis = await fetch_kpis()

    return {
        "date": today.isoformat(),
        "product_filter": product_id,
        "metric_cards": {
            "feedback_pending": feedback_pending,
            "actions_overdue": actions_overdue,
            "solutions_pending": solutions_pending,
            "meetings_today": meetings_today_count,
        },
        "overdue_actions": overdue_actions,
        "new_feedbacks": new_feedbacks,
        "meetings_today": meetings_today_list,
        "metabase_kpis": metabase_kpis,
    }
