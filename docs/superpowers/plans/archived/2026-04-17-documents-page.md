# Documents Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/documents` page with file-tree sidebar, markdown editor, and AI chat panel that auto-updates documents — replacing `kb_entries` as the AI context source for feedback analysis.

**Architecture:** New `product_documents` DB table stores markdown files indexed by `path`. A new FastAPI router handles CRUD + AI chat. The frontend is a single `page.tsx` with three components: `DocumentSidebar` (file tree), `DocumentEditor` (view/edit), `DocumentChatPanel` (bottom AI chat with `/` doc-tagging and diff-preview apply).

**Tech Stack:** Python FastAPI + SQLAlchemy async, Alembic, OpenAI gpt-4o, Next.js 15 App Router, TypeScript, TailwindCSS, `react-markdown` + `remark-gfm`, `diff` (npm)

---

## File Map

**Create:**
- `backend/models/document.py`
- `backend/schemas/document.py`
- `backend/api/routes/documents.py`
- `backend/alembic/versions/0015_product_documents.py`
- `backend/scripts/seed_documents.py`
- `frontend/src/app/documents/page.tsx`

**Modify:**
- `backend/main.py` — register documents router
- `backend/api/routes/feedbacks.py` — `_run_analysis_pipeline` reads from `product_documents`
- `frontend/src/components/NavBar.tsx` — add Documents link
- `frontend/src/lib/api.ts` — add `documents` API client
- `frontend/src/lib/types.ts` — add `ProductDocument`, `DocumentAction` types

---

### Task 1: DB Migration — create `product_documents` table

**Files:**
- Create: `backend/alembic/versions/0015_product_documents.py`
- Modify: `backend/models/document.py`

- [ ] **Step 1: Create the ORM model**

Create `backend/models/document.py`:

```python
from __future__ import annotations
from typing import Optional
from sqlalchemy import String, Text, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column
from core.database import Base
from models.base import gen_uuid


class ProductDocument(Base):
    __tablename__ = "product_documents"
    __table_args__ = (UniqueConstraint("product_id", "path", name="uq_product_document_path"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=gen_uuid)
    product_id: Mapped[Optional[str]] = mapped_column(String(36), ForeignKey("products.id", ondelete="CASCADE"), nullable=True)
    path: Mapped[str] = mapped_column(String(500), nullable=False)
    title: Mapped[str] = mapped_column(String(300), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False, default="")
    created_by: Mapped[Optional[str]] = mapped_column(String(200), nullable=True)
    created_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[object] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
```

- [ ] **Step 2: Create Alembic migration**

Create `backend/alembic/versions/0015_product_documents.py`:

```python
"""create product_documents table

Revision ID: 0015
Revises: 0014
Create Date: 2026-04-17
"""
from alembic import op
import sqlalchemy as sa

revision = '0015'
down_revision = '0014'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'product_documents',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('product_id', sa.String(36), sa.ForeignKey('products.id', ondelete='CASCADE'), nullable=True),
        sa.Column('path', sa.String(500), nullable=False),
        sa.Column('title', sa.String(300), nullable=False),
        sa.Column('content', sa.Text(), nullable=False, server_default=''),
        sa.Column('created_by', sa.String(200), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint('product_id', 'path', name='uq_product_document_path'),
    )


def downgrade() -> None:
    op.drop_table('product_documents')
```

- [ ] **Step 3: Run migration**

```bash
cd backend
python3 -m alembic upgrade head
```

Expected: `Running upgrade 0014 -> 0015, create product_documents table`

- [ ] **Step 4: Commit**

```bash
git add backend/models/document.py backend/alembic/versions/0015_product_documents.py
git commit -m "feat: add ProductDocument model and migration 0015"
```

---

### Task 2: Backend — Pydantic schemas + CRUD router

**Files:**
- Create: `backend/schemas/document.py`
- Create: `backend/api/routes/documents.py`
- Modify: `backend/main.py`

- [ ] **Step 1: Create schemas**

Create `backend/schemas/document.py`:

```python
from pydantic import BaseModel
from typing import Optional, Literal
from datetime import datetime


class DocumentOut(BaseModel):
    id: str
    product_id: Optional[str] = None
    path: str
    title: str
    content: str
    created_by: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DocumentCreate(BaseModel):
    product_id: Optional[str] = None
    path: str
    title: str
    content: str = ""
    created_by: Optional[str] = None


class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None


class DocumentAction(BaseModel):
    type: Literal["update_document"]
    document_path: str
    new_content: str


class DocumentChatRequest(BaseModel):
    message: str
    tagged_document_ids: list[str] = []


class DocumentChatResponse(BaseModel):
    reply: str
    actions: list[DocumentAction] = []
```

- [ ] **Step 2: Create CRUD router (5 endpoints)**

Create `backend/api/routes/documents.py`:

```python
from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from models.document import ProductDocument
from models.base import gen_uuid
from schemas.document import DocumentOut, DocumentCreate, DocumentUpdate, DocumentChatRequest, DocumentChatResponse, DocumentAction
from services import ai_service as _ai

router = APIRouter(prefix="/documents", tags=["documents"])


@router.get("", response_model=list[DocumentOut])
async def list_documents(product_id: Optional[str] = None, db: AsyncSession = Depends(get_db)):
    q = select(ProductDocument).order_by(ProductDocument.path)
    if product_id:
        q = q.where(ProductDocument.product_id == product_id)
    result = await db.execute(q)
    return result.scalars().all()


@router.post("", response_model=DocumentOut)
async def create_document(body: DocumentCreate, db: AsyncSession = Depends(get_db)):
    doc = ProductDocument(
        id=gen_uuid(),
        product_id=body.product_id,
        path=body.path,
        title=body.title,
        content=body.content,
        created_by=body.created_by,
    )
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc


@router.get("/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(ProductDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc


@router.patch("/{doc_id}", response_model=DocumentOut)
async def update_document(doc_id: str, body: DocumentUpdate, db: AsyncSession = Depends(get_db)):
    doc = await db.get(ProductDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    if body.title is not None:
        doc.title = body.title
    if body.content is not None:
        doc.content = body.content
    await db.commit()
    await db.refresh(doc)
    return doc


@router.delete("/{doc_id}")
async def delete_document(doc_id: str, db: AsyncSession = Depends(get_db)):
    doc = await db.get(ProductDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()
    return {"ok": True}
```

- [ ] **Step 3: Register router in main.py**

In `backend/main.py`, add to the imports line:

```python
from api.routes import issues, knowledge_base, jira_webhook, jira_workspace, telegram_webhook, upload, scoring, products, feedbacks, solutions, meetings, action_items, dashboard, auth_settings, priority_config, documents
```

Add after `app.include_router(priority_config.router, prefix="/api")`:

```python
app.include_router(documents.router, prefix="/api")
```

- [ ] **Step 4: Verify endpoints load**

```bash
cd backend
python3 -c "from api.routes.documents import router; print('OK', [r.path for r in router.routes])"
```

Expected output includes: `/documents`, `/documents/{doc_id}`

- [ ] **Step 5: Commit**

```bash
git add backend/schemas/document.py backend/api/routes/documents.py backend/main.py
git commit -m "feat: add documents CRUD router and schemas"
```

---

### Task 3: Backend — AI chat endpoint

**Files:**
- Modify: `backend/api/routes/documents.py` — add `POST /{doc_id}/chat`
- Modify: `backend/services/ai_service.py` — add `chat_with_document_context()`

- [ ] **Step 1: Add `chat_with_document_context` to ai_service.py**

Append to `backend/services/ai_service.py`:

```python
async def chat_with_document_context(
    active_doc_path: str,
    active_doc_content: str,
    tagged_docs: list[dict],  # [{"path": str, "content": str}]
    message: str,
) -> dict:
    """Chat with AI about documents. Returns {"reply": str, "actions": [...]}."""
    context_parts = [f"--- {active_doc_path} ---\n{active_doc_content}"]
    for d in tagged_docs:
        context_parts.append(f"--- {d['path']} ---\n{d['content']}")
    context = "\n\n".join(context_parts)

    system = (
        "Bạn là AI assistant giúp quản lý tài liệu sản phẩm của GHN CS team.\n"
        "Bạn có thể đọc và cập nhật tài liệu markdown.\n"
        "Nếu user yêu cầu cập nhật tài liệu, trả về JSON với cấu trúc sau:\n"
        '{"reply": "<giải thích ngắn>", "actions": [{"type": "update_document", "document_path": "<path>", "new_content": "<full markdown content>"}]}\n'
        "Nếu không cần cập nhật tài liệu, trả về:\n"
        '{"reply": "<câu trả lời>", "actions": []}\n'
        "Luôn trả về JSON hợp lệ. KHÔNG bao bọc trong markdown code block."
    )

    user_prompt = f"Tài liệu hiện tại:\n{context[:30000]}\n\nUser: {message}"

    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = response.choices[0].message.content or ""
        parsed = _parse_json_response(raw)
        return {
            "reply": parsed.get("reply", raw),
            "actions": parsed.get("actions", []),
        }
    except Exception as e:
        return {"reply": f"Lỗi: {e}", "actions": []}
```

- [ ] **Step 2: Add chat endpoint to documents router**

Append to `backend/api/routes/documents.py`:

```python
@router.post("/{doc_id}/chat", response_model=DocumentChatResponse)
async def chat_document(doc_id: str, body: DocumentChatRequest, db: AsyncSession = Depends(get_db)):
    doc = await db.get(ProductDocument, doc_id)
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    tagged_docs = []
    if body.tagged_document_ids:
        for tid in body.tagged_document_ids:
            tdoc = await db.get(ProductDocument, tid)
            if tdoc:
                tagged_docs.append({"path": tdoc.path, "content": tdoc.content})

    result = await _ai.chat_with_document_context(
        active_doc_path=doc.path,
        active_doc_content=doc.content,
        tagged_docs=tagged_docs,
        message=body.message,
    )
    return DocumentChatResponse(
        reply=result["reply"],
        actions=[DocumentAction(**a) for a in result.get("actions", [])],
    )
```

- [ ] **Step 3: Verify chat endpoint**

```bash
cd backend
python3 -c "
from api.routes.documents import router
paths = [r.path for r in router.routes]
assert '/documents/{doc_id}/chat' in paths, f'Missing chat route. Got: {paths}'
print('OK:', paths)
"
```

Expected: `OK: ['/documents', '/documents', '/documents/{doc_id}', '/documents/{doc_id}', '/documents/{doc_id}', '/documents/{doc_id}/chat']`

- [ ] **Step 4: Commit**

```bash
git add backend/api/routes/documents.py backend/services/ai_service.py
git commit -m "feat: add document AI chat endpoint"
```

---

### Task 4: Backend — wire documents into feedback analysis

**Files:**
- Modify: `backend/api/routes/feedbacks.py` — `_run_analysis_pipeline` reads `product_documents`

- [ ] **Step 1: Add import for ProductDocument in feedbacks.py**

At the top of `backend/api/routes/feedbacks.py`, add to imports:

```python
from models.document import ProductDocument
```

- [ ] **Step 2: Update `_run_analysis_pipeline` to use product_documents**

In `backend/api/routes/feedbacks.py`, find `_run_analysis_pipeline` (starts around line 85). Replace the kb_text loading block:

```python
async def _run_analysis_pipeline(db: AsyncSession, feedback: Feedback) -> Feedback:
    feedback.status = "analyzing"
    await db.flush()

    product_name = product_goal = kb_text = ""
    if feedback.product_id:
        product = await db.get(Product, feedback.product_id)
        if product:
            product_name = product.name
            product_goal = product.product_goal or ""
            # Use product_documents as KB context (fallback to product.kb_text)
            docs_result = await db.execute(
                select(ProductDocument).where(ProductDocument.product_id == feedback.product_id).order_by(ProductDocument.path)
            )
            docs = docs_result.scalars().all()
            if docs:
                kb_text = "\n\n".join(
                    f"# {d.title}\n{d.content}" for d in docs if d.content
                )
            else:
                kb_text = product.kb_text or ""
```

- [ ] **Step 3: Verify the import resolves**

```bash
cd backend
python3 -c "from api.routes.feedbacks import _run_analysis_pipeline; print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add backend/api/routes/feedbacks.py
git commit -m "feat: feedback analysis reads product_documents instead of kb_text"
```

---

### Task 5: Backend — seed script for 3 documents

**Files:**
- Create: `backend/scripts/seed_documents.py`

- [ ] **Step 1: Create seed script**

Create `backend/scripts/seed_documents.py`:

```python
"""Seed initial product documents from local markdown files.

Usage:
    cd backend
    python3 scripts/seed_documents.py

Set SEED_FILE_BASE env var or edit DOCS list paths below.
"""
import asyncio
import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from sqlalchemy import select
from core.database import AsyncSessionLocal
from models.document import ProductDocument
from models.product import Product
from models.base import gen_uuid

BASE = os.environ.get("SEED_FILE_BASE", "")

# Map: (product_name_contains, path, title, local_file_path)
DOCS = [
    (
        "CS Chat",
        "cs-chat/knowledge-base",
        "CS Chat — Knowledge Base",
        os.path.join(BASE, "/Users/ngominhtu/Library/Application Support/Claude/local-agent-mode-sessions/e3a9a04f-c42b-461f-b293-8f80a59161cf/a42eba0d-a1ee-4535-b144-a8270ebedba7/local_5afbab0e-db17-449f-9d4b-d79ec54a4f28/outputs/cs_chat_knowledge_base.md"),
    ),
    (
        "CS AI",
        "cs-ai/architecture",
        "CS AI — Kiến trúc & Tính năng",
        os.path.join(BASE, "/Users/ngominhtu/Library/Application Support/Claude/local-agent-mode-sessions/e3a9a04f-c42b-461f-b293-8f80a59161cf/a42eba0d-a1ee-4535-b144-a8270ebedba7/local_70e377d8-926c-4ef5-a748-42b69698522f/outputs/CS_AI_Knowledge_Page.md"),
    ),
    (
        "CS AI",
        "cs-ai/kb-c2c",
        "CS AI — Knowledge Base C2C",
        os.path.join(BASE, "/Users/ngominhtu/Library/Application Support/Claude/local-agent-mode-sessions/e3a9a04f-c42b-461f-b293-8f80a59161cf/a42eba0d-a1ee-4535-b144-a8270ebedba7/local_0b9bee1c-1989-470b-b8f6-01a116ea1ce2/outputs/knowledge_base_c2c.md"),
    ),
]


async def seed():
    async with AsyncSessionLocal() as db:
        # Load products
        products_result = await db.execute(select(Product))
        products = {p.name: p.id for p in products_result.scalars().all()}
        print("Products found:", list(products.keys()))

        for product_name_contains, path, title, file_path in DOCS:
            # Find matching product (case-insensitive contains)
            product_id = None
            for name, pid in products.items():
                if product_name_contains.lower() in name.lower():
                    product_id = pid
                    break

            if not product_id:
                print(f"[SKIP] No product matching '{product_name_contains}'")
                continue

            # Read file
            if not os.path.exists(file_path):
                print(f"[SKIP] File not found: {file_path}")
                continue
            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            # Check if already exists
            existing = await db.execute(
                select(ProductDocument).where(
                    ProductDocument.product_id == product_id,
                    ProductDocument.path == path,
                )
            )
            if existing.scalar_one_or_none():
                print(f"[SKIP] Already exists: {path}")
                continue

            doc = ProductDocument(
                id=gen_uuid(),
                product_id=product_id,
                path=path,
                title=title,
                content=content,
                created_by="seed",
            )
            db.add(doc)
            print(f"[INSERT] {path} ({len(content)} chars)")

        await db.commit()
        print("Seed complete.")


if __name__ == "__main__":
    asyncio.run(seed())
```

- [ ] **Step 2: Run seed script**

```bash
cd backend
python3 scripts/seed_documents.py
```

Expected output:
```
Products found: ['CS AI', 'CS Chat', 'Voice AI']
[INSERT] cs-chat/knowledge-base (... chars)
[INSERT] cs-ai/architecture (... chars)
[INSERT] cs-ai/kb-c2c (... chars)
Seed complete.
```

- [ ] **Step 3: Verify via API**

```bash
curl -s http://localhost:8000/api/documents | python3 -m json.tool | grep '"path"'
```

Expected: 3 paths listed.

- [ ] **Step 4: Commit**

```bash
git add backend/scripts/seed_documents.py
git commit -m "feat: add seed_documents script for initial KB content"
```

---

### Task 6: Frontend — types + API client

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`

- [ ] **Step 1: Add types to types.ts**

Append to `frontend/src/lib/types.ts`:

```typescript
export interface ProductDocument {
  id: string;
  product_id: string | null;
  path: string;
  title: string;
  content: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface DocumentAction {
  type: "update_document";
  document_path: string;
  new_content: string;
}

export interface DocumentChatMessage {
  role: "user" | "assistant";
  content: string;
  actions?: DocumentAction[];
}
```

- [ ] **Step 2: Add documents API client to api.ts**

In `frontend/src/lib/api.ts`, append inside the `api` object after `dashboard`:

```typescript
  documents: {
    list: (product_id?: string) =>
      request<any[]>(`/api/documents${product_id ? `?product_id=${product_id}` : ""}`),
    get: (id: string) => request<any>(`/api/documents/${id}`),
    create: (body: { product_id?: string; path: string; title: string; content?: string; created_by?: string }) =>
      request<any>("/api/documents", { method: "POST", body: JSON.stringify(body) }),
    update: (id: string, body: { title?: string; content?: string }) =>
      request<any>(`/api/documents/${id}`, { method: "PATCH", body: JSON.stringify(body) }),
    delete: (id: string) =>
      request<any>(`/api/documents/${id}`, { method: "DELETE" }),
    chat: (id: string, message: string, tagged_document_ids: string[]) =>
      request<{ reply: string; actions: any[] }>(`/api/documents/${id}/chat`, {
        method: "POST",
        body: JSON.stringify({ message, tagged_document_ids }),
      }),
  },
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep -v "node_modules" | head -20
```

Expected: no errors from `types.ts` or `api.ts`

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/lib/api.ts
git commit -m "feat: add ProductDocument types and documents API client"
```

---

### Task 7: Frontend — NavBar + install deps

**Files:**
- Modify: `frontend/src/components/NavBar.tsx`
- Install: `react-markdown`, `remark-gfm`, `diff`, `@types/diff`

- [ ] **Step 1: Install packages**

```bash
cd frontend
npm install react-markdown remark-gfm diff
npm install --save-dev @types/diff
```

Expected: packages added to `package.json`

- [ ] **Step 2: Add Documents to NAV_LINKS in NavBar.tsx**

In `frontend/src/components/NavBar.tsx`, find `NAV_LINKS` array and add Documents before "Cài đặt":

```typescript
const NAV_LINKS = [
  { href: "/", label: "Dashboard" },
  { href: "/feedback", label: "Phản hồi" },
  { href: "/solutions", label: "Solutions" },
  { href: "/meetings", label: "Meetings" },
  { href: "/actions", label: "Actions" },
  { href: "/documents", label: "Documents" },
  { href: "/settings", label: "Cài đặt" },
];
```

- [ ] **Step 3: Verify NavBar renders**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "NavBar" | head -5
```

Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/NavBar.tsx frontend/package.json frontend/package-lock.json
git commit -m "feat: add Documents nav link, install react-markdown and diff"
```

---

### Task 8: Frontend — Documents page (Sidebar + Editor)

**Files:**
- Create: `frontend/src/app/documents/page.tsx`

- [ ] **Step 1: Create the page with DocumentSidebar and DocumentEditor**

Create `frontend/src/app/documents/page.tsx`:

```typescript
"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { diffLines, Change } from "diff";
import { api } from "@/lib/api";
import type { ProductDocument, DocumentAction, DocumentChatMessage } from "@/lib/types";

// ─── File Tree ────────────────────────────────────────────────────────────────

interface TreeNode {
  name: string;
  fullPath: string;
  doc?: ProductDocument;
  children: TreeNode[];
}

function buildTree(docs: ProductDocument[]): TreeNode[] {
  const root: TreeNode[] = [];

  for (const doc of docs) {
    const parts = doc.path.split("/");
    let nodes = root;
    for (let i = 0; i < parts.length; i++) {
      const name = parts[i];
      const fullPath = parts.slice(0, i + 1).join("/");
      let node = nodes.find(n => n.name === name);
      if (!node) {
        node = { name, fullPath, children: [] };
        nodes.push(node);
      }
      if (i === parts.length - 1) node.doc = doc;
      nodes = node.children;
    }
  }
  return root;
}

function TreeNodeView({
  node,
  activeId,
  onSelect,
  depth = 0,
}: {
  node: TreeNode;
  activeId: string | null;
  onSelect: (doc: ProductDocument) => void;
  depth?: number;
}) {
  const [open, setOpen] = useState(true);
  const isFolder = node.children.length > 0;
  const isActive = node.doc?.id === activeId;

  return (
    <div>
      {node.doc ? (
        <button
          onClick={() => onSelect(node.doc!)}
          className={`w-full text-left px-2 py-1 rounded text-sm truncate flex items-center gap-1 ${
            isActive ? "bg-blue-100 text-blue-800 font-medium" : "text-gray-700 hover:bg-gray-100"
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span className="text-gray-400 shrink-0">📄</span>
          <span className="truncate">{node.name}.md</span>
        </button>
      ) : (
        <button
          onClick={() => setOpen(o => !o)}
          className="w-full text-left px-2 py-1 text-sm font-medium text-gray-500 flex items-center gap-1 hover:bg-gray-50 rounded"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <span>{open ? "▾" : "▸"}</span>
          <span>{node.name}</span>
        </button>
      )}
      {isFolder && open && (
        <div>
          {node.children.map(child => (
            <TreeNodeView key={child.fullPath} node={child} activeId={activeId} onSelect={onSelect} depth={depth + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function DocumentSidebar({
  docs,
  activeId,
  onSelect,
  onNewDoc,
}: {
  docs: ProductDocument[];
  activeId: string | null;
  onSelect: (doc: ProductDocument) => void;
  onNewDoc: () => void;
}) {
  const tree = buildTree(docs);
  return (
    <div className="w-60 shrink-0 border-r border-gray-200 bg-gray-50 flex flex-col h-full">
      <div className="p-3 border-b border-gray-200">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Tài liệu</p>
      </div>
      <div className="flex-1 overflow-y-auto py-2 px-1">
        {tree.map(node => (
          <TreeNodeView key={node.fullPath} node={node} activeId={activeId} onSelect={onSelect} />
        ))}
        {docs.length === 0 && (
          <p className="text-xs text-gray-400 px-3 py-2">Chưa có tài liệu nào.</p>
        )}
      </div>
      <div className="p-3 border-t border-gray-200">
        <button
          onClick={onNewDoc}
          className="w-full text-sm text-blue-600 hover:text-blue-800 text-left px-1"
        >
          + New file
        </button>
      </div>
    </div>
  );
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function DocumentEditor({
  doc,
  pendingContent,
  onSaved,
  onClearPending,
}: {
  doc: ProductDocument | null;
  pendingContent: string | null;
  onSaved: (updated: ProductDocument) => void;
  onClearPending: () => void;
}) {
  const [editMode, setEditMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (doc) {
      setDraft(doc.content);
      setEditMode(false);
    }
  }, [doc?.id]);

  // When AI action arrives, open editor with pending content
  useEffect(() => {
    if (pendingContent !== null) {
      setDraft(pendingContent);
      setEditMode(true);
    }
  }, [pendingContent]);

  async function handleSave() {
    if (!doc) return;
    setSaving(true);
    try {
      const updated = await api.documents.update(doc.id, { content: draft });
      onSaved(updated as ProductDocument);
      setEditMode(false);
      onClearPending();
    } finally {
      setSaving(false);
    }
  }

  if (!doc) {
    return (
      <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">
        Chọn tài liệu từ sidebar để xem
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      <div className="flex items-center justify-between px-6 py-3 border-b border-gray-200 shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-gray-900">{doc.title}</h1>
          <p className="text-xs text-gray-400">{doc.path}.md</p>
        </div>
        <div className="flex items-center gap-2">
          {editMode ? (
            <>
              <button
                onClick={() => { setEditMode(false); setDraft(doc.content); onClearPending(); }}
                className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded border border-gray-200"
              >
                Huỷ
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? "Đang lưu..." : "💾 Lưu"}
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditMode(true)}
              className="text-sm text-gray-600 hover:text-gray-900 px-3 py-1.5 rounded border border-gray-200"
            >
              ✏️ Edit
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {editMode ? (
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            className="w-full h-full min-h-[400px] p-6 font-mono text-sm text-gray-800 resize-none focus:outline-none border-none"
            spellCheck={false}
          />
        ) : (
          <div className="prose prose-sm max-w-none p-6">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{doc.content || "_Tài liệu trống. Nhấn ✏️ Edit để bắt đầu._"}</ReactMarkdown>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Diff Preview ─────────────────────────────────────────────────────────────

function DiffPreview({
  oldContent,
  newContent,
  docPath,
  onApply,
  onDismiss,
}: {
  oldContent: string;
  newContent: string;
  docPath: string;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const changes: Change[] = diffLines(oldContent, newContent);
  const hasChanges = changes.some(c => c.added || c.removed);

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden my-2">
      <div className="flex items-center justify-between px-3 py-1.5 bg-gray-50 border-b border-gray-200">
        <span className="text-xs font-medium text-gray-600">📄 {docPath}.md</span>
        <div className="flex items-center gap-2">
          <button onClick={onApply} className="text-xs bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700">
            ✅ Apply
          </button>
          <button onClick={onDismiss} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-0.5 rounded border border-gray-200">
            ✗ Bỏ qua
          </button>
        </div>
      </div>
      {hasChanges ? (
        <div className="font-mono text-xs max-h-40 overflow-y-auto">
          {changes.map((change, i) => {
            if (!change.added && !change.removed) return null;
            const lines = change.value.split("\n").filter((l, idx, arr) => idx < arr.length - 1 || l !== "");
            return lines.map((line, j) => (
              <div
                key={`${i}-${j}`}
                className={`px-3 py-0.5 ${change.added ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
              >
                {change.added ? "+ " : "- "}{line}
              </div>
            ));
          })}
        </div>
      ) : (
        <p className="text-xs text-gray-400 px-3 py-2">Không có thay đổi.</p>
      )}
    </div>
  );
}

// ─── Chat Panel ───────────────────────────────────────────────────────────────

function DocumentChatPanel({
  activeDoc,
  allDocs,
  onApplyAction,
}: {
  activeDoc: ProductDocument | null;
  allDocs: ProductDocument[];
  onApplyAction: (docPath: string, newContent: string) => void;
}) {
  const [messages, setMessages] = useState<DocumentChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [taggedDocs, setTaggedDocs] = useState<ProductDocument[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [dropdownFilter, setDropdownFilter] = useState("");
  const [sending, setSending] = useState(false);
  const [dismissedActions, setDismissedActions] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleInputChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setInput(val);
    const lastSlash = val.lastIndexOf("/");
    if (lastSlash !== -1 && lastSlash === val.length - 1) {
      setShowDropdown(true);
      setDropdownFilter("");
    } else if (lastSlash !== -1 && lastSlash < val.length - 1 && showDropdown) {
      setDropdownFilter(val.slice(lastSlash + 1));
    } else if (!val.includes("/")) {
      setShowDropdown(false);
    }
  }

  function handleTagDoc(doc: ProductDocument) {
    if (!taggedDocs.find(d => d.id === doc.id)) {
      setTaggedDocs(prev => [...prev, doc]);
    }
    // Remove the slash trigger from input
    const lastSlash = input.lastIndexOf("/");
    setInput(lastSlash !== -1 ? input.slice(0, lastSlash) : input);
    setShowDropdown(false);
  }

  function removeTag(docId: string) {
    setTaggedDocs(prev => prev.filter(d => d.id !== docId));
  }

  async function handleSend() {
    if (!input.trim() || !activeDoc) return;
    const msg = input.trim();
    setInput("");
    setTaggedDocs([]);
    setMessages(prev => [...prev, { role: "user", content: msg }]);
    setSending(true);
    try {
      const res = await api.documents.chat(activeDoc.id, msg, taggedDocs.map(d => d.id));
      setMessages(prev => [...prev, {
        role: "assistant",
        content: res.reply,
        actions: res.actions as DocumentAction[],
      }]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: "assistant", content: `Lỗi: ${e.message}` }]);
    } finally {
      setSending(false);
    }
  }

  const filteredDocs = allDocs.filter(d =>
    d.path.toLowerCase().includes(dropdownFilter.toLowerCase()) ||
    d.title.toLowerCase().includes(dropdownFilter.toLowerCase())
  );

  return (
    <div className="border-t border-gray-200 flex flex-col bg-white" style={{ height: "220px" }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2 space-y-2 text-sm">
        {messages.length === 0 && (
          <p className="text-gray-400 text-xs pt-1">Chat với AI về tài liệu đang mở. Gõ <code>/</code> để tag thêm tài liệu.</p>
        )}
        {messages.map((msg, i) => (
          <div key={i}>
            <div className={`inline-block px-3 py-1.5 rounded-lg max-w-[90%] ${
              msg.role === "user"
                ? "bg-blue-600 text-white ml-auto block"
                : "bg-gray-100 text-gray-800"
            }`}>
              {msg.content}
            </div>
            {msg.actions?.map((action, j) => {
              const actionKey = `${i}-${j}`;
              if (dismissedActions.has(actionKey)) return null;
              const targetDoc = allDocs.find(d => d.path === action.document_path);
              return (
                <DiffPreview
                  key={actionKey}
                  oldContent={targetDoc?.content ?? ""}
                  newContent={action.new_content}
                  docPath={action.document_path}
                  onApply={() => {
                    onApplyAction(action.document_path, action.new_content);
                    setDismissedActions(prev => new Set(prev).add(actionKey));
                  }}
                  onDismiss={() => setDismissedActions(prev => new Set(prev).add(actionKey))}
                />
              );
            })}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="border-t border-gray-100 px-3 py-2 relative">
        {/* Tagged doc chips */}
        {taggedDocs.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {taggedDocs.map(d => (
              <span key={d.id} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full border border-blue-200">
                /{d.path}
                <button onClick={() => removeTag(d.id)} className="text-blue-400 hover:text-blue-700">×</button>
              </span>
            ))}
          </div>
        )}

        {/* Slash dropdown */}
        {showDropdown && (
          <div className="absolute bottom-full left-3 right-3 mb-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto z-20">
            {filteredDocs.length === 0 ? (
              <p className="text-xs text-gray-400 px-3 py-2">Không tìm thấy tài liệu.</p>
            ) : (
              filteredDocs.map(d => (
                <button
                  key={d.id}
                  onClick={() => handleTagDoc(d)}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-gray-50 flex items-center gap-2"
                >
                  <span className="text-gray-400">📄</span>
                  <span className="font-mono text-gray-700">{d.path}.md</span>
                  <span className="text-gray-400 truncate">{d.title}</span>
                </button>
              ))
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={handleInputChange}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey && !showDropdown) {
                e.preventDefault();
                handleSend();
              }
              if (e.key === "Escape") setShowDropdown(false);
            }}
            placeholder={activeDoc ? `Hỏi về ${activeDoc.title}... (gõ / để tag tài liệu)` : "Chọn tài liệu trước"}
            disabled={!activeDoc || sending}
            rows={1}
            className="flex-1 resize-none text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:bg-gray-50"
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || !activeDoc || sending}
            className="shrink-0 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-lg hover:bg-blue-700 disabled:opacity-40"
          >
            {sending ? "..." : "→"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Doc Modal ────────────────────────────────────────────────────────────

function NewDocModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (doc: ProductDocument) => void;
}) {
  const [path, setPath] = useState("");
  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleCreate() {
    if (!path.trim() || !title.trim()) return;
    setSaving(true);
    try {
      const doc = await api.documents.create({ path: path.trim(), title: title.trim() });
      onCreate(doc as ProductDocument);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-[400px] shadow-xl space-y-4">
        <h2 className="text-lg font-semibold">Tạo tài liệu mới</h2>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Path (e.g. cs-ai/roadmap)</label>
          <input
            value={path}
            onChange={e => setPath(e.target.value)}
            placeholder="cs-ai/roadmap"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
          />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-1 block">Tiêu đề</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="CS AI — Roadmap"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="text-sm text-gray-500 px-3 py-1.5 rounded border border-gray-200">Huỷ</button>
          <button
            onClick={handleCreate}
            disabled={!path.trim() || !title.trim() || saving}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Đang tạo..." : "Tạo"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const [docs, setDocs] = useState<ProductDocument[]>([]);
  const [activeDoc, setActiveDoc] = useState<ProductDocument | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [pendingContent, setPendingContent] = useState<string | null>(null);

  useEffect(() => {
    api.documents.list().then(d => {
      const sorted = (d as ProductDocument[]).sort((a, b) => a.path.localeCompare(b.path));
      setDocs(sorted);
      if (sorted.length > 0 && !activeDoc) setActiveDoc(sorted[0]);
    });
  }, []);

  function handleDocSaved(updated: ProductDocument) {
    setDocs(prev => prev.map(d => d.id === updated.id ? updated : d));
    setActiveDoc(updated);
  }

  function handleApplyAction(docPath: string, newContent: string) {
    const target = docs.find(d => d.path === docPath);
    if (!target) return;
    // If it's the active doc, trigger editor with pending content
    if (target.id === activeDoc?.id) {
      setPendingContent(newContent);
    } else {
      // Otherwise patch directly
      api.documents.update(target.id, { content: newContent }).then(updated => {
        setDocs(prev => prev.map(d => d.id === (updated as ProductDocument).id ? updated as ProductDocument : d));
      });
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-56px)]">
      <div className="flex flex-1 min-h-0">
        <DocumentSidebar
          docs={docs}
          activeId={activeDoc?.id ?? null}
          onSelect={doc => { setActiveDoc(doc); setPendingContent(null); }}
          onNewDoc={() => setShowNewModal(true)}
        />
        <DocumentEditor
          doc={activeDoc}
          pendingContent={pendingContent}
          onSaved={handleDocSaved}
          onClearPending={() => setPendingContent(null)}
        />
      </div>
      <DocumentChatPanel
        activeDoc={activeDoc}
        allDocs={docs}
        onApplyAction={handleApplyAction}
      />
      {showNewModal && (
        <NewDocModal
          onClose={() => setShowNewModal(false)}
          onCreate={doc => {
            setDocs(prev => [...prev, doc].sort((a, b) => a.path.localeCompare(b.path)));
            setActiveDoc(doc);
            setShowNewModal(false);
          }}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd frontend
npx tsc --noEmit 2>&1 | grep "documents" | head -10
```

Expected: no errors

- [ ] **Step 3: Check page renders**

Navigate to `http://localhost:3000/documents` — should show sidebar with seeded docs, markdown rendered, AI chat panel at bottom.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/documents/page.tsx
git commit -m "feat: add Documents page with file-tree, markdown editor, AI chat"
```

---

### Task 9: End-to-end verification

- [ ] **Step 1: Run backend + frontend**

```bash
# Terminal 1
cd backend && python3 -m uvicorn main:app --reload --port 8000

# Terminal 2
cd frontend && npm run dev
```

- [ ] **Step 2: Seed documents (if not already done)**

```bash
cd backend && python3 scripts/seed_documents.py
```

- [ ] **Step 3: Manual smoke test checklist**

Navigate to `http://localhost:3000/documents`:

- [ ] Sidebar shows file tree with seeded docs (cs-ai, cs-chat folders)
- [ ] Click `cs-ai/architecture.md` → markdown renders in editor
- [ ] Click ✏️ Edit → textarea shows, content editable
- [ ] Edit something → 💾 Lưu → content updates, view mode returns
- [ ] AI chat panel visible at bottom
- [ ] Type a message → AI responds
- [ ] Type `/` in chat → dropdown shows doc list
- [ ] Select a doc from dropdown → chip appears in input
- [ ] Ask AI to "cập nhật tài liệu này thêm thông tin X" → AI returns action with diff preview
- [ ] Click ✅ Apply → document content updates
- [ ] Click "+ New file" → modal appears, create new doc → appears in sidebar

- [ ] **Step 4: Test feedback analysis still works**

```bash
curl -s -X POST http://localhost:8000/api/feedbacks/<feedback-id>/analyze | python3 -m json.tool | grep "root_cause"
```

Expected: analysis returns root_cause (now reads from product_documents if seeded).

- [ ] **Step 5: Commit final**

```bash
git add -A
git commit -m "feat: Documents page complete — file-tree, markdown editor, AI chat, doc analysis integration"
```
