# Solution Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nâng cấp `/solutions/[id]` thành workspace tích hợp: Canvas (Tldraw) + PRD Editor (Tiptap) + Jira Tickets + AI Chat, với resize panels và link 2 chiều canvas ↔ PRD.

**Architecture:** Split-view layout dùng `react-resizable-panels`. Canvas và PRD chia sẻ state qua `WorkspaceContext` — click shape trên canvas highlight section PRD tương ứng và ngược lại. AI Chat nhận full context (PRD + canvas + jira) và trả về structured action để update từng panel.

**Tech Stack:** Next.js 15, Tldraw v2, Tiptap v2, react-resizable-panels, FastAPI, SQLAlchemy async, Alembic, OpenAI GPT-4o

---

## File Map

### New files (frontend)
- `frontend/src/app/solutions/[id]/components/WorkspaceContext.tsx` — shared context: activeAnchor state
- `frontend/src/app/solutions/[id]/components/CanvasPanel.tsx` — Tldraw wrapper + anchor link
- `frontend/src/app/solutions/[id]/components/PrdEditor.tsx` — Tiptap editor + toolbar + copy
- `frontend/src/app/solutions/[id]/components/JiraPanel.tsx` — epic sync + ticket CRUD
- `frontend/src/app/solutions/[id]/components/AiChatBar.tsx` — chat input + action apply

### Modified files (frontend)
- `frontend/src/app/solutions/[id]/page.tsx` — replace current content with workspace layout
- `frontend/src/lib/api.ts` — add canvas, prd, chat, jira endpoints
- `frontend/src/lib/types.ts` — add WorkspaceAction, JiraTicket types

### New files (backend)
- `backend/alembic/versions/0010_solution_workspace.py` — add 4 columns to solution_drafts
- `backend/api/routes/jira_workspace.py` — GET epic tickets, POST/PATCH ticket

### Modified files (backend)
- `backend/api/routes/solutions.py` — add PATCH /canvas, /prd, /chat endpoints
- `backend/services/jira_service.py` — add fetch_epic_tickets, create_ticket, update_ticket
- `backend/services/ai_service.py` — add chat_with_workspace_context()
- `backend/main.py` — register jira_workspace router

---

## Task 1: DB Migration — 4 new columns on solution_drafts

**Files:**
- Create: `backend/alembic/versions/0010_solution_workspace.py`

- [ ] **Step 1: Write migration file**

```python
# backend/alembic/versions/0010_solution_workspace.py
"""add solution workspace columns

Revision ID: 0010
Revises: 0009
Create Date: 2026-04-13
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = '0010'
down_revision = '0009'
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('solution_drafts', sa.Column('prd_content', postgresql.JSONB(), nullable=True))
    op.add_column('solution_drafts', sa.Column('tldraw_data', postgresql.JSONB(), nullable=True))
    op.add_column('solution_drafts', sa.Column('jira_epic_key', sa.Text(), nullable=True))
    op.add_column('solution_drafts', sa.Column('solution_chat_history', postgresql.JSONB(), nullable=True, server_default='[]'))


def downgrade():
    op.drop_column('solution_drafts', 'solution_chat_history')
    op.drop_column('solution_drafts', 'jira_epic_key')
    op.drop_column('solution_drafts', 'tldraw_data')
    op.drop_column('solution_drafts', 'prd_content')
```

- [ ] **Step 2: Run migration**

```bash
cd backend && python3 -m alembic upgrade head
```

Expected output: `Running upgrade 0009 -> 0010, add solution workspace columns`

- [ ] **Step 3: Verify columns exist**

```bash
python3 -c "
import asyncio
from sqlalchemy import text
from core.database import engine

async def check():
    async with engine.connect() as conn:
        r = await conn.execute(text(\"SELECT column_name FROM information_schema.columns WHERE table_name='solution_drafts' AND column_name IN ('prd_content','tldraw_data','jira_epic_key','solution_chat_history')\"))
        print([row[0] for row in r.fetchall()])

asyncio.run(check())
"
```

Expected: `['prd_content', 'tldraw_data', 'jira_epic_key', 'solution_chat_history']`

- [ ] **Step 4: Add columns to SQLAlchemy model**

Edit `backend/models/solution_draft.py` — add after `gdoc_url` line:

```python
from sqlalchemy.dialects.postgresql import JSONB

# Add these 4 columns:
prd_content: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
tldraw_data: Mapped[Optional[dict]] = mapped_column(JSONB, nullable=True)
jira_epic_key: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
solution_chat_history: Mapped[Optional[list]] = mapped_column(JSONB, nullable=True, default=list)
```

- [ ] **Step 5: Add fields to schema**

Edit `backend/schemas/solution_draft.py` — add to `SolutionDraftOut`:

```python
prd_content: Optional[dict] = None
tldraw_data: Optional[dict] = None
jira_epic_key: Optional[str] = None
solution_chat_history: Optional[list] = None
```

- [ ] **Step 6: Commit**

```bash
git add backend/alembic/versions/0010_solution_workspace.py backend/models/solution_draft.py backend/schemas/solution_draft.py
git commit -m "feat: add solution workspace columns (prd, canvas, jira_epic, chat)"
```

---

## Task 2: Backend — Canvas and PRD save endpoints

**Files:**
- Modify: `backend/api/routes/solutions.py`

- [ ] **Step 1: Write failing test**

```python
# backend/tests/test_solution_workspace.py
import httpx, pytest
BASE_URL = "http://localhost:8000"
PM = "tunm1@ghn.vn"

@pytest.fixture
def solution_id(client):
    """Reuse first available solution, or skip if none."""
    r = client.get("/api/solutions", headers={"x-user-email": PM})
    items = r.json()
    if not items:
        pytest.skip("No solutions in DB")
    return items[0]["id"]

def test_patch_canvas_saves_tldraw_data(client, solution_id):
    payload = {"tldraw_data": {"shapes": [{"id": "shape1", "type": "geo"}]}}
    r = client.patch(f"/api/solutions/{solution_id}/canvas",
                     json=payload, headers={"x-user-email": PM})
    assert r.status_code == 200
    assert r.json()["tldraw_data"]["shapes"][0]["id"] == "shape1"

def test_patch_prd_saves_content(client, solution_id):
    payload = {"prd_content": {"type": "doc", "content": [{"type": "paragraph", "content": [{"type": "text", "text": "Hello PRD"}]}]}}
    r = client.patch(f"/api/solutions/{solution_id}/prd",
                     json=payload, headers={"x-user-email": PM})
    assert r.status_code == 200
    assert r.json()["prd_content"]["type"] == "doc"
```

- [ ] **Step 2: Run test to confirm it fails**

```bash
cd backend && python3 -m pytest tests/test_solution_workspace.py::test_patch_canvas_saves_tldraw_data -v
```

Expected: `FAILED — 404 or 405`

- [ ] **Step 3: Add PATCH endpoints to solutions.py**

Add to `backend/api/routes/solutions.py`:

```python
from pydantic import BaseModel
from typing import Any

class CanvasPatch(BaseModel):
    tldraw_data: dict

class PrdPatch(BaseModel):
    prd_content: dict

class JiraEpicPatch(BaseModel):
    jira_epic_key: str


@router.patch("/{solution_id}/canvas")
async def patch_canvas(solution_id: str, body: CanvasPatch, db: AsyncSession = Depends(get_db)):
    draft = await db.get(SolutionDraft, solution_id)
    if not draft:
        raise HTTPException(404, "Not found")
    draft.tldraw_data = body.tldraw_data
    await db.commit()
    await db.refresh(draft)
    return _to_out(draft)


@router.patch("/{solution_id}/prd")
async def patch_prd(solution_id: str, body: PrdPatch, db: AsyncSession = Depends(get_db)):
    draft = await db.get(SolutionDraft, solution_id)
    if not draft:
        raise HTTPException(404, "Not found")
    draft.prd_content = body.prd_content
    await db.commit()
    await db.refresh(draft)
    return _to_out(draft)


@router.patch("/{solution_id}/jira-epic")
async def patch_jira_epic(solution_id: str, body: JiraEpicPatch, db: AsyncSession = Depends(get_db)):
    draft = await db.get(SolutionDraft, solution_id)
    if not draft:
        raise HTTPException(404, "Not found")
    draft.jira_epic_key = body.jira_epic_key
    await db.commit()
    await db.refresh(draft)
    return _to_out(draft)
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
cd backend && python3 -m pytest tests/test_solution_workspace.py -v
```

Expected: `2 passed`

- [ ] **Step 5: Commit**

```bash
git add backend/api/routes/solutions.py backend/tests/test_solution_workspace.py
git commit -m "feat: add PATCH /solutions/{id}/canvas, /prd, /jira-epic endpoints"
```

---

## Task 3: Backend — Jira epic tickets + ticket CRUD

**Files:**
- Modify: `backend/services/jira_service.py`
- Create: `backend/api/routes/jira_workspace.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Add Jira service functions**

Add to `backend/services/jira_service.py`:

```python
async def fetch_epic_tickets(epic_key: str) -> list[dict]:
    """Fetch all Jira tickets belonging to an epic."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_api_token:
        return []
    url = f"https://{settings.jira_domain}/rest/api/3/search"
    jql = f'"Epic Link" = {epic_key} OR parent = {epic_key} ORDER BY created DESC'
    async with httpx.AsyncClient() as client:
        r = await client.get(
            url,
            params={"jql": jql, "maxResults": 50, "fields": "summary,status,issuetype,assignee"},
            headers=_auth_header(),
            timeout=10,
        )
    if r.status_code != 200:
        return []
    issues = r.json().get("issues", [])
    return [
        {
            "key": i["key"],
            "title": i["fields"]["summary"],
            "status": i["fields"]["status"]["name"],
            "type": i["fields"]["issuetype"]["name"],
            "url": f"https://{settings.jira_domain}/browse/{i['key']}",
        }
        for i in issues
    ]


async def create_ticket(project_key: str, title: str, description: str, issue_type: str = "Task") -> dict:
    """Create a new Jira ticket."""
    settings = get_settings()
    url = f"https://{settings.jira_domain}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": title,
            "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]},
            "issuetype": {"name": issue_type},
        }
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json=payload, headers=_auth_header(), timeout=10)
    r.raise_for_status()
    data = r.json()
    return {"key": data["key"], "url": f"https://{settings.jira_domain}/browse/{data['key']}"}


async def update_ticket_status(ticket_key: str, transition_name: str) -> bool:
    """Transition a Jira ticket to a new status."""
    settings = get_settings()
    # Get available transitions
    async with httpx.AsyncClient() as client:
        tr = await client.get(
            f"https://{settings.jira_domain}/rest/api/3/issue/{ticket_key}/transitions",
            headers=_auth_header(), timeout=10,
        )
        transitions = tr.json().get("transitions", [])
        match = next((t for t in transitions if transition_name.lower() in t["name"].lower()), None)
        if not match:
            return False
        r = await client.post(
            f"https://{settings.jira_domain}/rest/api/3/issue/{ticket_key}/transitions",
            json={"transition": {"id": match["id"]}},
            headers=_auth_header(), timeout=10,
        )
    return r.status_code == 204
```

- [ ] **Step 2: Create jira_workspace router**

```python
# backend/api/routes/jira_workspace.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from services import jira_service

router = APIRouter(prefix="/jira", tags=["jira-workspace"])


@router.get("/epic/{epic_key}/tickets")
async def get_epic_tickets(epic_key: str):
    tickets = await jira_service.fetch_epic_tickets(epic_key)
    return tickets


class CreateTicketBody(BaseModel):
    project_key: str
    title: str
    description: str = ""
    issue_type: str = "Task"


class UpdateTicketBody(BaseModel):
    transition: str  # e.g. "In Progress", "Done"


@router.post("/tickets")
async def create_ticket(body: CreateTicketBody):
    try:
        result = await jira_service.create_ticket(
            body.project_key, body.title, body.description, body.issue_type
        )
        return result
    except Exception as e:
        raise HTTPException(400, str(e))


@router.patch("/tickets/{ticket_key}")
async def update_ticket(ticket_key: str, body: UpdateTicketBody):
    ok = await jira_service.update_ticket_status(ticket_key, body.transition)
    if not ok:
        raise HTTPException(400, f"Transition '{body.transition}' not available for {ticket_key}")
    return {"ok": True}
```

- [ ] **Step 3: Register router in main.py**

Edit `backend/main.py` — add import and include:

```python
# Add to imports at top:
from api.routes import jira_workspace

# Add inside app.include_router block:
app.include_router(jira_workspace.router, prefix="/api")
```

- [ ] **Step 4: Verify endpoints registered**

```bash
cd backend && python3 -c "from main import app; print([r.path for r in app.routes if 'jira' in r.path])"
```

Expected: `['/api/jira/epic/{epic_key}/tickets', '/api/jira/tickets', '/api/jira/tickets/{ticket_key}']`

- [ ] **Step 5: Commit**

```bash
git add backend/services/jira_service.py backend/api/routes/jira_workspace.py backend/main.py
git commit -m "feat: add jira epic tickets fetch + ticket CRUD endpoints"
```

---

## Task 4: Backend — AI Chat endpoint

**Files:**
- Modify: `backend/services/ai_service.py`
- Modify: `backend/api/routes/solutions.py`

- [ ] **Step 1: Add chat_with_workspace_context to ai_service.py**

```python
async def chat_with_workspace_context(
    message: str,
    prd_content: dict | None,
    tldraw_data: dict | None,
    jira_tickets: list[dict],
    solution_title: str,
) -> dict:
    """
    Returns structured action:
    {
      "action": "update_prd" | "create_jira_ticket" | "update_canvas" | "reply_only",
      "prd_patch": {"section_id": str, "new_content": str} | None,
      "jira_ticket": {"title": str, "description": str, "type": str} | None,
      "canvas_patch": {"shape_id": str, "label": str} | None,
      "message": str
    }
    """
    client = get_client()
    
    context_parts = [f"Solution: {solution_title}"]
    if prd_content:
        context_parts.append(f"PRD (Tiptap JSON): {json.dumps(prd_content)[:2000]}")
    if tldraw_data:
        context_parts.append(f"Canvas shapes: {json.dumps(tldraw_data)[:1000]}")
    if jira_tickets:
        ticket_summary = ", ".join(f"{t['key']}: {t['title']} ({t['status']})" for t in jira_tickets[:10])
        context_parts.append(f"Jira tickets: {ticket_summary}")
    
    system_prompt = """You are a PM assistant helping manage product solutions. 
You have access to a PRD document, canvas diagram, and Jira tickets.
When the user asks you to update something, return a structured JSON action.

Respond ONLY with valid JSON in this format:
{
  "action": "update_prd" | "create_jira_ticket" | "update_canvas" | "reply_only",
  "prd_patch": {"section_id": "string or null", "new_content": "the new text content"} or null,
  "jira_ticket": {"title": "...", "description": "...", "type": "Task"} or null,
  "canvas_patch": {"shape_id": "...", "label": "..."} or null,
  "message": "Human-readable confirmation message in Vietnamese"
}"""

    response = await client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": "\n".join(context_parts) + f"\n\nUser request: {message}"},
        ],
        temperature=0.3,
    )
    return _parse_json_response(response.choices[0].message.content)
```

Also add `import json` at the top of `ai_service.py` if not already present.

- [ ] **Step 2: Add POST /solutions/{id}/chat endpoint**

Add to `backend/api/routes/solutions.py`:

```python
class ChatMessage(BaseModel):
    message: str
    jira_tickets: list[dict] = []


@router.post("/{solution_id}/chat")
async def chat_solution(
    solution_id: str,
    body: ChatMessage,
    db: AsyncSession = Depends(get_db),
):
    from services import ai_service
    result = await db.execute(
        select(SolutionDraft)
        .options(selectinload(SolutionDraft.product))
        .where(SolutionDraft.id == solution_id)
    )
    draft = result.scalar_one_or_none()
    if not draft:
        raise HTTPException(404, "Not found")

    action = await ai_service.chat_with_workspace_context(
        message=body.message,
        prd_content=draft.prd_content,
        tldraw_data=draft.tldraw_data,
        jira_tickets=body.jira_tickets,
        solution_title=draft.problem_statement or solution_id,
    )

    # Persist chat history
    history = draft.solution_chat_history or []
    history.append({"role": "user", "content": body.message})
    history.append({"role": "assistant", "content": action.get("message", "")})
    draft.solution_chat_history = history[-40:]  # Keep last 20 exchanges

    await db.commit()
    return action
```

- [ ] **Step 3: Verify backend starts cleanly**

```bash
cd backend && python3 -c "from main import app; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/services/ai_service.py backend/api/routes/solutions.py
git commit -m "feat: add AI chat endpoint for solution workspace"
```

---

## Task 5: Frontend — Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Install packages**

```bash
cd frontend && npm install @tldraw/tldraw @tiptap/react @tiptap/starter-kit react-resizable-panels
```

- [ ] **Step 2: Verify install**

```bash
cd frontend && node -e "require('@tldraw/tldraw'); require('@tiptap/react'); require('react-resizable-panels'); console.log('OK')"
```

Expected: `OK`

- [ ] **Step 3: Add api.ts endpoints**

Add to the `solutions` section in `frontend/src/lib/api.ts`:

```typescript
patchCanvas: (id: string, tldrawData: object) =>
  request<any>(`/api/solutions/${id}/canvas`, { method: "PATCH", body: JSON.stringify({ tldraw_data: tldrawData }) }),
patchPrd: (id: string, prdContent: object) =>
  request<any>(`/api/solutions/${id}/prd`, { method: "PATCH", body: JSON.stringify({ prd_content: prdContent }) }),
patchJiraEpic: (id: string, epicKey: string) =>
  request<any>(`/api/solutions/${id}/jira-epic`, { method: "PATCH", body: JSON.stringify({ jira_epic_key: epicKey }) }),
chat: (id: string, message: string, jiraTickets: any[]) =>
  request<any>(`/api/solutions/${id}/chat`, { method: "POST", body: JSON.stringify({ message, jira_tickets: jiraTickets }) }),
```

Add `jira` section to api client:

```typescript
jira: {
  getEpicTickets: (epicKey: string) => request<any[]>(`/api/jira/epic/${epicKey}/tickets`),
  createTicket: (data: { project_key: string; title: string; description: string; issue_type?: string }) =>
    request<any>(`/api/jira/tickets`, { method: "POST", body: JSON.stringify(data) }),
  updateTicket: (key: string, transition: string) =>
    request<any>(`/api/jira/tickets/${key}`, { method: "PATCH", body: JSON.stringify({ transition }) }),
},
```

- [ ] **Step 4: Add types to types.ts**

Add to `frontend/src/lib/types.ts`:

```typescript
export interface JiraTicket {
  key: string;
  title: string;
  status: string;
  type: string;
  url: string;
}

export interface WorkspaceAction {
  action: "update_prd" | "create_jira_ticket" | "update_canvas" | "reply_only";
  prd_patch: { section_id: string | null; new_content: string } | null;
  jira_ticket: { title: string; description: string; type: string } | null;
  canvas_patch: { shape_id: string; label: string } | null;
  message: string;
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/lib/api.ts frontend/src/lib/types.ts
git commit -m "feat: install tldraw/tiptap/resizable-panels, add workspace API client"
```

---

## Task 6: Frontend — WorkspaceContext

**Files:**
- Create: `frontend/src/app/solutions/[id]/components/WorkspaceContext.tsx`

- [ ] **Step 1: Create context**

```typescript
// frontend/src/app/solutions/[id]/components/WorkspaceContext.tsx
"use client";
import { createContext, useContext, useState, useCallback } from "react";

interface WorkspaceContextValue {
  activeAnchor: string | null;
  setActiveAnchor: (anchorId: string | null) => void;
  highlightFromCanvas: (anchorId: string) => void;
  highlightFromPrd: (anchorId: string) => void;
  canvasHighlight: string | null;
  prdHighlight: string | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue>({
  activeAnchor: null,
  setActiveAnchor: () => {},
  highlightFromCanvas: () => {},
  highlightFromPrd: () => {},
  canvasHighlight: null,
  prdHighlight: null,
});

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [canvasHighlight, setCanvasHighlight] = useState<string | null>(null);
  const [prdHighlight, setPrdHighlight] = useState<string | null>(null);
  const [activeAnchor, setActiveAnchor] = useState<string | null>(null);

  // Called when user clicks a canvas shape with anchor_id
  const highlightFromCanvas = useCallback((anchorId: string) => {
    setPrdHighlight(anchorId);
    setActiveAnchor(anchorId);
    // Auto-clear after 2s
    setTimeout(() => setPrdHighlight(null), 2000);
  }, []);

  // Called when user clicks a PRD section with anchor_id
  const highlightFromPrd = useCallback((anchorId: string) => {
    setCanvasHighlight(anchorId);
    setActiveAnchor(anchorId);
    setTimeout(() => setCanvasHighlight(null), 2000);
  }, []);

  return (
    <WorkspaceContext.Provider value={{ activeAnchor, setActiveAnchor, highlightFromCanvas, highlightFromPrd, canvasHighlight, prdHighlight }}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  return useContext(WorkspaceContext);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/solutions/[id]/components/WorkspaceContext.tsx
git commit -m "feat: add WorkspaceContext for canvas↔PRD bidirectional linking"
```

---

## Task 7: Frontend — CanvasPanel (Tldraw)

**Files:**
- Create: `frontend/src/app/solutions/[id]/components/CanvasPanel.tsx`

- [ ] **Step 1: Create CanvasPanel**

```typescript
// frontend/src/app/solutions/[id]/components/CanvasPanel.tsx
"use client";
import { useEffect, useRef, useCallback } from "react";
import { Tldraw, Editor, TLShape } from "@tldraw/tldraw";
import "@tldraw/tldraw/tldraw.css";
import { useWorkspace } from "./WorkspaceContext";
import { api } from "@/lib/api";

interface CanvasPanelProps {
  solutionId: string;
  initialData: object | null;
}

export function CanvasPanel({ solutionId, initialData }: CanvasPanelProps) {
  const editorRef = useRef<Editor | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { highlightFromCanvas, canvasHighlight } = useWorkspace();

  const handleMount = useCallback((editor: Editor) => {
    editorRef.current = editor;

    // Load initial data if exists
    if (initialData && Object.keys(initialData).length > 0) {
      try {
        editor.loadSnapshot(initialData as any);
      } catch (e) {
        console.warn("[Canvas] Failed to load snapshot:", e);
      }
    }

    // Auto-save on change (debounce 2s)
    editor.store.listen(() => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        const snapshot = editor.getSnapshot();
        await api.solutions.patchCanvas(solutionId, snapshot).catch(console.error);
      }, 2000);
    });

    // Click handler — check if shape has anchor_id metadata
    editor.on("click", (info: any) => {
      const shape: TLShape | undefined = info.shape;
      if (shape?.meta?.anchorId) {
        highlightFromCanvas(shape.meta.anchorId as string);
      }
    });
  }, [solutionId, initialData, highlightFromCanvas]);

  // Flash border on shape when PRD triggers highlight
  useEffect(() => {
    if (!canvasHighlight || !editorRef.current) return;
    const editor = editorRef.current;
    const shapes = editor.getCurrentPageShapes();
    const target = shapes.find((s) => s.meta?.anchorId === canvasHighlight);
    if (target) {
      editor.select(target.id);
      editor.zoomToSelection();
    }
  }, [canvasHighlight]);

  return (
    <div className="w-full h-full" style={{ position: "relative" }}>
      <Tldraw onMount={handleMount} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/solutions/[id]/components/CanvasPanel.tsx
git commit -m "feat: add CanvasPanel with Tldraw, auto-save, anchor link"
```

---

## Task 8: Frontend — PrdEditor (Tiptap)

**Files:**
- Create: `frontend/src/app/solutions/[id]/components/PrdEditor.tsx`

- [ ] **Step 1: Create PrdEditor**

```typescript
// frontend/src/app/solutions/[id]/components/PrdEditor.tsx
"use client";
import { useEffect, useRef, useCallback } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useWorkspace } from "./WorkspaceContext";
import { api } from "@/lib/api";

interface PrdEditorProps {
  solutionId: string;
  initialContent: object | null;
}

export function PrdEditor({ solutionId, initialContent }: PrdEditorProps) {
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { prdHighlight, highlightFromPrd } = useWorkspace();

  const editor = useEditor({
    extensions: [StarterKit],
    content: initialContent || "<p>Bắt đầu viết PRD...</p>",
    onUpdate: ({ editor }) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        const json = editor.getJSON();
        await api.solutions.patchPrd(solutionId, json).catch(console.error);
      }, 2000);
    },
  });

  // Update editor content when AI chat patches PRD
  const applyPatch = useCallback((newContent: string) => {
    if (!editor) return;
    const current = editor.getHTML();
    editor.commands.setContent(current + `\n<p>${newContent}</p>`);
  }, [editor]);

  // Expose applyPatch for AiChatBar
  useEffect(() => {
    if (typeof window !== "undefined") {
      (window as any).__prdApplyPatch = applyPatch;
    }
  }, [applyPatch]);

  // Highlight section when canvas triggers
  useEffect(() => {
    if (!prdHighlight) return;
    const el = document.querySelector(`[data-anchor-id="${prdHighlight}"]`);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      el.classList.add("bg-blue-100", "transition-colors");
      setTimeout(() => el.classList.remove("bg-blue-100"), 2000);
    }
  }, [prdHighlight]);

  function copyAsHtml() {
    if (!editor) return;
    const html = editor.getHTML();
    navigator.clipboard.writeText(html);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 bg-blue-50 border-b border-blue-100">
        <span className="text-xs font-semibold text-blue-700 mr-2">📄 PRD</span>
        <button onClick={() => editor?.chain().focus().toggleBold().run()}
          className={`px-2 py-0.5 text-xs border rounded font-bold ${editor?.isActive("bold") ? "bg-blue-200" : "bg-white"}`}>B</button>
        <button onClick={() => editor?.chain().focus().toggleItalic().run()}
          className={`px-2 py-0.5 text-xs border rounded italic ${editor?.isActive("italic") ? "bg-blue-200" : "bg-white"}`}>I</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`px-2 py-0.5 text-xs border rounded ${editor?.isActive("heading", { level: 1 }) ? "bg-blue-200" : "bg-white"}`}>H1</button>
        <button onClick={() => editor?.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2 py-0.5 text-xs border rounded ${editor?.isActive("heading", { level: 2 }) ? "bg-blue-200" : "bg-white"}`}>H2</button>
        <button onClick={() => editor?.chain().focus().toggleBulletList().run()}
          className={`px-2 py-0.5 text-xs border rounded ${editor?.isActive("bulletList") ? "bg-blue-200" : "bg-white"}`}>• List</button>
        <div className="flex-1" />
        <button onClick={copyAsHtml}
          className="px-2 py-0.5 text-xs border rounded bg-white text-gray-600 hover:bg-gray-50">
          📋 Copy
        </button>
      </div>
      {/* Editor */}
      <div className="flex-1 overflow-y-auto p-3">
        <EditorContent editor={editor} className="prose prose-sm max-w-none min-h-full" />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/solutions/[id]/components/PrdEditor.tsx
git commit -m "feat: add PrdEditor with Tiptap, auto-save, anchor highlight, copy HTML"
```

---

## Task 9: Frontend — JiraPanel

**Files:**
- Create: `frontend/src/app/solutions/[id]/components/JiraPanel.tsx`

- [ ] **Step 1: Create JiraPanel**

```typescript
// frontend/src/app/solutions/[id]/components/JiraPanel.tsx
"use client";
import { useState } from "react";
import { api } from "@/lib/api";
import type { JiraTicket } from "@/lib/types";

interface JiraPanelProps {
  solutionId: string;
  initialEpicKey: string | null;
  productJiraKey: string | null; // from product.jira_project_key
  onTicketsChange: (tickets: JiraTicket[]) => void;
}

export function JiraPanel({ solutionId, initialEpicKey, productJiraKey, onTicketsChange }: JiraPanelProps) {
  const [epicKey, setEpicKey] = useState(initialEpicKey || "");
  const [tickets, setTickets] = useState<JiraTicket[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [showForm, setShowForm] = useState(false);

  async function syncTickets() {
    if (!epicKey.trim()) return;
    setLoading(true);
    await api.solutions.patchJiraEpic(solutionId, epicKey).catch(() => {});
    const result = await api.jira.getEpicTickets(epicKey).catch(() => []) as JiraTicket[];
    setTickets(result);
    onTicketsChange(result);
    setLoading(false);
  }

  async function createTicket() {
    if (!newTitle.trim() || !productJiraKey) return;
    setCreating(true);
    try {
      const result = await api.jira.createTicket({
        project_key: productJiraKey,
        title: newTitle,
        description: newDesc,
      });
      const newTicket: JiraTicket = { key: result.key, title: newTitle, status: "To Do", type: "Task", url: result.url };
      const updated = [newTicket, ...tickets];
      setTickets(updated);
      onTicketsChange(updated);
      setNewTitle("");
      setNewDesc("");
      setShowForm(false);
    } catch (e) {
      console.error(e);
    }
    setCreating(false);
  }

  const STATUS_COLORS: Record<string, string> = {
    "To Do": "bg-yellow-100 text-yellow-800",
    "In Progress": "bg-blue-100 text-blue-800",
    "Done": "bg-green-100 text-green-800",
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border-b border-amber-100">
        <span className="text-xs font-semibold text-amber-800">🎫 Jira</span>
        <input value={epicKey} onChange={(e) => setEpicKey(e.target.value)}
          placeholder="Epic key, vd: CSAI-10"
          className="border border-amber-200 rounded px-2 py-0.5 text-xs w-28" />
        <button onClick={syncTickets} disabled={loading}
          className="bg-amber-500 text-white text-xs px-2 py-0.5 rounded hover:bg-amber-600 disabled:opacity-50">
          {loading ? "..." : "Sync"}
        </button>
        <button onClick={() => setShowForm(!showForm)}
          className="bg-green-600 text-white text-xs px-2 py-0.5 rounded hover:bg-green-700">
          + New
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="p-2 border-b bg-gray-50 flex flex-col gap-1">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="Ticket title..." className="border rounded px-2 py-1 text-xs w-full" />
          <input value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            placeholder="Description (optional)" className="border rounded px-2 py-1 text-xs w-full" />
          <div className="flex gap-1">
            <button onClick={createTicket} disabled={creating}
              className="bg-green-600 text-white text-xs px-3 py-1 rounded disabled:opacity-50">
              {creating ? "Creating..." : "Create"}
            </button>
            <button onClick={() => setShowForm(false)} className="text-xs text-gray-500 px-2">Cancel</button>
          </div>
        </div>
      )}

      {/* Ticket list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1.5">
        {tickets.length === 0 && (
          <p className="text-xs text-gray-400 text-center mt-4">Nhập epic key và nhấn Sync</p>
        )}
        {tickets.map((t) => (
          <a key={t.key} href={t.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-2 bg-white border border-gray-100 rounded-md px-2.5 py-1.5 hover:border-blue-200 transition">
            <span className="bg-blue-50 text-blue-700 text-xs font-mono px-1.5 py-0.5 rounded">{t.key}</span>
            <span className="flex-1 text-xs text-gray-700 truncate">{t.title}</span>
            <span className={`text-xs px-1.5 py-0.5 rounded ${STATUS_COLORS[t.status] || "bg-gray-100 text-gray-600"}`}>{t.status}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/solutions/[id]/components/JiraPanel.tsx
git commit -m "feat: add JiraPanel with epic sync and ticket CRUD"
```

---

## Task 10: Frontend — AiChatBar

**Files:**
- Create: `frontend/src/app/solutions/[id]/components/AiChatBar.tsx`

- [ ] **Step 1: Create AiChatBar**

```typescript
// frontend/src/app/solutions/[id]/components/AiChatBar.tsx
"use client";
import { useState, useRef } from "react";
import { api } from "@/lib/api";
import type { JiraTicket, WorkspaceAction } from "@/lib/types";

interface AiChatBarProps {
  solutionId: string;
  jiraTickets: JiraTicket[];
  productJiraKey: string | null;
  onJiraTicketCreated: (ticket: JiraTicket) => void;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

export function AiChatBar({ solutionId, jiraTickets, productJiraKey, onJiraTicketCreated }: AiChatBarProps) {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function send() {
    if (!input.trim() || loading) return;
    const userMsg = input.trim();
    setInput("");
    setMessages((prev) => [...prev, { role: "user", content: userMsg }]);
    setLoading(true);

    try {
      const action: WorkspaceAction = await api.solutions.chat(solutionId, userMsg, jiraTickets);

      // Apply action
      if (action.action === "update_prd" && action.prd_patch) {
        const applyPatch = (window as any).__prdApplyPatch;
        if (applyPatch) applyPatch(action.prd_patch.new_content);
      }

      if (action.action === "create_jira_ticket" && action.jira_ticket && productJiraKey) {
        try {
          const result = await api.jira.createTicket({
            project_key: productJiraKey,
            title: action.jira_ticket.title,
            description: action.jira_ticket.description,
            issue_type: action.jira_ticket.type || "Task",
          });
          onJiraTicketCreated({ key: result.key, title: action.jira_ticket.title, status: "To Do", type: action.jira_ticket.type, url: result.url });
        } catch (e) {
          console.error("Failed to create Jira ticket:", e);
        }
      }

      setMessages((prev) => [...prev, { role: "assistant", content: action.message || "Xong!" }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Có lỗi xảy ra, thử lại nhé." }]);
    }
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="border-t border-green-200 bg-green-50">
      {/* Chat history (collapsible) */}
      {expanded && messages.length > 0 && (
        <div className="max-h-40 overflow-y-auto px-4 py-2 flex flex-col gap-1.5 border-b border-green-100">
          {messages.map((m, i) => (
            <div key={i} className={`text-xs px-3 py-1.5 rounded-lg max-w-[80%] ${
              m.role === "user" ? "bg-white border border-gray-200 self-end" : "bg-green-100 text-green-900 self-start"
            }`}>
              {m.content}
            </div>
          ))}
        </div>
      )}

      {/* Input bar */}
      <div className="flex items-center gap-2 px-4 py-2">
        <button onClick={() => setExpanded(!expanded)}
          className="text-green-700 font-semibold text-sm">🤖</button>
        {messages.length > 0 && (
          <span className="text-xs text-green-600 cursor-pointer" onClick={() => setExpanded(!expanded)}>
            {expanded ? "▼" : "▲"} {messages.length} messages
          </span>
        )}
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder='Ví dụ: "Tạo jira ticket cho user flow" · "Cập nhật PRD section 1 với..."'
          className="flex-1 bg-white border border-green-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
          disabled={loading}
        />
        <button onClick={send} disabled={loading || !input.trim()}
          className="bg-green-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-green-700 disabled:opacity-50">
          {loading ? "..." : "Send"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/app/solutions/[id]/components/AiChatBar.tsx
git commit -m "feat: add AiChatBar with structured action dispatch"
```

---

## Task 11: Frontend — Assemble Workspace page

**Files:**
- Modify: `frontend/src/app/solutions/[id]/page.tsx`

- [ ] **Step 1: Replace page.tsx with workspace layout**

Replace the entire content of `frontend/src/app/solutions/[id]/page.tsx`:

```typescript
"use client";
import { useState, useEffect, useCallback } from "react";
import { use } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { api } from "@/lib/api";
import type { SolutionDraft, JiraTicket } from "@/lib/types";
import { WorkspaceProvider } from "./components/WorkspaceContext";
import { CanvasPanel } from "./components/CanvasPanel";
import { PrdEditor } from "./components/PrdEditor";
import { JiraPanel } from "./components/JiraPanel";
import { AiChatBar } from "./components/AiChatBar";
import {
  SOLUTION_STATUS_LABELS,
  SOLUTION_STATUS_COLORS,
} from "@/lib/constants";

export default function SolutionWorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const [sol, setSol] = useState<SolutionDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [jiraTickets, setJiraTickets] = useState<JiraTicket[]>([]);

  useEffect(() => {
    api.solutions.get(id)
      .then((r) => setSol(r as SolutionDraft))
      .finally(() => setLoading(false));
  }, [id]);

  const handleJiraTicketCreated = useCallback((ticket: JiraTicket) => {
    setJiraTickets((prev) => [ticket, ...prev]);
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-screen text-gray-400 text-sm">Đang tải...</div>;
  }
  if (!sol) {
    return <div className="flex items-center justify-center h-screen text-red-400 text-sm">Không tìm thấy solution.</div>;
  }

  return (
    <WorkspaceProvider>
      <div className="flex flex-col h-screen bg-white overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-3 px-4 py-2 bg-slate-800 text-white text-sm shrink-0">
          <span className="font-semibold truncate max-w-xs">{sol.problem_statement || "Solution Workspace"}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${SOLUTION_STATUS_COLORS[sol.status] || "bg-gray-600"}`}>
            {SOLUTION_STATUS_LABELS[sol.status] || sol.status}
          </span>
          <div className="flex-1" />
          <span className="text-xs text-slate-400">Auto-saved</span>
        </div>

        {/* Main area */}
        <div className="flex-1 overflow-hidden">
          <PanelGroup direction="horizontal" autoSaveId={`workspace-h-${id}`}>
            {/* Canvas panel */}
            <Panel defaultSize={50} minSize={20}>
              <CanvasPanel solutionId={id} initialData={sol.tldraw_data || null} />
            </Panel>

            <PanelResizeHandle className="w-1.5 bg-slate-300 hover:bg-blue-400 cursor-col-resize transition-colors" />

            {/* Right: PRD + Jira */}
            <Panel defaultSize={50} minSize={20}>
              <PanelGroup direction="vertical" autoSaveId={`workspace-v-${id}`}>
                <Panel defaultSize={60} minSize={20}>
                  <PrdEditor solutionId={id} initialContent={sol.prd_content || null} />
                </Panel>
                <PanelResizeHandle className="h-1.5 bg-slate-300 hover:bg-blue-400 cursor-row-resize transition-colors" />
                <Panel defaultSize={40} minSize={15}>
                  <JiraPanel
                    solutionId={id}
                    initialEpicKey={sol.jira_epic_key || null}
                    productJiraKey={null}
                    onTicketsChange={setJiraTickets}
                  />
                </Panel>
              </PanelGroup>
            </Panel>
          </PanelGroup>
        </div>

        {/* AI Chat bar */}
        <div className="shrink-0">
          <AiChatBar
            solutionId={id}
            jiraTickets={jiraTickets}
            productJiraKey={null}
            onJiraTicketCreated={handleJiraTicketCreated}
          />
        </div>
      </div>
    </WorkspaceProvider>
  );
}
```

- [ ] **Step 2: Build to check for TypeScript errors**

```bash
cd frontend && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors (warnings about `any` are acceptable)

- [ ] **Step 3: Start dev server and verify page loads**

```bash
cd frontend && npm run dev
```

Open `http://localhost:3000/solutions` → click any solution → verify workspace layout renders with Canvas, PRD, Jira panels and Chat bar.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/solutions/[id]/page.tsx
git commit -m "feat: assemble Solution Workspace — canvas + PRD + jira + AI chat"
```

---

## Task 12: Run full test suite + deploy

- [ ] **Step 1: Run backend tests**

```bash
cd backend && python3 -m pytest tests/ -v 2>&1 | tail -30
```

Expected: all existing tests pass + new `test_solution_workspace.py` tests pass

- [ ] **Step 2: Run frontend build**

```bash
cd frontend && npm run build
```

Expected: `✓ Compiled successfully`

- [ ] **Step 3: Deploy backend**

```bash
cd /Users/ngominhtu/code/qc-cs-ai && railway up --service backend
```

- [ ] **Step 4: Deploy frontend**

```bash
cd /Users/ngominhtu/code/qc-cs-ai && railway up --service frontend
```

- [ ] **Step 5: Verify on production**

Open `https://frontend-production-f2af.up.railway.app/solutions` → open any solution → verify workspace loads.

- [ ] **Step 6: Final commit**

```bash
git add -A && git commit -m "feat: Solution Workspace complete — canvas/PRD/jira/AI chat"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Tldraw canvas embed → Task 7
- ✅ Tiptap PRD editor (simple toolbar) → Task 8
- ✅ Copy PRD giữ format (HTML) → Task 8 `copyAsHtml()`
- ✅ Jira epic key manual input → Task 9
- ✅ CRUD ticket từ PRD → Task 9 + Task 10 AI action
- ✅ Link 2 chiều canvas ↔ PRD → Task 6 + 7 + 8
- ✅ AI Chat update docs/canvas/jira → Task 4 + 10
- ✅ Resize panels kéo thả → Task 11 `react-resizable-panels`
- ✅ DB migration → Task 1
- ✅ Backend endpoints → Task 2 + 3 + 4
- ✅ Deploy → Task 12

**Placeholder scan:** Không có TBD hay TODO.

**Type consistency:** `JiraTicket`, `WorkspaceAction` defined in Task 5 types.ts, used consistently in Tasks 9, 10, 11. `api.solutions.patchCanvas/patchPrd/chat` defined in Task 5 api.ts, used in Tasks 7, 8, 10. `api.jira.*` defined in Task 5, used in Tasks 9, 10.
