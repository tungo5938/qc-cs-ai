# Feedback Modal Edit + Jira Creation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cho phép edit tiêu đề/nội dung/phân tích trong FeedbackDetailModal, thêm section "Hướng giải quyết" có AI, và nút tạo Jira ticket với preview panel đầy đủ.

**Architecture:** Thêm 2 cột DB vào `feedback_analyses`, thêm 4 API endpoints mới trên backend FastAPI, mở rộng `jira_service` với các helper Jira API 3, và cập nhật `FeedbackDetailModal` trong frontend với inline-edit và Jira preview panel.

**Tech Stack:** Python FastAPI, SQLAlchemy async, Alembic, OpenAI gpt-4o, Jira REST API v3, Next.js 15, TypeScript, TailwindCSS

---

## File Map

**Backend — Create:**
- `backend/alembic/versions/0014_feedback_analysis_solution.py` — migration thêm `solution_hint`, `acceptance_criteria`

**Backend — Modify:**
- `backend/models/feedback_analysis.py` — thêm 2 cột mới
- `backend/schemas/feedback.py` — mở rộng `FeedbackUpdate`, thêm `AnalysisUpdate`, `CreateJiraBody`, `FeedbackOut` thêm `solution_id`
- `backend/api/routes/feedbacks.py` — mở rộng PATCH `/feedbacks/{id}`, thêm 4 endpoints mới
- `backend/services/ai_service.py` — thêm `generate_solution_hint()`, `generate_acceptance_criteria()`
- `backend/services/jira_service.py` — thêm `create_ticket_full()`, `lookup_user_account_id()`, `lookup_sprint_id()`, `upload_attachment()`

**Frontend — Modify:**
- `frontend/src/lib/types.ts` — extend `FeedbackAnalysis`, thêm `JiraDraft`
- `frontend/src/lib/api.ts` — thêm methods mới vào `feedbacks`
- `frontend/src/app/feedback/page.tsx` — thêm `InlineTextEdit`, `JiraPreviewPanel`, cập nhật `FeedbackDetailModal`

---

## Task 1: DB Migration — thêm solution_hint + acceptance_criteria

**Files:**
- Create: `backend/alembic/versions/0014_feedback_analysis_solution.py`
- Modify: `backend/models/feedback_analysis.py`

- [ ] **Step 1: Tạo file migration**

```python
# backend/alembic/versions/0014_feedback_analysis_solution.py
"""add solution_hint and acceptance_criteria to feedback_analyses

Revision ID: 0014
Revises: 0013
Create Date: 2026-04-16
"""
from alembic import op
import sqlalchemy as sa

revision = '0014'
down_revision = '0013'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('feedback_analyses', sa.Column('solution_hint', sa.Text(), nullable=True))
    op.add_column('feedback_analyses', sa.Column('acceptance_criteria', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('feedback_analyses', 'acceptance_criteria')
    op.drop_column('feedback_analyses', 'solution_hint')
```

- [ ] **Step 2: Cập nhật ORM model**

Mở `backend/models/feedback_analysis.py`, thêm 2 dòng sau dòng `ai_raw`:

```python
    solution_hint: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    acceptance_criteria: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
```

- [ ] **Step 3: Chạy migration**

```bash
cd backend && python3 -m alembic upgrade head
```

Expected output: `Running upgrade 0013 -> 0014, add solution_hint and acceptance_criteria to feedback_analyses`

- [ ] **Step 4: Verify migration**

```bash
cd backend && python3 -c "
from sqlalchemy import create_engine, inspect, text
import asyncio
from core.config import get_settings
s = get_settings()
engine = create_engine(s.database_url.replace('+asyncpg', ''))
insp = inspect(engine)
cols = [c['name'] for c in insp.get_columns('feedback_analyses')]
assert 'solution_hint' in cols, 'solution_hint missing'
assert 'acceptance_criteria' in cols, 'acceptance_criteria missing'
print('OK:', cols)
"
```

Expected: `OK: [..., 'solution_hint', 'acceptance_criteria']`

- [ ] **Step 5: Commit**

```bash
git add backend/alembic/versions/0014_feedback_analysis_solution.py backend/models/feedback_analysis.py
git commit -m "feat: add solution_hint + acceptance_criteria columns to feedback_analyses"
```

---

## Task 2: Backend — Cập nhật schemas + FeedbackOut

**Files:**
- Modify: `backend/schemas/feedback.py`

- [ ] **Step 1: Mở rộng FeedbackAnalysisOut và FeedbackUpdate, thêm AnalysisUpdate + CreateJiraBody**

Thay toàn bộ `backend/schemas/feedback.py`:

```python
from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class FeedbackAnalysisOut(BaseModel):
    id: str
    feedback_id: str
    root_cause: Optional[str] = None
    impact_level: Optional[str] = None
    affected_area: Optional[str] = None
    kb_references: Optional[list] = None
    solution_hint: Optional[str] = None
    acceptance_criteria: Optional[str] = None
    ai_raw: Optional[dict] = None
    created_at: datetime

    class Config:
        from_attributes = True


class FeedbackOut(BaseModel):
    id: str
    product_id: str
    product_name: Optional[str] = None
    title: Optional[str] = None
    raw_content: str
    media_urls: Optional[list] = None
    submitted_by: Optional[str] = None
    source: str
    status: str
    telegram_message_id: Optional[str] = None
    telegram_group_id: Optional[str] = None
    gsheet_row_index: Optional[int] = None
    feedback_type: Optional[str] = None
    user_priority: Optional[int] = None
    tu_danh_gia: Optional[int] = None
    tech_rating: Optional[int] = None
    priority_score: Optional[float] = None
    solution_id: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    analysis: Optional[FeedbackAnalysisOut] = None

    class Config:
        from_attributes = True


class FeedbackCreate(BaseModel):
    product_id: str
    raw_content: str
    media_urls: Optional[list] = None
    submitted_by: Optional[str] = None


class FeedbackUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    raw_content: Optional[str] = None


class AnalysisUpdate(BaseModel):
    root_cause: Optional[str] = None
    solution_hint: Optional[str] = None


class CreateJiraBody(BaseModel):
    title: str
    raw_content: str
    root_cause: Optional[str] = None
    solution_hint: Optional[str] = None
    acceptance_criteria: str
    sprint_name: Optional[str] = None
    upload_attachments: bool = True
```

- [ ] **Step 2: Verify import không lỗi**

```bash
cd backend && python3 -c "from schemas.feedback import FeedbackOut, AnalysisUpdate, CreateJiraBody; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/schemas/feedback.py
git commit -m "feat: extend feedback schemas — AnalysisUpdate, CreateJiraBody, solution_hint in FeedbackAnalysisOut"
```

---

## Task 3: Backend — AI service thêm generate_solution_hint + generate_acceptance_criteria

**Files:**
- Modify: `backend/services/ai_service.py`

- [ ] **Step 1: Thêm 2 hàm AI vào cuối file `backend/services/ai_service.py`**

```python
GENERATE_SOLUTION_HINT_SYSTEM = """Bạn là AI hỗ trợ PM tại GHN đề xuất hướng giải quyết cho feedback sản phẩm.
Dựa trên thông tin feedback và phân tích, đề xuất hướng giải quyết ngắn gọn, thực tế, bằng tiếng Việt.
Tối đa 300 ký tự. Chỉ trả về nội dung hướng giải quyết, không giải thích thêm."""

GENERATE_AC_SYSTEM = """Bạn là AI hỗ trợ PM tại GHN viết Acceptance Criteria (AC) cho Jira ticket.
Dựa trên hướng giải quyết được cung cấp, tạo danh sách AC rõ ràng, kiểm thử được, bằng tiếng Việt.
Định dạng: mỗi AC một dòng bắt đầu bằng "- ".
Tối đa 5 AC. Chỉ trả về danh sách AC, không giải thích thêm."""


async def generate_solution_hint(
    raw_content: str,
    root_cause: Optional[str],
    impact_level: Optional[str],
    affected_area: Optional[str],
    product_name: str = "",
    product_goal: str = "",
) -> str:
    """Generate solution hint using GPT-4o. Returns plain text."""
    system = GENERATE_SOLUTION_HINT_SYSTEM
    if product_goal:
        system = f"Mục tiêu sản phẩm: {product_goal}\n\n" + system
    user_prompt = f"Sản phẩm: {product_name}\n\nFeedback: {raw_content}\n\nNguyên nhân: {root_cause or 'chưa xác định'}\nMức độ: {impact_level or 'medium'}\nKhu vực: {affected_area or 'other'}"
    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=256,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Lỗi khi tạo hướng giải quyết: {e}"


async def generate_acceptance_criteria(solution_hint: str) -> str:
    """Generate acceptance criteria from solution hint using GPT-4o. Returns plain text list."""
    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=512,
            messages=[
                {"role": "system", "content": GENERATE_AC_SYSTEM},
                {"role": "user", "content": f"Hướng giải quyết: {solution_hint}"},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Lỗi khi tạo AC: {e}"
```

- [ ] **Step 2: Verify import**

```bash
cd backend && python3 -c "from services.ai_service import generate_solution_hint, generate_acceptance_criteria; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/services/ai_service.py
git commit -m "feat: add generate_solution_hint + generate_acceptance_criteria to ai_service"
```

---

## Task 4: Backend — Mở rộng jira_service

**Files:**
- Modify: `backend/services/jira_service.py`

- [ ] **Step 1: Thêm helper functions và `create_ticket_full` vào `backend/services/jira_service.py`**

Thêm vào cuối file (trước hàm `_extract_adf_text`):

```python
def _build_adf_document(sections: list[tuple[str, str]]) -> dict:
    """Build Atlassian Document Format doc from (heading, body) tuples."""
    content = []
    for heading, body in sections:
        if heading:
            content.append({
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": heading}]
            })
        if body:
            for paragraph in body.split("\n"):
                paragraph = paragraph.strip()
                if not paragraph:
                    continue
                content.append({
                    "type": "paragraph",
                    "content": [{"type": "text", "text": paragraph}]
                })
    return {"type": "doc", "version": 1, "content": content}


async def lookup_user_account_id(email: str) -> Optional[str]:
    """Lookup Jira user accountId by email. Returns None if not found."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_email or not settings.jira_api_token:
        return None
    url = f"https://{settings.jira_domain}/rest/api/3/user/search"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, params={"query": email}, headers=_auth_header())
    if r.status_code != 200:
        return None
    users = r.json()
    if not users:
        return None
    return users[0].get("accountId")


async def lookup_sprint_id(board_id: int, sprint_name: str) -> Optional[int]:
    """Lookup sprint ID by name on a board. Returns None if not found."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_api_token:
        return None
    url = f"https://{settings.jira_domain}/rest/agile/1.0/board/{board_id}/sprint"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, params={"state": "active,future", "maxResults": 50}, headers=_auth_header())
    if r.status_code != 200:
        return None
    sprints = r.json().get("values", [])
    name_lower = sprint_name.lower()
    for sprint in sprints:
        if name_lower in sprint.get("name", "").lower():
            return sprint["id"]
    return None


async def upload_attachment(ticket_key: str, image_url: str) -> bool:
    """Download image from URL and upload as Jira attachment. Returns True on success."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_email or not settings.jira_api_token:
        return False
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            img_resp = await client.get(image_url)
            if img_resp.status_code != 200:
                return False
            content_type = img_resp.headers.get("content-type", "image/jpeg")
            filename = image_url.split("/")[-1].split("?")[0] or "attachment.jpg"
            auth_header = _auth_header()
            auth_header.pop("Content-Type", None)
            auth_header["X-Atlassian-Token"] = "no-check"
            upload_url = f"https://{settings.jira_domain}/rest/api/3/issue/{ticket_key}/attachments"
            r = await client.post(
                upload_url,
                headers=auth_header,
                files={"file": (filename, img_resp.content, content_type)},
            )
        return r.status_code == 200
    except Exception as e:
        print(f"[jira_service] upload_attachment failed: {e}")
        return False


async def create_ticket_full(
    project_key: str,
    title: str,
    raw_content: str,
    root_cause: Optional[str],
    solution_hint: Optional[str],
    acceptance_criteria: Optional[str],
    assignee_account_id: Optional[str] = None,
    epic_key: str = "GB-488",
    sprint_id: Optional[int] = None,
    issue_type: str = "Story",
) -> dict:
    """Create a Jira ticket with full ADF description, epic link, sprint, and assignee."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_email or not settings.jira_api_token:
        raise ValueError("Jira credentials not configured")

    sections = [
        ("Nội dung gốc", raw_content or ""),
        ("Kết quả phân tích", root_cause or ""),
        ("Hướng giải quyết", solution_hint or ""),
        ("Acceptance Criteria", acceptance_criteria or ""),
    ]
    description_adf = _build_adf_document(sections)

    fields: dict = {
        "project": {"key": project_key},
        "summary": title,
        "description": description_adf,
        "issuetype": {"name": issue_type},
        "customfield_10014": epic_key,  # Epic Link (Next-gen)
    }
    if assignee_account_id:
        fields["assignee"] = {"accountId": assignee_account_id}
    if sprint_id:
        fields["customfield_10020"] = sprint_id  # Sprint field

    url = f"https://{settings.jira_domain}/rest/api/3/issue"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json={"fields": fields}, headers=_auth_header())
    r.raise_for_status()
    data = r.json()
    return {"key": data["key"], "url": f"https://{settings.jira_domain}/browse/{data['key']}"}
```

- [ ] **Step 2: Verify import**

```bash
cd backend && python3 -c "from services.jira_service import create_ticket_full, lookup_user_account_id, lookup_sprint_id, upload_attachment; print('OK')"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/services/jira_service.py
git commit -m "feat: add create_ticket_full, lookup_user_account_id, lookup_sprint_id, upload_attachment to jira_service"
```

---

## Task 5: Backend — Thêm 4 endpoints mới vào feedbacks router

**Files:**
- Modify: `backend/api/routes/feedbacks.py`

- [ ] **Step 1: Mở rộng PATCH `/feedbacks/{id}` — hỗ trợ edit title + raw_content**

Tìm hàm cuối cùng trong file (sau `sync_sheet`), thêm các routes sau:

```python
@router.patch("/{feedback_id}")
async def update_feedback(
    feedback_id: str,
    body: FeedbackUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Edit title and/or raw_content of a feedback."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    if body.title is not None:
        feedback.title = body.title
    if body.raw_content is not None:
        feedback.raw_content = body.raw_content
    if body.status is not None:
        feedback.status = body.status
    await db.commit()
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return FeedbackOut.model_validate(feedback).model_dump()


@router.patch("/{feedback_id}/analysis")
async def update_analysis(
    feedback_id: str,
    body: AnalysisUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Edit root_cause and/or solution_hint in FeedbackAnalysis."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    if not feedback.analysis:
        raise HTTPException(404, "Analysis not found — run analyze first")
    if body.root_cause is not None:
        feedback.analysis.root_cause = body.root_cause
    if body.solution_hint is not None:
        feedback.analysis.solution_hint = body.solution_hint
    await db.commit()
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return FeedbackOut.model_validate(feedback).model_dump()


@router.post("/{feedback_id}/generate-solution")
async def generate_solution(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    """AI-generate solution_hint and save to FeedbackAnalysis."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")

    product_name = product_goal = ""
    if feedback.product_id:
        product = await db.get(Product, feedback.product_id)
        if product:
            product_name = product.name
            product_goal = product.product_goal or ""

    root_cause = feedback.analysis.root_cause if feedback.analysis else None
    impact_level = feedback.analysis.impact_level if feedback.analysis else None
    affected_area = feedback.analysis.affected_area if feedback.analysis else None

    hint = await ai_service.generate_solution_hint(
        raw_content=feedback.raw_content,
        root_cause=root_cause,
        impact_level=impact_level,
        affected_area=affected_area,
        product_name=product_name,
        product_goal=product_goal,
    )

    if feedback.analysis:
        feedback.analysis.solution_hint = hint
    else:
        db.add(FeedbackAnalysis(
            id=gen_uuid(),
            feedback_id=feedback.id,
            solution_hint=hint,
        ))

    await db.commit()
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return FeedbackOut.model_validate(feedback).model_dump()


@router.post("/{feedback_id}/generate-ac")
async def generate_ac(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    """AI-generate acceptance criteria from solution_hint. Returns plain text, does NOT save to DB."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    solution_hint = (feedback.analysis.solution_hint if feedback.analysis else None) or ""
    if not solution_hint:
        raise HTTPException(400, "solution_hint is empty — generate solution first")
    ac = await ai_service.generate_acceptance_criteria(solution_hint)
    return {"acceptance_criteria": ac}


@router.post("/{feedback_id}/create-jira")
async def create_jira_ticket(
    feedback_id: str,
    body: CreateJiraBody,
    db: AsyncSession = Depends(get_db),
):
    """Create a Jira ticket from feedback data. Uploads attachments if requested."""
    from services import jira_service
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")

    # Lookup assignee accountId
    assignee_id = await jira_service.lookup_user_account_id("tunm1@ghn.vn")

    # Lookup sprint ID
    sprint_id = None
    if body.sprint_name:
        sprint_id = await jira_service.lookup_sprint_id(board_id=18, sprint_name=body.sprint_name)

    try:
        ticket = await jira_service.create_ticket_full(
            project_key="GB",
            title=body.title,
            raw_content=body.raw_content,
            root_cause=body.root_cause,
            solution_hint=body.solution_hint,
            acceptance_criteria=body.acceptance_criteria,
            assignee_account_id=assignee_id,
            epic_key="GB-488",
            sprint_id=sprint_id,
            issue_type="Story",
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Jira API error: {e}")

    # Upload attachments
    if body.upload_attachments and feedback.media_urls:
        for url in feedback.media_urls:
            await jira_service.upload_attachment(ticket["key"], url)

    return ticket
```

- [ ] **Step 2: Thêm import `AnalysisUpdate, CreateJiraBody` vào đầu file feedbacks.py**

Tìm dòng `from schemas.feedback import FeedbackOut, FeedbackCreate, FeedbackUpdate` và thay thành:

```python
from schemas.feedback import FeedbackOut, FeedbackCreate, FeedbackUpdate, AnalysisUpdate, CreateJiraBody
```

Cũng thêm import `FeedbackAnalysis` nếu chưa có:
```python
from models.feedback_analysis import FeedbackAnalysis
```

- [ ] **Step 3: Verify server khởi động không lỗi**

```bash
cd backend && python3 -c "from api.routes.feedbacks import router; print('OK — routes:', [r.path for r in router.routes])"
```

Expected: Output có `/feedbacks/{feedback_id}`, `/feedbacks/{feedback_id}/analysis`, `/feedbacks/{feedback_id}/generate-solution`, `/feedbacks/{feedback_id}/generate-ac`, `/feedbacks/{feedback_id}/create-jira`

- [ ] **Step 4: Commit**

```bash
git add backend/api/routes/feedbacks.py
git commit -m "feat: add PATCH feedback, PATCH analysis, generate-solution, generate-ac, create-jira endpoints"
```

---

## Task 6: Frontend — Cập nhật types.ts + api.ts

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Cập nhật `FeedbackAnalysis` và thêm `JiraDraft` trong `frontend/src/lib/types.ts`**

Tìm interface `FeedbackAnalysis` (dòng ~105) và thay thành:

```typescript
export interface FeedbackAnalysis {
  root_cause: string;
  impact_level: ImpactLevel;
  affected_area: string;
  kb_references: string[];
  solution_hint?: string | null;
  acceptance_criteria?: string | null;
}

export interface JiraDraft {
  title: string;
  acceptance_criteria: string;
  sprint_name: string;
}
```

- [ ] **Step 2: Thêm methods mới vào `feedbacks` trong `frontend/src/lib/api.ts`**

Tìm `feedbacks: {` block (dòng ~83), thêm vào cuối block (trước dấu `}`):

```typescript
    update: (id: string, body: { title?: string; raw_content?: string }) =>
      request<any>(`/api/feedbacks/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    updateAnalysis: (id: string, body: { root_cause?: string; solution_hint?: string }) =>
      request<any>(`/api/feedbacks/${id}/analysis`, { method: "PATCH", body: JSON.stringify(body) }),
    generateSolution: (id: string) =>
      request<any>(`/api/feedbacks/${id}/generate-solution`, { method: "POST" }),
    generateAC: (id: string) =>
      request<{ acceptance_criteria: string }>(`/api/feedbacks/${id}/generate-ac`, { method: "POST" }),
    createJira: (id: string, body: { title: string; raw_content: string; root_cause?: string; solution_hint?: string; acceptance_criteria: string; sprint_name?: string; upload_attachments?: boolean }) =>
      request<{ key: string; url: string }>(`/api/feedbacks/${id}/create-jira`, { method: "POST", body: JSON.stringify(body) }),
```

- [ ] **Step 3: Verify TypeScript compile**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: update FeedbackAnalysis type + add JiraDraft, extend feedbacks api client"
```

---

## Task 7: Frontend — Thêm InlineTextEdit component + Cập nhật FeedbackDetailModal (edit fields)

**Files:**
- Modify: `frontend/src/app/feedback/page.tsx`

- [ ] **Step 1: Thêm `InlineTextEdit` component ngay trước `FeedbackDetailModal` (khoảng dòng 199)**

```typescript
// ── Inline text edit ─────────────────────────────────────────────────────────
function InlineTextEdit({
  label,
  value,
  onSave,
  multiline = false,
  placeholder = "Chưa có nội dung...",
}: {
  label: string;
  value: string | null | undefined;
  onSave: (v: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [saving, setSaving] = useState(false);

  useEffect(() => { setDraft(value ?? ""); }, [value]);

  async function submit() {
    if (draft === (value ?? "")) { setEditing(false); return; }
    setSaving(true);
    try {
      await onSave(draft);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="space-y-1.5">
        {label && <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>}
        {multiline ? (
          <textarea
            autoFocus
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={4}
            className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
          />
        ) : (
          <input
            autoFocus
            type="text"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter") submit(); if (e.key === "Escape") setEditing(false); }}
            className="w-full text-sm border border-blue-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        )}
        <div className="flex gap-2">
          <button onClick={submit} disabled={saving} className="text-xs px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? "Đang lưu..." : "✓ Lưu"}
          </button>
          <button onClick={() => { setEditing(false); setDraft(value ?? ""); }} className="text-xs px-3 py-1 border border-gray-200 text-gray-600 rounded-md hover:bg-gray-50">
            Huỷ
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {label && <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>}
      <button
        onClick={() => setEditing(true)}
        className="text-left w-full text-sm text-gray-800 whitespace-pre-wrap leading-relaxed hover:bg-gray-50 rounded-lg px-2 py-1 -mx-2 transition group"
        title="Click để chỉnh sửa"
      >
        {value ? (
          <span>{value}</span>
        ) : (
          <span className="text-gray-300 italic">{placeholder}</span>
        )}
        <span className="ml-1 text-gray-300 group-hover:text-gray-400 text-xs">✏️</span>
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Trong `FeedbackDetailModal` — thêm state cho solution + jira panel**

Tìm dòng `const [zoomUrl, setZoomUrl] = useState<string | null>(null);` (khoảng dòng 212) và thêm sau:

```typescript
  const [generatingSolution, setGeneratingSolution] = useState(false);
  const [showJiraPanel, setShowJiraPanel] = useState(false);
  const [jiraDraft, setJiraDraft] = useState<{ title: string; acceptance_criteria: string; sprint_name: string } | null>(null);
  const [preparingJira, setPreparingJira] = useState(false);
  const [creatingJira, setCreatingJira] = useState(false);
  const [jiraResult, setJiraResult] = useState<{ key: string; url: string } | null>(null);
```

- [ ] **Step 3: Thêm handler functions vào `FeedbackDetailModal` — sau `saveRating`**

Tìm dòng `async function saveRating` và thêm sau block đó:

```typescript
  async function saveTitle(v: string) {
    if (!fb) return;
    const updated = await api.feedbacks.update(fb.id, { title: v });
    setFb(updated as Feedback);
    onUpdated(updated as Feedback);
  }

  async function saveRawContent(v: string) {
    if (!fb) return;
    const updated = await api.feedbacks.update(fb.id, { raw_content: v });
    setFb(updated as Feedback);
    onUpdated(updated as Feedback);
  }

  async function saveRootCause(v: string) {
    if (!fb) return;
    const updated = await api.feedbacks.updateAnalysis(fb.id, { root_cause: v });
    setFb(updated as Feedback);
    onUpdated(updated as Feedback);
  }

  async function saveSolutionHint(v: string) {
    if (!fb) return;
    const updated = await api.feedbacks.updateAnalysis(fb.id, { solution_hint: v });
    setFb(updated as Feedback);
    onUpdated(updated as Feedback);
  }

  async function handleGenerateSolution() {
    if (!fb) return;
    setGeneratingSolution(true);
    try {
      const updated = await api.feedbacks.generateSolution(fb.id);
      setFb(updated as Feedback);
      onUpdated(updated as Feedback);
    } finally {
      setGeneratingSolution(false);
    }
  }

  async function handleOpenJiraPanel() {
    if (!fb) return;
    setPreparingJira(true);
    try {
      let currentFb = fb;
      // Generate solution if missing
      if (!currentFb.analysis?.solution_hint) {
        const updated = await api.feedbacks.generateSolution(fb.id);
        currentFb = updated as Feedback;
        setFb(currentFb);
        onUpdated(currentFb);
      }
      // Generate AC
      const { acceptance_criteria } = await api.feedbacks.generateAC(currentFb.id);
      setJiraDraft({
        title: currentFb.title ?? currentFb.raw_content.slice(0, 80),
        acceptance_criteria,
        sprint_name: "",
      });
      setShowJiraPanel(true);
      setJiraResult(null);
    } finally {
      setPreparingJira(false);
    }
  }

  async function handleCreateJira() {
    if (!fb || !jiraDraft) return;
    setCreatingJira(true);
    try {
      const result = await api.feedbacks.createJira(fb.id, {
        title: jiraDraft.title,
        raw_content: fb.raw_content,
        root_cause: fb.analysis?.root_cause ?? undefined,
        solution_hint: fb.analysis?.solution_hint ?? undefined,
        acceptance_criteria: jiraDraft.acceptance_criteria,
        sprint_name: jiraDraft.sprint_name || undefined,
        upload_attachments: true,
      });
      setJiraResult(result);
    } finally {
      setCreatingJira(false);
    }
  }
```

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/feedback/page.tsx
git commit -m "feat: add InlineTextEdit, solution/jira state and handlers to FeedbackDetailModal"
```

---

## Task 8: Frontend — Cập nhật LEFT panel trong FeedbackDetailModal

**Files:**
- Modify: `frontend/src/app/feedback/page.tsx`

- [ ] **Step 1: Thay thế block "Raw content" trong LEFT panel**

Tìm block comment `{/* Raw content */}` trong FeedbackDetailModal (khoảng dòng 325):

```tsx
                {/* Raw content */}
                <div>
                  <p className="text-xs font-medium text-gray-400 uppercase tracking-wide mb-1.5">Nội dung gốc</p>
                  <p className="text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">{fb.raw_content}</p>
                </div>
```

Thay thành:

```tsx
                {/* Title inline edit */}
                {fb.title && (
                  <InlineTextEdit
                    label="Tiêu đề"
                    value={fb.title}
                    onSave={saveTitle}
                  />
                )}

                {/* Raw content inline edit */}
                <InlineTextEdit
                  label="Nội dung gốc"
                  value={fb.raw_content}
                  onSave={saveRawContent}
                  multiline
                />
```

- [ ] **Step 2: Thay thế block Analysis để root_cause có thể edit**

Tìm block `{/* Analysis */}` (khoảng dòng 346):

```tsx
                {/* Analysis */}
                {fb.analysis && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Kết quả phân tích AI</p>
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Nguyên nhân gốc rễ</p>
                      <p className="text-sm text-gray-800">{fb.analysis.root_cause}</p>
                    </div>
```

Thay thành:

```tsx
                {/* Analysis */}
                {fb.analysis && (
                  <div className="space-y-3">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Kết quả phân tích AI</p>
                    <InlineTextEdit
                      label="Nguyên nhân gốc rễ"
                      value={fb.analysis.root_cause}
                      onSave={saveRootCause}
                      multiline
                    />
```

- [ ] **Step 3: Thêm section "Hướng giải quyết" sau block analysis (trước solution link)**

Tìm block `{/* Solution link */}` (khoảng dòng 368) và thêm TRƯỚC nó:

```tsx
                {/* Hướng giải quyết */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hướng giải quyết</p>
                    <button
                      onClick={handleGenerateSolution}
                      disabled={generatingSolution}
                      className="text-xs px-2 py-0.5 rounded-md bg-purple-100 text-purple-700 hover:bg-purple-200 transition disabled:opacity-50"
                    >
                      {generatingSolution ? "Đang tạo..." : "✨ AI"}
                    </button>
                  </div>
                  <InlineTextEdit
                    label=""
                    value={fb.analysis?.solution_hint}
                    onSave={saveSolutionHint}
                    multiline
                    placeholder="Chưa có hướng giải quyết. Bấm ✨ AI để tạo tự động."
                  />
                </div>
```

- [ ] **Step 4: Thêm button "Tạo Jira ticket" trước block "Mở trang riêng"**

Tìm dòng `<div className="flex justify-end pt-1">` (dòng gần cuối left panel) và thêm TRƯỚC nó:

```tsx
                {/* Jira button */}
                <button
                  onClick={handleOpenJiraPanel}
                  disabled={preparingJira}
                  className="w-full flex items-center justify-center gap-2 border border-blue-300 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-50 transition disabled:opacity-50"
                >
                  {preparingJira ? "Đang chuẩn bị..." : "🎫 Tạo Jira ticket"}
                </button>
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/app/feedback/page.tsx
git commit -m "feat: add inline edits for title/raw_content/root_cause and Hướng giải quyết section in FeedbackDetailModal"
```

---

## Task 9: Frontend — Thêm Jira Preview Panel vào RIGHT column

**Files:**
- Modify: `frontend/src/app/feedback/page.tsx`

- [ ] **Step 1: Thêm `JiraPreviewPanel` component trước `FeedbackDetailModal`**

```typescript
// ── Jira preview panel ───────────────────────────────────────────────────────
function JiraPreviewPanel({
  fb,
  draft,
  onChange,
  onSubmit,
  onCancel,
  creating,
  result,
}: {
  fb: Feedback;
  draft: { title: string; acceptance_criteria: string; sprint_name: string };
  onChange: (patch: Partial<{ title: string; acceptance_criteria: string; sprint_name: string }>) => void;
  onSubmit: () => void;
  onCancel: () => void;
  creating: boolean;
  result: { key: string; url: string } | null;
}) {
  const descriptionPreview = [
    fb.raw_content ? `## Nội dung gốc\n${fb.raw_content}` : "",
    fb.analysis?.root_cause ? `## Kết quả phân tích\n${fb.analysis.root_cause}` : "",
    fb.analysis?.solution_hint ? `## Hướng giải quyết\n${fb.analysis.solution_hint}` : "",
    draft.acceptance_criteria ? `## Acceptance Criteria\n${draft.acceptance_criteria}` : "",
  ].filter(Boolean).join("\n\n");

  return (
    <div className="h-full flex flex-col bg-white p-5 overflow-y-auto space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-gray-900">🎫 Tạo Jira ticket</p>
        <button onClick={onCancel} className="text-xs text-gray-400 hover:text-gray-600">← Huỷ</button>
      </div>

      {/* Title */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Tiêu đề *</p>
        <input
          type="text"
          value={draft.title}
          onChange={e => onChange({ title: e.target.value })}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Description preview */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Description (preview)</p>
        <pre className="text-xs text-gray-600 bg-gray-50 rounded-lg p-3 whitespace-pre-wrap leading-relaxed max-h-52 overflow-y-auto border border-gray-100">
          {descriptionPreview || "(trống)"}
        </pre>
      </div>

      {/* Acceptance Criteria editable */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Acceptance Criteria</p>
        <textarea
          value={draft.acceptance_criteria}
          onChange={e => onChange({ acceptance_criteria: e.target.value })}
          rows={4}
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none"
        />
      </div>

      {/* Sprint */}
      <div>
        <p className="text-xs font-medium text-gray-500 mb-1">Sprint (tuỳ chọn)</p>
        <input
          type="text"
          value={draft.sprint_name}
          onChange={e => onChange({ sprint_name: e.target.value })}
          placeholder="e.g. GB sprint 5"
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
      </div>

      {/* Fixed fields */}
      <div className="bg-gray-50 rounded-lg p-3 space-y-1 text-xs text-gray-500">
        <p><span className="font-medium">Assignee:</span> tunm1@ghn.vn</p>
        <p><span className="font-medium">Epic:</span> GB-488</p>
        <p><span className="font-medium">Project:</span> GB</p>
        <p><span className="font-medium">Type:</span> Story</p>
      </div>

      {/* Result or submit */}
      {result ? (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center justify-between">
          <p className="text-sm text-green-700 font-medium">✅ Tạo thành công!</p>
          <a href={result.url} target="_blank" rel="noopener noreferrer"
            className="text-sm font-bold text-blue-600 hover:underline">
            {result.key} ↗
          </a>
        </div>
      ) : (
        <button
          onClick={onSubmit}
          disabled={creating || !draft.title.trim()}
          className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
        >
          {creating ? "Đang tạo..." : "🚀 Tạo Jira ticket"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Cập nhật RIGHT column trong `FeedbackDetailModal` để hiển thị Jira panel khi `showJiraPanel`**

Tìm block `{/* RIGHT: image panel */}` (khoảng dòng 386):

```tsx
              {/* RIGHT: image panel */}
              {hasImages && (
                <div className="w-[58%] overflow-y-auto bg-gray-950 ...">
```

Thay thành:

```tsx
              {/* RIGHT: jira panel or image panel */}
              {showJiraPanel && jiraDraft ? (
                <div className={`overflow-hidden flex flex-col ${hasImages ? "w-[58%] border-l border-gray-100" : "w-[58%] border-l border-gray-100"}`}>
                  <JiraPreviewPanel
                    fb={fb}
                    draft={jiraDraft}
                    onChange={patch => setJiraDraft(prev => prev ? { ...prev, ...patch } : prev)}
                    onSubmit={handleCreateJira}
                    onCancel={() => setShowJiraPanel(false)}
                    creating={creatingJira}
                    result={jiraResult}
                  />
                </div>
              ) : hasImages ? (
                <div className="w-[58%] overflow-y-auto bg-gray-950 flex flex-col gap-0">
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide px-4 pt-4 pb-2 shrink-0">
                    Hình ảnh đính kèm · {fb.media_urls!.length} ảnh
                  </p>
                  <div className="flex flex-col gap-1 px-3 pb-4">
                    {fb.media_urls!.map((url, i) => (
                      <button
                        key={i}
                        onClick={() => setZoomUrl(url)}
                        className="block w-full rounded-lg overflow-hidden focus:outline-none focus:ring-2 focus:ring-white/50 hover:opacity-95 transition"
                        title="Click để phóng to"
                      >
                        <img
                          src={url}
                          alt={`Ảnh ${i + 1}`}
                          className="w-full object-contain bg-gray-900"
                          onError={e => { (e.target as HTMLImageElement).closest("button")!.style.display = "none"; }}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
```

**Lưu ý:** Khi không có ảnh, modal vẫn cần hiển thị Jira panel. Cập nhật layout condition trên dòng `<div className={`flex-1 overflow-hidden flex...`}>`:

Tìm:
```tsx
            <div className={`flex-1 overflow-hidden flex ${hasImages ? "flex-row" : "flex-col"}`}>
```

Thay thành:
```tsx
            <div className={`flex-1 overflow-hidden flex ${(hasImages || showJiraPanel) ? "flex-row" : "flex-col"}`}>
```

Và tìm dòng LEFT panel width:
```tsx
              <div className={`overflow-y-auto p-5 space-y-4 ${hasImages ? "w-[42%] border-r border-gray-100" : "w-full"}`}>
```

Thay thành:
```tsx
              <div className={`overflow-y-auto p-5 space-y-4 ${(hasImages || showJiraPanel) ? "w-[42%] border-r border-gray-100" : "w-full"}`}>
```

- [ ] **Step 3: Chạy build kiểm tra**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (hoặc không có error về type/syntax)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/feedback/page.tsx
git commit -m "feat: add JiraPreviewPanel to FeedbackDetailModal right column"
```

---

## Task 10: Manual Verification

- [ ] **Step 1: Khởi động backend**

```bash
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

- [ ] **Step 2: Khởi động frontend**

```bash
cd frontend && npm run dev
```

- [ ] **Step 3: Kiểm tra inline edit**

1. Mở `http://localhost:3000/feedback`
2. Click vào một feedback đã analyzed
3. Click vào "Nội dung gốc" → textarea xuất hiện → chỉnh sửa → Lưu
4. Verify API: `curl -X PATCH http://localhost:8000/api/feedbacks/{id} -H "Content-Type: application/json" -d '{"raw_content": "test"}' | python3 -m json.tool`
5. Click vào "Nguyên nhân gốc rễ" → edit → Lưu

- [ ] **Step 4: Kiểm tra generate solution**

1. Bấm nút "✨ AI" trong section Hướng giải quyết
2. Verify solution_hint xuất hiện sau vài giây

- [ ] **Step 5: Kiểm tra Jira panel**

1. Bấm "🎫 Tạo Jira ticket"
2. Panel Jira xuất hiện bên phải
3. Kiểm tra title, description preview, AC được điền sẵn
4. Nhập sprint name (nếu có)
5. Bấm "🚀 Tạo Jira ticket" → verify link GB-xxx xuất hiện

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: complete feedback modal edit + jira creation feature"
```
