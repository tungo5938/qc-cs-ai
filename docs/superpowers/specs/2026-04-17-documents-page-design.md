# Documents Page — Design Spec

**Date:** 2026-04-17
**Status:** Approved

---

## Overview

Trang `/documents` mới cho phép PM quản lý tài liệu sản phẩm (overview, PRD, roadmap, execution notes) theo cấu trúc file-tree, với markdown editor và AI chat ở dưới có khả năng tự động cập nhật tài liệu. Thay thế `kb_entries` làm nguồn context cho AI phân tích feedback.

---

## Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ NavBar: ... [Documents]                                         │
├──────────────────┬──────────────────────────────────────────────┤
│ SIDEBAR (240px)  │  EDITOR (flex-1)                            │
│                  │                                              │
│ ▼ cs-ai          │  # CS AI — Overview                         │
│   overview.md  ● │                                              │
│   prd.md         │  Lorem ipsum...                              │
│   roadmap.md     │                                              │
│   ▼ execution    │              [✏️ Edit]  [💾 Save]            │
│     sprint-1.md  │                                              │
│ ▼ cs-chat        │                                              │
│ ▼ voice-ai       │                                              │
│ [+ New file]     │                                              │
├──────────────────┴──────────────────────────────────────────────┤
│ AI CHAT (resizable, default ~220px)                             │
│ ─────────────────────────────────────────────────────────────── │
│ [AI]: Đã cập nhật `cs-ai/overview.md`...                       │
│ [diff preview block] [✅ Apply] [✗ Bỏ qua]                      │
│ ─────────────────────────────────────────────────────────────── │
│ [/cs-ai/roadmap.md ×]  [input — gõ / để tag doc...]  [→ Gửi]  │
└─────────────────────────────────────────────────────────────────┘
```

- Sidebar: click file → mở trong editor. Folder có thể expand/collapse.
- Editor: mặc định render markdown. Nút ✏️ Edit → chuyển sang `<textarea>`. Nút 💾 Save → PATCH API.
- AI Chat: horizontal panel, resize được. Document đang mở là context mặc định. Gõ `/` → dropdown tag doc khác.

---

## Database

### Bảng mới: `product_documents`

```sql
CREATE TABLE product_documents (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id  UUID REFERENCES products(id) ON DELETE CASCADE,  -- nullable (doc chung)
  path        VARCHAR NOT NULL,   -- e.g. "cs-ai/execution/sprint-1"
  title       VARCHAR NOT NULL,   -- display name, e.g. "Sprint 1"
  content     TEXT NOT NULL DEFAULT '',
  created_by  VARCHAR,
  created_at  TIMESTAMP DEFAULT now(),
  updated_at  TIMESTAMP DEFAULT now(),
  UNIQUE (product_id, path)
);
```

`path` dùng `/` để phân cấp folder. Folder không có row riêng — được suy ra từ prefix của `path`.

---

## Backend

### File structure mới

```
backend/
├── models/document.py              # ProductDocument ORM model
├── schemas/document.py             # Pydantic schemas
├── api/routes/documents.py         # 6 endpoints
├── alembic/versions/0015_product_documents.py
└── scripts/seed_documents.py       # seed 3 tài liệu vào DB
```

### API Endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/documents` | List (optional `?product_id=`) |
| `POST` | `/api/documents` | Create doc |
| `GET` | `/api/documents/{id}` | Get single |
| `PATCH` | `/api/documents/{id}` | Update content/title |
| `DELETE` | `/api/documents/{id}` | Delete |
| `POST` | `/api/documents/{id}/chat` | AI chat with doc context |

### Schemas

```python
class DocumentOut(BaseModel):
    id: str
    product_id: Optional[str]
    path: str
    title: str
    content: str
    created_by: Optional[str]
    created_at: datetime
    updated_at: datetime

class DocumentCreate(BaseModel):
    product_id: Optional[str] = None
    path: str
    title: str
    content: str = ""
    created_by: Optional[str] = None

class DocumentUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None

class DocumentChatRequest(BaseModel):
    message: str
    tagged_document_ids: list[str] = []  # doc IDs tagged với /

class DocumentAction(BaseModel):
    type: Literal["update_document"]
    document_path: str
    new_content: str

class DocumentChatResponse(BaseModel):
    reply: str
    actions: list[DocumentAction] = []
```

### `POST /api/documents/{id}/chat`

Flow:
1. Load content của doc hiện tại (`{id}`)
2. Load content của tất cả `tagged_document_ids` (nếu có)
3. Build system prompt:
   ```
   Bạn là AI assistant giúp quản lý tài liệu sản phẩm.
   Context tài liệu đang mở:
   --- {path} ---
   {content}

   [Nếu có tagged docs:]
   --- {tagged_path} ---
   {tagged_content}

   Nếu user yêu cầu cập nhật tài liệu, trả về JSON với field "actions".
   ```
4. Gọi gpt-4o với structured output — response JSON: `{ "reply": str, "actions": [...] }`
5. Trả về `DocumentChatResponse`

AI chỉ trả về `actions` khi user rõ ràng yêu cầu update. Không tự ý thay đổi nếu không được yêu cầu.

---

## Frontend

### File structure mới

```
frontend/src/app/documents/
└── page.tsx          # toàn bộ Documents page
```

### Components trong `page.tsx`

**`DocumentSidebar`**
- Nhận `documents: DocumentOut[]`
- Group theo `path` prefix → build tree: `{ name, path, children, doc? }`
- Render: folder có thể toggle, file click → `onSelect(doc)`
- "+ New file" → modal nhập path + title → POST `/api/documents`

**`DocumentEditor`**
- Nhận `doc: DocumentOut | null`, `onSaved(doc)`
- Khi `doc` null: hiển thị placeholder "Chọn tài liệu từ sidebar"
- `viewMode`: render `<ReactMarkdown>{content}</ReactMarkdown>` + nút ✏️ Edit
- `editMode`: `<textarea>` full height + nút 💾 Save (PATCH) + Huỷ
- Auto-apply: nếu nhận `pendingContent` từ AI action → pre-fill textarea trong editMode, user thấy diff rõ

**`DocumentChatPanel`**
- Fixed bottom, default height 220px, drag-to-resize
- State: `messages: {role, content, actions?}[]`, `input: string`, `taggedDocs: DocumentOut[]`
- Gõ `/` trong input → hiển thị dropdown filter tất cả docs → chọn → thêm chip tag
- Submit → POST `/api/documents/{activeDocId}/chat` với `{ message, tagged_document_ids }`
- Nhận response → render message + nếu có `actions`: hiển thị diff block per action + [✅ Apply] / [✗ Bỏ qua]
- Apply → gọi PATCH doc → update sidebar + editor content

**Diff preview block:**
```
┌─ cs-ai/roadmap.md ──────────────────────────┐
│ - Sprint 2: tính năng A                      │  (red)
│ + Sprint 2: tính năng A + B                  │  (green)
│ + Sprint 3: tính năng X                      │  (green)
└──────────────────────────────────────────────┘
[✅ Apply]  [✗ Bỏ qua]
```
Dùng thư viện `diff` (npm) để compute line diff giữa old content và `new_content` từ action.

### State flow

```
page.tsx
  activeDoc ─────────→ DocumentEditor
  documents[] ────────→ DocumentSidebar
  activeDoc ─────────→ DocumentChatPanel (default context)
                        ↓ onApplyAction(docPath, newContent)
                        → find doc by path → PATCH → update documents[]
```

### API client additions (`api.ts`)

```ts
documents: {
  list: (product_id?: string) => request<DocumentOut[]>(`/api/documents${product_id ? `?product_id=${product_id}` : ''}`),
  get: (id: string) => request<DocumentOut>(`/api/documents/${id}`),
  create: (body: DocumentCreate) => request<DocumentOut>('/api/documents', { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: { title?: string; content?: string }) => request<DocumentOut>(`/api/documents/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: (id: string) => request<void>(`/api/documents/${id}`, { method: 'DELETE' }),
  chat: (id: string, message: string, tagged_document_ids: string[]) =>
    request<{ reply: string; actions: DocumentAction[] }>(`/api/documents/${id}/chat`, { method: 'POST', body: JSON.stringify({ message, tagged_document_ids }) }),
}
```

### Types additions (`types.ts`)

```ts
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
```

---

## AI Integration — Feedback Analysis

Trong `backend/services/ai_service.py`:

- Thêm hàm `async def _doc_context(product_id: str) -> str` — query `product_documents` theo `product_id`, nối content lại
- Hàm `analyze_feedback()` hiện dùng `_kb_context()` → đổi sang dùng `_doc_context(product_id)` nếu product có docs, fallback về `_kb_context()` nếu không có

---

## Seed Script

`backend/scripts/seed_documents.py` — chạy một lần khi deploy:

```python
SEED_DOCS = [
    {
        "product_slug": "cs-chat",   # match product name
        "path": "cs-chat/knowledge-base",
        "title": "CS Chat — Knowledge Base",
        "file": "/path/to/cs_chat_knowledge_base.md",
    },
    {
        "product_slug": "cs-ai",
        "path": "cs-ai/architecture",
        "title": "CS AI — Kiến trúc & Tính năng",
        "file": "/path/to/CS_AI_Knowledge_Page.md",
    },
    {
        "product_slug": "cs-ai",
        "path": "cs-ai/kb-c2c",
        "title": "CS AI — Knowledge Base C2C",
        "file": "/path/to/knowledge_base_c2c.md",
    },
]
```

Script lookup `product_id` từ `products` table theo name, insert nếu `(product_id, path)` chưa tồn tại.

---

## NavBar

Thêm link "Documents" vào NavBar (giữa "Actions" và "Cài đặt").

---

## Packages cần thêm

**Frontend:**
- `react-markdown` + `remark-gfm` (render markdown — đã có thể đã có trong project)
- `diff` (npm) — compute line diff cho preview

**Backend:**
- Không cần thêm package

---

## Tech Notes

- `product_documents.path` không có extension `.md` trong DB — chỉ hiển thị `.md` trên UI
- Folder là virtual: `"cs-ai/execution/sprint-1"` → folder `cs-ai` > `execution` > file `sprint-1`
- AI chat history không persist (in-memory per session) — đủ cho MVP
- `DocumentChatPanel` resize: dùng `mousedown` + `mousemove` trên drag handle div
- Diff display: simple line-by-line, không cần inline word diff
