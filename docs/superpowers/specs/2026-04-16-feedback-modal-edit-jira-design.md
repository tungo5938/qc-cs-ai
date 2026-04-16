# Feedback Modal Edit + Jira Creation — Design Spec

**Date:** 2026-04-16
**Status:** Approved

---

## Overview

Mở rộng `FeedbackDetailModal` trong `feedback/page.tsx` để:
1. Cho phép inline-edit tiêu đề, nội dung gốc, kết quả phân tích AI
2. Thêm section "Hướng giải quyết" (user edit hoặc AI tạo)
3. Nút "Tạo Jira ticket" → mở Jira Preview Panel, AC được AI tạo tự động khi mở panel, user confirm rồi submit

---

## Layout Modal

```
┌──────────────────────────────────────┬──────────────────────────────────────────────┐
│  LEFT PANEL (scroll)                 │  RIGHT PANEL                                 │
│                                      │                                              │
│  NỘI DUNG GỐC                        │  ┌── JIRA PREVIEW (khi click "Tạo Jira") ──┐ │
│  ┌──────────────────────────────┐    │  │ Title: [✏️ editable...................]  │ │
│  │ Lorem ipsum... (click edit)  │    │  │                                          │ │
│  └──────────────────────────────┘    │  │ Description:                             │ │
│                                      │  │  ## Nội dung gốc                        │ │
│  ĐÁNH GIÁ ƯU TIÊN                    │  │  Lorem ipsum...                          │ │
│  [👤 7/10] [📊 6/10] [⚙️ 8/10] ★8.5 │  │                                          │ │
│                                      │  │  ## Kết quả phân tích                   │ │
│  KẾT QUẢ PHÂN TÍCH AI                │  │  Root cause...                          │ │
│  Nguyên nhân: ... (click edit)       │  │                                          │ │
│  [high] [checkout flow]              │  │  ## Hướng giải quyết                    │ │
│                                      │  │  Solution hint...                        │ │
│  HƯỚNG GIẢI QUYẾT          [✨ AI]   │  │                                          │ │
│  ┌──────────────────────────────┐    │  │  ## Acceptance Criteria                  │ │
│  │ (chưa có — click để nhập,   │    │  │  ← auto-generated khi mở panel này      │ │
│  │  hoặc bấm ✨ AI để tạo)     │    │  │                                          │ │
│  └──────────────────────────────┘    │  │ Assignee: tunm1@ghn.vn                  │ │
│                                      │  │ Epic: GB-488                             │ │
│  [🎫 Tạo Jira ticket]               │  │ Sprint: [GB sprint ____]                 │ │
│  [Mở trang riêng →]                  │  │                                          │ │
│                                      │  │   [Huỷ]  [🚀 Tạo Jira ticket]          │ │
│                                      │  └──────────────────────────────────────────┘ │
└──────────────────────────────────────┴──────────────────────────────────────────────┘
```

- Không có ảnh → Jira preview chiếm toàn bộ RIGHT panel
- Có ảnh → Jira preview **đè lên** panel ảnh (toggle, nút "← Xem ảnh" để quay lại)
- Sau tạo Jira thành công → hiển thị link `[GB-123 ↗]` thay button

---

## Backend Changes

### 1. DB Migration — bảng `feedback_analyses`

Thêm 2 cột:
- `solution_hint TEXT` — gợi ý hướng giải quyết (AI hoặc user nhập)
- `acceptance_criteria TEXT` — AC tự động từ AI khi tạo Jira draft

### 2. API mới/sửa

#### `PATCH /api/feedbacks/{id}`
Mở rộng `FeedbackUpdate` schema thêm:
```python
class FeedbackUpdate(BaseModel):
    status: Optional[str] = None
    title: Optional[str] = None
    raw_content: Optional[str] = None
```

#### `PATCH /api/feedbacks/{id}/analysis`
Endpoint mới — edit các trường trong `FeedbackAnalysis`:
```python
class AnalysisUpdate(BaseModel):
    root_cause: Optional[str] = None
    solution_hint: Optional[str] = None
```
Trả về `FeedbackOut` đầy đủ.

#### `POST /api/feedbacks/{id}/generate-solution`
Gọi AI để tạo `solution_hint`. Lưu vào `FeedbackAnalysis.solution_hint`. Trả về `FeedbackOut`.

AI prompt nhận: `raw_content`, `root_cause`, `impact_level`, `affected_area`, `product_name`, `product_goal`.

#### `POST /api/feedbacks/{id}/create-jira`

Request body:
```python
class CreateJiraBody(BaseModel):
    title: str                        # editable trong preview
    raw_content: str                  # nội dung gốc (có thể đã edit)
    root_cause: Optional[str] = None
    solution_hint: Optional[str] = None
    acceptance_criteria: str          # AI tạo trước khi mở panel, gửi lên
    sprint_name: Optional[str] = None # e.g. "GB sprint 5"
    upload_attachments: bool = True   # upload media_urls lên Jira
```

Flow backend:
1. Lookup assignee accountId qua `/rest/api/3/user/search?query=tunm1@ghn.vn`
2. Lookup sprint ID qua `/rest/agile/1.0/board/{board_id}/sprint` nếu `sprint_name` có
3. Tạo ticket với `jira_service.create_ticket_full(...)` — description dùng ADF multi-section
4. Nếu `upload_attachments=True` và feedback có `media_urls`: fetch từng URL → upload lên `/rest/api/3/issue/{key}/attachments`
5. Trả về `{ key, url }`

#### `POST /api/feedbacks/{id}/generate-ac`
Gọi AI tạo `acceptance_criteria` từ `solution_hint`. Không lưu DB (chỉ trả về string để frontend dùng trong preview). Trả về `{ acceptance_criteria: str }`.

### 3. Jira Service — `jira_service.create_ticket_full()`

Mở rộng `create_ticket()` thành `create_ticket_full()` nhận:
```python
async def create_ticket_full(
    project_key: str,
    title: str,
    raw_content: str,
    root_cause: Optional[str],
    solution_hint: Optional[str],
    acceptance_criteria: Optional[str],
    assignee_account_id: Optional[str],
    epic_key: str = "GB-488",
    sprint_id: Optional[int] = None,
    issue_type: str = "Story",
) -> dict:
```

Description ADF format (4 sections):
```
## Nội dung gốc
{raw_content}

## Kết quả phân tích
Root cause: {root_cause}

## Hướng giải quyết
{solution_hint}

## Acceptance Criteria
{acceptance_criteria}
```

Epic link field: `customfield_10014` (Jira Next-gen / team-managed).
Sprint field: `customfield_10020`.

Helper functions cần thêm vào `jira_service.py`:
- `async def lookup_user_account_id(email: str) -> Optional[str]`
- `async def lookup_sprint_id(board_id: int, sprint_name: str) -> Optional[int]`
- `async def upload_attachment(ticket_key: str, image_url: str) -> bool`

Board ID cho project GB: `18` (từ URL `boards/18`).

---

## Frontend Changes

**File:** `frontend/src/app/feedback/page.tsx` — chỉnh sửa `FeedbackDetailModal`

### Inline edit components

`InlineTextEdit` — reusable component:
- Props: `label`, `value`, `onSave(v: string): Promise<void>`, `multiline?: boolean`
- Click text → textarea hiện ra, nút ✓ Save / ✗ Cancel
- Saving state khi đang gọi API

Dùng cho: `fb.title`, `fb.raw_content`, `fb.analysis.root_cause`

### Section "Hướng giải quyết"

```tsx
// Sau block analysis, trước button Tạo Jira
<div>
  <div className="flex items-center justify-between mb-1.5">
    <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">Hướng giải quyết</p>
    <button onClick={handleGenerateSolution} disabled={generatingSolution}>
      {generatingSolution ? "Đang tạo..." : "✨ AI"}
    </button>
  </div>
  <InlineTextEdit
    label=""
    value={fb.analysis?.solution_hint ?? ""}
    onSave={saveSolutionHint}
    multiline
  />
</div>
```

`handleGenerateSolution` → gọi `POST /generate-solution` → update `fb.analysis.solution_hint`

`saveSolutionHint` → gọi `PATCH /analysis` với `{ solution_hint: value }`

### Button "Tạo Jira ticket"

```tsx
<button onClick={handleOpenJiraPanel} className="...">
  🎫 Tạo Jira ticket
</button>
```

`handleOpenJiraPanel`:
1. Nếu `solution_hint` trống → gọi `generate-solution` trước
2. Gọi `POST /generate-ac` với solution_hint → lấy `acceptance_criteria`
3. Set `showJiraPanel = true` với draft pre-filled

### Jira Preview Panel

State:
```tsx
type JiraDraft = {
  title: string;
  acceptance_criteria: string;
  sprint_name: string;
};
const [jiraDraft, setJiraDraft] = useState<JiraDraft | null>(null);
const [showJiraPanel, setShowJiraPanel] = useState(false);
const [creatingJira, setCreatingJira] = useState(false);
const [jiraResult, setJiraResult] = useState<{ key: string; url: string } | null>(null);
```

Panel hiển thị (trong RIGHT column, đè lên ảnh nếu có):
- Editable title input
- Read-only description preview (4 sections)
- Editable sprint_name input
- Fixed: assignee = `tunm1@ghn.vn`, epic = `GB-488`
- Button "🚀 Tạo Jira ticket" → gọi `POST /create-jira`
- Sau thành công: hiển thị `[GB-123 ↗]`

### API client additions (`frontend/src/lib/api.ts`)

```ts
feedbacks: {
  // existing...
  update: (id: string, body: { title?: string; raw_content?: string }) => ...,
  updateAnalysis: (id: string, body: { root_cause?: string; solution_hint?: string }) => ...,
  generateSolution: (id: string) => ...,
  generateAC: (id: string, solution_hint: string) => ...,
  createJira: (id: string, body: CreateJiraBody) => ...,
}
```

### Types additions (`frontend/src/lib/types.ts`)

```ts
// Extend FeedbackAnalysis
export interface FeedbackAnalysis {
  root_cause: string;
  impact_level: ImpactLevel;
  affected_area: string;
  kb_references: string[];
  solution_hint?: string | null;   // NEW
}
```

---

## Data Flow — "Tạo Jira ticket" button

```
User click "Tạo Jira ticket"
  → if no solution_hint: POST /generate-solution → save to fb.analysis.solution_hint
  → POST /generate-ac (solution_hint) → acceptance_criteria (frontend only, not saved)
  → showJiraPanel = true, pre-fill draft
User reviews/edits draft
  → click "🚀 Tạo Jira ticket"
  → POST /create-jira (title, raw_content, root_cause, solution_hint, acceptance_criteria, sprint_name)
    → backend: lookup assignee accountId
    → backend: lookup sprint ID (if sprint_name)
    → backend: create_ticket_full() → Jira API
    → backend: upload attachments (media_urls) if any
    → return { key, url }
  → frontend: show success link [GB-123 ↗]
```

---

## Tech Notes

- Jira `customfield_10014` = Epic Link (Next-gen). Epic key = `GB-488`.
- Jira `customfield_10020` = Sprint (array of sprint IDs).
- Board ID = `18` (from `boards/18` in URL).
- Assignee lookup: `GET /rest/api/3/user/search?query={email}` → lấy `accountId` của kết quả đầu tiên.
- Attachment upload: `POST /rest/api/3/issue/{key}/attachments` với `multipart/form-data`, header `X-Atlassian-Token: no-check`.
- AI model: OpenAI `gpt-4o` (same as existing `ai_service.py`).
