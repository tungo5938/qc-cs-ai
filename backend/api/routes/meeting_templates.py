from __future__ import annotations
from typing import Optional
from datetime import date, datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.meeting_template import MeetingTemplate
from models.meeting import Meeting
from models.product import Product
from models.base import gen_uuid
from schemas.meeting_template import (
    MeetingTemplateOut,
    MeetingTemplateCreate,
    MeetingTemplateUpdate,
    GenerateMeetingsRequest,
)
from schemas.meeting import MeetingOut

router = APIRouter(prefix="/meeting-templates", tags=["meeting-templates"])

DAY_NAMES = {1: "Thứ 2", 2: "Thứ 3", 3: "Thứ 4", 4: "Thứ 5", 5: "Thứ 6", 6: "Thứ 7", 7: "Chủ nhật"}
WEEK_LABELS = {0: "Hàng tuần", 1: "Tuần 1", 2: "Tuần 2", 3: "Tuần 3", 4: "Tuần 4"}

# Seed data from the ceremony md file
SEED_TEMPLATES = [
    # TUẦN 1
    {
        "name": "Sprint Planning",
        "ceremony_type": "Meeting",
        "day_of_week": 1,
        "week_in_sprint": 1,
        "pic": ["PO", "Dev team"],
        "output_template": "- [ ] Các story trên Jira được estimate\n- [ ] Các story được làm rõ, sẵn sàng để dev",
    },
    {
        "name": "Business Alignment",
        "ceremony_type": "Meeting",
        "day_of_week": 2,
        "week_in_sprint": 1,
        "pic": ["PO", "Business"],
        "output_template": "- [ ] Danh sách vấn đề/tính năng/bug mới từ business\n- [ ] Review requirement sprint trước",
    },
    {
        "name": "Finalize Sprint Requirement",
        "ceremony_type": "Action",
        "day_of_week": 4,
        "week_in_sprint": 1,
        "pic": ["PO"],
        "output_template": "- [ ] Danh sách story được mô tả rõ, sẵn sàng cho Grooming",
    },
    # TUẦN 2
    {
        "name": "Design Grooming",
        "ceremony_type": "Action",
        "day_of_week": 1,
        "week_in_sprint": 2,
        "pic": ["PO", "Designer"],
        "output_template": "- [ ] Figma design cho các story cần UI",
    },
    {
        "name": "Week Review",
        "ceremony_type": "Meeting",
        "day_of_week": 1,
        "week_in_sprint": 2,
        "pic": ["CDN", "Dev team"],
        "output_template": "- [ ] Blockers được giải đáp\n- [ ] Action items giải quyết blockers có PIC",
    },
    {
        "name": "Grooming Sprint",
        "ceremony_type": "Meeting",
        "day_of_week": 4,
        "week_in_sprint": 2,
        "pic": ["PO", "Dev team"],
        "output_template": "- [ ] Jira được bổ sung đầy đủ về mặt technical",
    },
    # TUẦN 3
    {
        "name": "UAT",
        "ceremony_type": "Action",
        "day_of_week": 1,
        "week_in_sprint": 3,
        "pic": ["PO", "End user"],
        "output_template": "- [ ] Tất cả ticket được UAT bởi PO hoặc Business Owner\n- [ ] Release checklist hoàn chỉnh",
    },
    # TUẦN 4
    {
        "name": "Gửi Release Note",
        "ceremony_type": "Action",
        "day_of_week": 1,
        "week_in_sprint": 4,
        "pic": ["PO"],
        "output_template": "- [ ] Email release note đã gửi stakeholders",
    },
    {
        "name": "Thông báo Production",
        "ceremony_type": "Action",
        "day_of_week": 2,
        "week_in_sprint": 4,
        "pic": ["PO"],
        "output_template": "- [ ] Đã thông báo release production",
    },
    # MỖI TUẦN
    {
        "name": "Daily Meeting",
        "ceremony_type": "Meeting",
        "day_of_week": 2,
        "week_in_sprint": 0,
        "pic": [],
        "output_template": "- [ ] Danh sách action items giải quyết blockers có PIC và kết quả",
    },
]


def _enrich(t: MeetingTemplate) -> dict:
    d = MeetingTemplateOut.model_validate(t).model_dump()
    d["product_name"] = t.product.name if t.product else None
    return d


@router.get("")
async def list_templates(
    product_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    q = select(MeetingTemplate).options(selectinload(MeetingTemplate.product))
    if product_id:
        q = q.where(MeetingTemplate.product_id == product_id)
    q = q.order_by(MeetingTemplate.week_in_sprint, MeetingTemplate.day_of_week)
    result = await db.execute(q)
    templates = result.scalars().all()
    return [_enrich(t) for t in templates]


@router.post("", status_code=201)
async def create_template(
    body: MeetingTemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    if body.product_id:
        product = await db.get(Product, body.product_id)
        if not product:
            raise HTTPException(404, "Product not found")

    t = MeetingTemplate(
        id=gen_uuid(),
        **body.model_dump(),
    )
    db.add(t)
    await db.flush()
    await db.commit()
    result = await db.execute(
        select(MeetingTemplate)
        .options(selectinload(MeetingTemplate.product))
        .where(MeetingTemplate.id == t.id)
    )
    t = result.scalar_one()
    return _enrich(t)


@router.put("/{template_id}")
async def update_template(
    template_id: str,
    body: MeetingTemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(MeetingTemplate)
        .options(selectinload(MeetingTemplate.product))
        .where(MeetingTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Template not found")

    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(t, field, value)

    await db.flush()
    await db.commit()
    result = await db.execute(
        select(MeetingTemplate)
        .options(selectinload(MeetingTemplate.product))
        .where(MeetingTemplate.id == template_id)
    )
    t = result.scalar_one()
    return _enrich(t)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(MeetingTemplate).where(MeetingTemplate.id == template_id))
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(404, "Template not found")
    await db.delete(t)
    await db.commit()


@router.post("/seed", status_code=201)
async def seed_templates(
    product_id: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    """Clear all templates and seed from ceremony md data."""
    await db.execute(delete(MeetingTemplate))
    await db.flush()

    products_result = await db.execute(select(Product))
    all_products = products_result.scalars().all()

    # If product_id given, seed only for that product; else seed for all products
    target_products = [p for p in all_products if not product_id or p.id == product_id]

    created = []
    for product in target_products:
        for seed in SEED_TEMPLATES:
            t = MeetingTemplate(id=gen_uuid(), product_id=product.id, **seed)
            db.add(t)
            created.append(t)

    await db.flush()
    await db.commit()
    return {"seeded": len(created), "products": [p.name for p in target_products]}


@router.post("/generate-meetings", status_code=201)
async def generate_meetings(
    body: GenerateMeetingsRequest,
    db: AsyncSession = Depends(get_db),
):
    """Generate meeting instances for a 4-week sprint based on templates."""
    try:
        sprint_start = date.fromisoformat(body.sprint_start_date)
    except ValueError:
        raise HTTPException(400, "Invalid sprint_start_date, expected YYYY-MM-DD")

    # sprint_start must be a Monday (weekday 0)
    if sprint_start.weekday() != 0:
        day_names = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
        raise HTTPException(
            400,
            f"sprint_start_date phải là Thứ 2. Ngày {body.sprint_start_date} là {day_names[sprint_start.weekday()]}."
        )

    q = select(MeetingTemplate).options(selectinload(MeetingTemplate.product))
    if body.product_id:
        q = q.where(MeetingTemplate.product_id == body.product_id)
    result = await db.execute(q)
    templates = result.scalars().all()

    created_meetings = []

    for t in templates:
        if t.day_of_week is None:
            continue

        # Weeks to generate for
        sprint_weeks = [1, 2, 3, 4] if t.week_in_sprint == 0 else [t.week_in_sprint]

        # But week 4 is actually next sprint week 1 (offset 3 weeks from sprint_start)
        for sprint_week in sprint_weeks:
            week_offset = sprint_week - 1  # 0-indexed
            # Find the correct weekday in that week
            # sprint_start is Monday of week 1
            week_monday = sprint_start + timedelta(weeks=week_offset)
            # day_of_week: 1=Mon → offset 0, 2=Tue → offset 1, etc.
            day_offset = t.day_of_week - 1
            meeting_date = week_monday + timedelta(days=day_offset)

            # Build meeting name: include week label
            week_label = WEEK_LABELS.get(t.week_in_sprint, f"Tuần {t.week_in_sprint}")
            if t.week_in_sprint == 0:
                week_label = f"Tuần {sprint_week}"
            sprint_label = f" — Sprint {body.sprint_number}" if body.sprint_number else ""
            meeting_name = f"{t.name}{sprint_label} — {week_label}"

            scheduled_at = datetime(
                meeting_date.year, meeting_date.month, meeting_date.day,
                9, 0, 0, tzinfo=timezone.utc
            )

            product_id = t.product_id
            if not product_id:
                continue  # skip templates with no product

            m = Meeting(
                id=gen_uuid(),
                product_id=product_id,
                name=meeting_name,
                meeting_type="planning" if "planning" in t.name.lower() else
                             "grooming" if "grooming" in t.name.lower() else
                             "review" if "review" in t.name.lower() else "daily",
                participants=t.pic or [],
                scheduled_at=scheduled_at,
                status="upcoming",
            )
            db.add(m)
            created_meetings.append(m)

    await db.flush()
    await db.commit()
    return {"created": len(created_meetings)}
