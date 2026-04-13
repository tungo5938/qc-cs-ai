# Solution Workspace — Design Spec

**Date:** 2026-04-13
**Module:** Solutions (`/solutions/[id]`)
**Status:** Approved

---

## Overview

Nâng cấp trang Solution Detail thành một workspace tích hợp 4 thành phần: Canvas (Tldraw), PRD Editor (Tiptap), Jira Tickets, và AI Chat. Mục tiêu giúp PM/QC trình bày ý tưởng, viết tài liệu, quản lý Jira ticket, và cập nhật mọi thứ qua AI — tất cả trong một view duy nhất.

---

## Layout

```
┌─────────────────────────────────────────────────────┐
│  Toolbar: Solution title · status · auto-save        │
├──────────────────────┬──────────────────────────────┤
│                      │  📄 PRD Editor (Tiptap)       │
│  🎨 Canvas (Tldraw)  │  ─────── resize handle ────── │
│                      │  🎫 Jira Tickets              │
├──────────────────────┴──────────────────────────────┤
│  🤖 AI Chat bar (full width)                         │
└─────────────────────────────────────────────────────┘
```

- **Canvas | PRD+Jira:** Chia 2 cột, có drag handle dọc để resize tỉ lệ
- **PRD | Jira:** Chia 2 hàng trong cột phải, có drag handle ngang để resize chiều cao
- **AI Chat:** Full width, cố định ở dưới cùng

---

## Components

### 1. Canvas — Tldraw

- Nhúng `@tldraw/tldraw` React component
- Dữ liệu canvas (`tldraw_data: JSON`) lưu trong cột mới của bảng `solution_drafts`
- Auto-save mỗi 2 giây khi có thay đổi (debounce)
- Mỗi shape có thể gắn `anchor_id` (metadata trong shape props) để link sang PRD section

**Link 2 chiều Canvas ↔ PRD:**
- Click shape có `anchor_id` → PRD scroll đến section có `id` tương ứng + highlight 2 giây
- Click heading/section trong PRD → canvas highlight (flash border) shape có `anchor_id` tương ứng
- Implement qua React context `WorkspaceContext` — Canvas và PRD đều subscribe vào `activeAnchor` state

### 2. PRD Editor — Tiptap

- Dùng `@tiptap/react` với extensions: `Bold`, `Italic`, `Heading` (H1-H3), `BulletList`, `Paragraph`
- Toolbar đơn giản: B · I · H1 · H2 · Bullet list
- Mỗi heading/paragraph có thể set `data-anchor-id` attribute để link từ canvas
- Dữ liệu PRD (`prd_content: JSON`) lưu trong cột mới của bảng `solution_drafts`
- Auto-save debounce 2 giây

### 3. Jira Tickets

- Input nhập Epic key thủ công (ví dụ `CSAI-10`)
- Nút **Sync**: gọi `GET /api/jira/epic/{epic_key}/tickets` → fetch tất cả tickets thuộc epic
- Hiển thị list: key · title · status · nút edit inline
- **CRUD:**
  - **Create:** Nút "+ New ticket" → modal nhỏ (title, type, description) → `POST /api/jira/tickets`
  - **Update:** Click ✏️ → inline edit title/status → `PATCH /api/jira/tickets/{key}`
  - **Delete:** Không hỗ trợ xóa từ portal (Jira policy)
- Epic key được lưu trong `jira_epic_key` (cột mới trong `solution_drafts`)

### 4. AI Chat

- Input text full width ở dưới cùng
- Gửi message kèm context: `{ prd_content, canvas_data, jira_tickets, solution_id }`
- AI (OpenAI GPT-4o) nhận context + user message → trả về structured action:
  ```json
  {
    "action": "update_prd" | "create_jira_ticket" | "update_canvas" | "reply_only",
    "prd_patch": { "section_id": "...", "new_content": "..." },
    "jira_ticket": { "title": "...", "description": "...", "type": "..." },
    "canvas_patch": { "shape_id": "...", "label": "..." },
    "message": "Đã cập nhật PRD section 2..."
  }
  ```
- Frontend apply action tương ứng: patch Tiptap editor / tạo Jira ticket / update Tldraw shape
- Chat history lưu trong `solution_chat_history: JSON[]` (cột mới trong `solution_drafts`)
- Hiển thị lịch sử chat trong session (không cần persist cross-session)

### 5. Resize Panels

- Dùng thư viện `react-resizable-panels` cho cả drag handle dọc và ngang
- Lưu tỉ lệ panel vào `localStorage` theo `solution_id` để nhớ preference

---

## Data Model Changes

### `solution_drafts` table — thêm cột:

| Column | Type | Default | Note |
|--------|------|---------|------|
| `prd_content` | `JSONB` | `null` | Tiptap JSON document |
| `tldraw_data` | `JSONB` | `null` | Tldraw snapshot JSON |
| `jira_epic_key` | `TEXT` | `null` | Epic key để sync tickets |
| `solution_chat_history` | `JSONB` | `[]` | Chat messages array |

### New API Endpoints:

| Method | Path | Purpose |
|--------|------|---------|
| `PATCH` | `/api/solutions/{id}/canvas` | Save tldraw snapshot |
| `PATCH` | `/api/solutions/{id}/prd` | Save PRD content |
| `GET` | `/api/jira/epic/{epic_key}/tickets` | Fetch tickets by epic |
| `POST` | `/api/jira/tickets` | Create Jira ticket |
| `PATCH` | `/api/jira/tickets/{key}` | Update Jira ticket |
| `POST` | `/api/solutions/{id}/chat` | Send AI chat message |

---

## Frontend Files

```
frontend/src/app/solutions/[id]/
├── page.tsx                  # Refactor thành SolutionWorkspace
├── components/
│   ├── WorkspaceContext.tsx   # activeAnchor state, shared context
│   ├── CanvasPanel.tsx        # Tldraw wrapper + anchor link logic
│   ├── PrdEditor.tsx          # Tiptap editor + toolbar
│   ├── JiraPanel.tsx          # Epic sync + ticket CRUD
│   └── AiChatBar.tsx          # Chat input + history + action apply
```

---

## Backend Files

```
backend/
├── api/routes/solutions.py       # Thêm PATCH /canvas, /prd, /chat
├── api/routes/jira_webhook.py    # Thêm GET epic tickets, POST/PATCH ticket
├── services/ai_service.py        # Thêm chat_with_workspace_context()
├── alembic/versions/XXXX_solution_workspace.py  # Migration 4 cột mới
```

---

## Dependencies Mới

```json
// frontend/package.json
"@tldraw/tldraw": "^2.x",
"@tiptap/react": "^2.x",
"@tiptap/starter-kit": "^2.x",
"react-resizable-panels": "^2.x"
```

---

## Out of Scope

- Real-time collaboration (multiple users edit cùng lúc)
- Canvas template library
- Export PRD sang PDF/Google Docs
- Chat history persist cross-session
