# Sprint Series Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Thay thế việc nhập tay `sprint_start_date` mỗi sprint bằng một "Sprint Series" cấu hình một lần — hệ thống tự tính sprint hiện tại và next sprint, generate meetings chỉ cần 1 click.

**Architecture:** Thêm bảng `sprint_configs` lưu `anchor_date` (Thứ 2 đầu tiên) + `sprint_length_weeks`. Backend expose `/api/sprint-configs` CRUD + `/api/sprint-configs/current` tính sprint hiện tại/tiếp theo. Frontend Settings page thêm "Sprint Series Config" panel thay thế ô date picker cũ. Backend `generate-meetings` được bổ sung validation Monday + optional `sprint_number` param.

**Tech Stack:** Python FastAPI + SQLAlchemy async + Alembic (backend), Next.js 15 + TypeScript + TailwindCSS (frontend)

---

## File Map

**Tạo mới:**
- `backend/models/sprint_config.py` — SQLAlchemy model
- `backend/schemas/sprint_config.py` — Pydantic schemas
- `backend/api/routes/sprint_configs.py` — Router với GET/POST/current
- `backend/alembic/versions/0019_sprint_configs.py` — Migration

**Sửa:**
- `backend/main.py` — import và register router mới
- `backend/api/routes/meeting_templates.py` — validate Monday + add sprint_number to meeting name
- `backend/schemas/meeting_template.py` — thêm `sprint_number` optional field vào `GenerateMeetingsRequest`
- `frontend/src/lib/types.ts` — thêm `SprintConfig`, `SprintInfo` interfaces
- `frontend/src/lib/api.ts` — thêm `sprintConfigs` client
- `frontend/src/app/settings/page.tsx` — thêm `SprintSeriesPanel` component, thay generate strip cũ

---

## Task 1: Backend model + migration

**Files:**
- Create: `backend/models/sprint_config.py`
- Create: `backend/alembic/versions/0019_sprint_configs.py`

- [ ] **Step 1: Tạo model**

```python
# backend/models/sprint_config.py
from __future__ import annotations
from typing import Optional, TYPE_CHECKING
from sqlalchemy import String, Date, Integer, DateTime, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from core.database import Base
from models.base import gen_uuid

if TYPE_CHECKING:
    from models.product import Product


class SprintConfig(Base):
    __tablename__ = "sprint_configs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[Optional[str]] = mapped_column(
        String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=True, index=True
    )
    anchor_date: Mapped[object] = mapped_column(Date, nullable=False)
    sprint_length_weeks: Mapped[int] = mapped_column(Integer, nullable=False, default=2)
    created_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[object] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )

    product: Mapped[Optional["Product"]] = relationship("Product", foreign_keys=[product_id])
```

- [ ] **Step 2: Tạo migration**

```python
# backend/alembic/versions/0019_sprint_configs.py
"""add sprint_configs table

Revision ID: 0019
Revises: 0018
Create Date: 2026-05-12
"""
from alembic import op
import sqlalchemy as sa

revision = '0019'
down_revision = '0018'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'sprint_configs',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('product_id', sa.String(36), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=True),
        sa.Column('anchor_date', sa.Date, nullable=False),
        sa.Column('sprint_length_weeks', sa.Integer, nullable=False, server_default='2'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_sprint_configs_product_id', 'sprint_configs', ['product_id'])


def downgrade() -> None:
    op.drop_index('ix_sprint_configs_product_id', 'sprint_configs')
    op.drop_table('sprint_configs')
```

- [ ] **Step 3: Chạy migration**

```bash
cd backend && python3 -m alembic upgrade head
```

Expected: `Running upgrade 0018 -> 0019, add sprint_configs table`

- [ ] **Step 4: Commit**

```bash
git add backend/models/sprint_config.py backend/alembic/versions/0019_sprint_configs.py
git commit -m "feat: add sprint_configs model and migration"
```

---

## Task 2: Backend schemas + router

**Files:**
- Create: `backend/schemas/sprint_config.py`
- Create: `backend/api/routes/sprint_configs.py`

- [ ] **Step 1: Tạo schemas**

```python
# backend/schemas/sprint_config.py
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date, datetime


class SprintConfigCreate(BaseModel):
    product_id: Optional[str] = None
    anchor_date: date
    sprint_length_weeks: int = 2

    @field_validator("anchor_date")
    @classmethod
    def must_be_monday(cls, v: date) -> date:
        if v.weekday() != 0:
            day_names = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
            raise ValueError(f"anchor_date phải là Thứ 2. Ngày {v} là {day_names[v.weekday()]}.")
        return v

    @field_validator("sprint_length_weeks")
    @classmethod
    def valid_length(cls, v: int) -> int:
        if v not in (2, 3, 4):
            raise ValueError("sprint_length_weeks phải là 2, 3 hoặc 4")
        return v


class SprintConfigOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    anchor_date: date
    sprint_length_weeks: int
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class SprintInfo(BaseModel):
    number: int
    start_date: date
    end_date: date


class SprintCurrentResponse(BaseModel):
    config_id: str
    product_id: Optional[str]
    anchor_date: date
    sprint_length_weeks: int
    current_sprint: SprintInfo
    next_sprint: SprintInfo
```

- [ ] **Step 2: Tạo router**

```python
# backend/api/routes/sprint_configs.py
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
    # Delete existing config for this product_id
    await db.execute(
        delete(SprintConfig).where(SprintConfig.product_id == body.product_id)
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
```

- [ ] **Step 3: Verify bằng tay**

```bash
cd backend && python3 -c "
from datetime import date, timedelta
anchor = date(2026, 4, 7)  # Thứ 2
length = 2
today = date(2026, 5, 12)
delta = (today - anchor).days
sprint_num = delta // (length * 7) + 1
print('Sprint number:', sprint_num)  # Expected: 3
start = anchor + timedelta(weeks=(sprint_num-1)*length)
print('Start:', start)  # Expected: 2026-04-21
end = start + timedelta(weeks=length) - timedelta(days=1)
print('End:', end)    # Expected: 2026-05-04
"
```

Expected output:
```
Sprint number: 3
Start: 2026-04-21
End: 2026-05-04
```

- [ ] **Step 4: Commit**

```bash
git add backend/schemas/sprint_config.py backend/api/routes/sprint_configs.py
git commit -m "feat: sprint config schemas and router"
```

---

## Task 3: Register router + update generate-meetings

**Files:**
- Modify: `backend/main.py`
- Modify: `backend/api/routes/meeting_templates.py`
- Modify: `backend/schemas/meeting_template.py`

- [ ] **Step 1: Register router trong main.py**

Trong `backend/main.py`, thêm `sprint_configs` vào import:

```python
from api.routes import issues, knowledge_base, jira_webhook, jira_workspace, telegram_webhook, upload, scoring, products, feedbacks, solutions, meetings, action_items, dashboard, auth_settings, priority_config, documents, meeting_templates, sprint_configs
```

Sau dòng `app.include_router(meeting_templates.router, prefix="/api")`, thêm:

```python
app.include_router(sprint_configs.router, prefix="/api")
```

- [ ] **Step 2: Thêm `sprint_number` vào `GenerateMeetingsRequest`**

Trong `backend/schemas/meeting_template.py`, sửa class `GenerateMeetingsRequest`:

```python
class GenerateMeetingsRequest(BaseModel):
    sprint_start_date: str  # ISO date, e.g. "2026-04-28" (Monday of week 1)
    product_id: Optional[str] = None  # filter templates by product, None = all
    sprint_number: Optional[int] = None  # if provided, included in meeting name
```

- [ ] **Step 3: Thêm validation Monday + sprint_number vào tên meeting**

Trong `backend/api/routes/meeting_templates.py`, trong hàm `generate_meetings`:

Thay đoạn comment `# sprint_start must be a Monday (weekday 0)`:

```python
    # sprint_start must be a Monday (weekday 0)
    if sprint_start.weekday() != 0:
        day_names = ["Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7", "Chủ nhật"]
        raise HTTPException(
            400,
            f"sprint_start_date phải là Thứ 2. Ngày {body.sprint_start_date} là {day_names[sprint_start.weekday()]}."
        )
```

Trong vòng lặp tạo meeting, thay dòng build `meeting_name`:

```python
            # Build meeting name: include sprint number and week label
            week_label = WEEK_LABELS.get(t.week_in_sprint, f"Tuần {t.week_in_sprint}")
            if t.week_in_sprint == 0:
                week_label = f"Tuần {sprint_week}"
            sprint_label = f" — Sprint {body.sprint_number}" if body.sprint_number else ""
            meeting_name = f"{t.name}{sprint_label} — {week_label}"
```

- [ ] **Step 4: Test endpoint thủ công**

Đảm bảo backend đang chạy:
```bash
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Test validate Monday:
```bash
curl -s -X POST http://localhost:8000/api/meeting-templates/generate-meetings \
  -H "Content-Type: application/json" \
  -d '{"sprint_start_date": "2026-05-13"}' | python3 -m json.tool
```
Expected: `{"detail": "sprint_start_date phải là Thứ 2. Ngày 2026-05-13 là Thứ 4."}`

Test sprint-configs current (trước khi có data → 404):
```bash
curl -s http://localhost:8000/api/sprint-configs/current | python3 -m json.tool
```
Expected: `{"detail": "Sprint config not found..."}`

- [ ] **Step 5: Commit**

```bash
git add backend/main.py backend/schemas/meeting_template.py backend/api/routes/meeting_templates.py
git commit -m "feat: register sprint_configs router, validate Monday, sprint_number in meeting name"
```

---

## Task 4: Frontend types + API client

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Thêm types**

Trong `frontend/src/lib/types.ts`, sau interface `MeetingTemplate` (dòng 266), thêm:

```typescript
export interface SprintConfig {
  id: string;
  product_id: string | null;
  anchor_date: string; // "YYYY-MM-DD"
  sprint_length_weeks: number;
  created_at: string;
  updated_at: string;
}

export interface SprintInfo {
  number: number;
  start_date: string; // "YYYY-MM-DD"
  end_date: string;
}

export interface SprintCurrentResponse {
  config_id: string;
  product_id: string | null;
  anchor_date: string;
  sprint_length_weeks: number;
  current_sprint: SprintInfo;
  next_sprint: SprintInfo;
}
```

- [ ] **Step 2: Thêm API client**

Trong `frontend/src/lib/api.ts`, sau block `meetingTemplates` (trước `documents`), thêm:

```typescript
  sprintConfigs: {
    list: (product_id?: string) =>
      request<SprintConfig[]>(`/api/sprint-configs${product_id ? `?product_id=${product_id}` : ""}`),
    upsert: (body: { product_id?: string | null; anchor_date: string; sprint_length_weeks: number }) =>
      request<SprintConfig>("/api/sprint-configs", { method: "POST", body: JSON.stringify(body) }),
    current: (product_id?: string) =>
      request<SprintCurrentResponse>(`/api/sprint-configs/current${product_id ? `?product_id=${product_id}` : ""}`),
  },
```

Thêm import type ở đầu file (nếu chưa có — check xem types.ts có export `SprintConfig` chưa):

```typescript
import type { SprintConfig, SprintCurrentResponse } from "@/lib/types";
```

Lưu ý: `api.ts` hiện dùng `request<any>` pattern — đảm bảo import types nếu file dùng strict typing, hoặc dùng `request<any>` như các methods khác nếu file chưa import types.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: SprintConfig types and API client"
```

---

