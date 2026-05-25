#!/usr/bin/env python3
"""One-time import script for B2C bug CSV into the feedbacks table.

Usage:
    cd backend
    python ../scripts/import_b2c_bugs.py ../scripts/data/b2c_bugs.csv
"""
from __future__ import annotations
import asyncio
import csv
import re
import sys
from datetime import date, datetime
from pathlib import Path
from typing import Optional

# Allow importing backend modules
sys.path.insert(0, str(Path(__file__).parent.parent / "backend"))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / "backend" / ".env")

from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from core.config import get_settings
from models.feedback import Feedback
from models.feedback_analysis import FeedbackAnalysis
from models.base import gen_uuid

STATUS_MAP = {
    "following": "evaluating",
    "done": "done",
    "to-do": "draft",
    "todo": "draft",
    "cancel": "draft",
    "": "draft",
}

TYPE_MAP = {
    "bug": "bug",
    "feature": "feature",
    "feature request": "feature",
}


def _parse_status(raw: str) -> str:
    return STATUS_MAP.get(raw.strip().lower(), "draft")


def _parse_type(raw: str) -> str:
    return TYPE_MAP.get(raw.strip().lower(), "unclear")


def _parse_date(raw: str) -> Optional[date]:
    raw = raw.strip()
    if not raw or raw.lower() in ("tuần sau", "dự kiến 2 tuần có bản test"):
        return None
    # DD/MM/YYYY or DD/MM
    m = re.match(r"^(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$", raw)
    if m:
        day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3) or 2026)
        try:
            return date(year, month, day)
        except ValueError:
            return None
    return None


def _parse_int(raw: str) -> Optional[int]:
    raw = raw.strip().replace(",", ".")
    try:
        return int(float(raw))
    except (ValueError, TypeError):
        return None


def _parse_float(raw: str) -> Optional[float]:
    raw = raw.strip().replace(",", ".")
    try:
        return float(raw)
    except (ValueError, TypeError):
        return None


def _parse_media(raw: str) -> Optional[list]:
    raw = raw.strip()
    if not raw:
        return None
    parts = [p.strip() for p in re.split(r"[\n,]+", raw) if p.strip()]
    return parts if parts else None


def _parse_created_at(raw: str) -> Optional[datetime]:
    raw = raw.strip()
    for fmt in ("%d/%m/%Y", "%d/%m/%y"):
        try:
            return datetime.strptime(raw, fmt)
        except ValueError:
            continue
    return None


async def find_product_id(session: AsyncSession, keyword: str = "CS AI") -> str:
    result = await session.execute(
        text("SELECT id, name FROM products WHERE name ILIKE :kw LIMIT 5"),
        {"kw": f"%{keyword}%"},
    )
    rows = result.fetchall()
    if not rows:
        raise RuntimeError(f"No product found matching '%{keyword}%'. Check DB.")
    if len(rows) > 1:
        names = ", ".join(f"{r.name!r} ({r.id})" for r in rows)
        raise RuntimeError(f"Multiple products matched: {names}. Narrow the keyword.")
    product_id = rows[0].id
    print(f"Product found: {rows[0].name!r} → {product_id}")
    return product_id


async def import_csv(csv_path: str) -> None:
    settings = get_settings()
    engine = create_async_engine(settings.normalize_db_url(), echo=False)
    Session = async_sessionmaker(engine, expire_on_commit=False, class_=AsyncSession)

    async with Session() as session:
        product_id = await find_product_id(session)

        with open(csv_path, newline="", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            rows = list(reader)

        inserted = 0
        skipped = 0

        for i, row in enumerate(rows, start=2):  # row 2 = first data row
            raw_content = row.get("Mô tả - text", "").strip()
            if not raw_content:
                print(f"  Row {i}: skipped — empty raw_content")
                skipped += 1
                continue

            fb = Feedback(
                id=gen_uuid(),
                product_id=product_id,
                raw_content=raw_content,
                media_urls=_parse_media(row.get("Mô tả - image", "")),
                submitted_by=row.get("PIC", "").strip() or None,
                source="manual",
                team="B2C",
                feedback_type=_parse_type(row.get("Loại yêu cầu", "")),
                status=_parse_status(row.get("Status", "")),
                deadline=_parse_date(row.get("Deadline", "")),
                priority_score=_parse_float(row.get("Tổng điểm ưu tiên", "")),
                tu_danh_gia=_parse_int(row.get("Tú đánh giá ( 10 là quan trọng nhất", "") or row.get("Tú đánh giá", "")),
                tu_danh_gia_note=row.get("Nguyên nhân ( Tú phân tích )", "").strip() or None,
                user_priority=_parse_int(row.get("User đánh giá ( 10 là quan trọng nhất", "") or row.get("User đánh giá", "")),
                user_priority_note=row.get("User note", "").strip() or None,
                tech_rating=_parse_int(row.get("Dev đánh giá ( 10 là làm nhanh nhất )", "") or row.get("Dev đánh giá", "")),
            )

            # Override created_at if parseable
            created_at = _parse_created_at(row.get("Ngày tạo", ""))
            if created_at:
                fb.created_at = created_at

            session.add(fb)

            # FeedbackAnalysis — only if there's meaningful data
            root_cause = row.get("Nguyên nhân ( Tú phân tích )", "").strip() or None
            solution_hint = row.get("Hướng giải quyết ( Tú đề xuất )", "").strip() or None
            if root_cause or solution_hint:
                analysis = FeedbackAnalysis(
                    id=gen_uuid(),
                    feedback_id=fb.id,
                    root_cause=root_cause,
                    solution_hint=solution_hint,
                )
                session.add(analysis)

            inserted += 1

        await session.commit()

    print(f"\nDone: {inserted} inserted, {skipped} skipped.")
    await engine.dispose()


if __name__ == "__main__":
    if len(sys.argv) != 2:
        print(f"Usage: python {sys.argv[0]} <path_to_csv>")
        sys.exit(1)
    asyncio.run(import_csv(sys.argv[1]))
