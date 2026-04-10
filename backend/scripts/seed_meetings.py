#!/usr/bin/env python3
"""
Seed meeting records for all 3 products.
Run from backend/ directory: python3 scripts/seed_meetings.py
"""
import asyncio
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from sqlalchemy import select, and_
from core.database import AsyncSessionLocal
from models.product import Product
from models.meeting import Meeting
from models.base import gen_uuid

VN_TZ = ZoneInfo("Asia/Ho_Chi_Minh")


def vn_datetime(year, month, day, hour, minute) -> datetime:
    return datetime(year, month, day, hour, minute, tzinfo=VN_TZ)


def generate_weekday_dates(start_date: datetime, num_weeks: int) -> list[datetime]:
    """Generate weekday dates (Mon-Fri) for num_weeks starting from start_date."""
    dates = []
    current = start_date
    end = start_date + timedelta(weeks=num_weeks)
    while current < end:
        if current.weekday() < 5:  # Mon=0 ... Fri=4
            dates.append(current)
        current += timedelta(days=1)
    return dates


async def seed():
    async with AsyncSessionLocal() as db:
        # Look up products
        result = await db.execute(select(Product))
        products = {p.name: p for p in result.scalars().all()}

        print(f"Found products: {list(products.keys())}")

        start = datetime(2026, 4, 8, tzinfo=VN_TZ)  # today

        meetings_to_add = []

        # CS AI + CS Chat: daily 9:10am weekdays, weekly review Mon, sprint grooming every 3 weeks Mon
        # Sprint 17 Week 1 started Apr 6, 2026
        sprint_start = datetime(2026, 4, 6, tzinfo=VN_TZ)

        for product_name in ["CS AI", "CS Chat"]:
            product = products.get(product_name)
            if not product:
                print(f"Product '{product_name}' not found, skipping")
                continue

            weekdays = generate_weekday_dates(start.replace(hour=9, minute=10), 4)

            for day in weekdays:
                scheduled = day  # already 9:10am

                # Determine meeting type
                if day.weekday() == 0:  # Monday
                    # Check if this is a sprint grooming week (every 3 weeks from sprint_start)
                    days_since_sprint = (day - sprint_start).days
                    weeks_since_sprint = days_since_sprint // 7
                    if weeks_since_sprint % 3 == 2:  # 3rd week = grooming
                        meeting_type = "grooming"
                        name = f"Sprint Grooming — {product_name}"
                    else:
                        meeting_type = "review"
                        name = f"Weekly Review — {product_name}"
                else:
                    meeting_type = "daily"
                    name = f"Daily Standup — {product_name}"

                # Check if already exists
                existing = await db.execute(
                    select(Meeting).where(
                        and_(
                            Meeting.product_id == product.id,
                            Meeting.scheduled_at == scheduled,
                        )
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                meetings_to_add.append(Meeting(
                    id=gen_uuid(),
                    product_id=product.id,
                    name=name,
                    meeting_type=meeting_type,
                    participants=["tunm1@ghn.vn"],
                    scheduled_at=scheduled,
                    status="upcoming" if scheduled >= start else "done",
                ))

        # Voice AI: daily 10am weekdays, weekly review Wed 3pm (separate meeting)
        voice_product = products.get("Voice AI")
        if voice_product:
            weekdays_10am = generate_weekday_dates(start.replace(hour=10, minute=0), 4)

            for day in weekdays_10am:
                scheduled = day  # 10am

                meeting_type = "daily"
                name = "Daily Standup — Voice AI"

                existing = await db.execute(
                    select(Meeting).where(
                        and_(
                            Meeting.product_id == voice_product.id,
                            Meeting.scheduled_at == scheduled,
                        )
                    )
                )
                if existing.scalar_one_or_none():
                    continue

                meetings_to_add.append(Meeting(
                    id=gen_uuid(),
                    product_id=voice_product.id,
                    name=name,
                    meeting_type=meeting_type,
                    participants=["tunm1@ghn.vn"],
                    scheduled_at=scheduled,
                    status="upcoming" if scheduled >= start else "done",
                ))

            # Seed Wednesday 3pm weekly reviews as separate meetings
            current_date = start.replace(hour=15, minute=0)
            end_date = start + timedelta(weeks=4)
            while current_date < end_date:
                if current_date.weekday() == 2:  # Wednesday
                    scheduled_wed = current_date
                    existing = await db.execute(
                        select(Meeting).where(
                            and_(
                                Meeting.product_id == voice_product.id,
                                Meeting.scheduled_at == scheduled_wed,
                            )
                        )
                    )
                    if not existing.scalar_one_or_none():
                        meetings_to_add.append(Meeting(
                            id=gen_uuid(),
                            product_id=voice_product.id,
                            name="Weekly Review — Voice AI",
                            meeting_type="review",
                            participants=["tunm1@ghn.vn"],
                            scheduled_at=scheduled_wed,
                            status="upcoming",
                        ))
                current_date += timedelta(days=1)
        else:
            print("Product 'Voice AI' not found, skipping")

        if meetings_to_add:
            db.add_all(meetings_to_add)
            await db.commit()
            print(f"Seeded {len(meetings_to_add)} meetings")
        else:
            print("No new meetings to seed (all already exist)")


if __name__ == "__main__":
    asyncio.run(seed())
