# Auto-Research Feedback Data từ Google Sheet — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `agentic-engineering` + `qc-ecc-workflow` to implement task-by-task. Steps dùng checkbox (`- [ ]`) để tracking.

**Goal:** Thêm endpoint `POST /feedbacks/import-sheet` cho phép PM paste URL Google Sheet → hệ thống tự fetch, parse, và import feedback vào DB — thay thế quy trình export CSV thủ công như hiện tại.

**Context:** `gsheet_service.fetch_sheet_rows()` đã có sẵn nhưng dùng schema cũ (9 cột đơn giản). B2C bug sheet (vừa import thủ công 30 items) có schema phức tạp hơn với 18 cột bao gồm ratings, deadline, media. Cần thêm parser mới cho schema này và một parser chung để hệ thống có thể xử lý cả hai.

**Architecture:**
- Backend: 1 endpoint mới trong `feedbacks.py`, 1 hàm parse mới trong `gsheet_service.py`
- Frontend: Thêm nút "Import từ Sheet" trên `/feedback` page → modal nhập URL + product + team
- Không cần migration DB — dùng đúng các field hiện có của `Feedback`

**Tech Stack:** FastAPI, httpx (đã có), Next.js 15, shadcn/ui Dialog

---

## Research: Cấu trúc dữ liệu đã confirmed

Schema B2C bug sheet (18 cột):
```
Ngày tạo | Loại yêu cầu | Mô tả - text | Mô tả - image | Status |
Nguyên nhân (Tú phân tích) | Hướng giải quyết (Tú đề xuất) | PIC | Deadline |
Tổng điểm ưu tiên | Tú đánh giá | Trọng số | User đánh giá | Trọng số |
User note | Dev đánh giá | Trọng số | Jira issue
```

Mapping → `Feedback` model (đã verified qua import thủ công):
| CSV | Field | Ghi chú |
|---|---|---|
| Ngày tạo | `created_at` | DD/MM/YYYY |
| Loại yêu cầu | `feedback_type` | bug/feature |
| Mô tả - text | `raw_content` | required |
| Mô tả - image | `media_urls` | list strings |
| Status | `status` | Following→evaluating, Done→done, else→draft |
| Nguyên nhân | `tu_danh_gia_note` + `FeedbackAnalysis.root_cause` | |
| Hướng giải quyết | `FeedbackAnalysis.solution_hint` | |
| PIC | `submitted_by` | |
| Deadline | `deadline` | parse DD/MM |
| Tổng điểm | `priority_score` | float |
| Tú đánh giá | `tu_danh_gia` | int |
| User đánh giá | `user_priority` | int |
| User note | `user_priority_note` | |
| Dev đánh giá | `tech_rating` | int |

---

## File Map

**Modify:**
- `backend/services/gsheet_service.py` — thêm `fetch_b2c_bug_rows()`
- `backend/api/routes/feedbacks.py` — thêm `POST /feedbacks/import-sheet`
- `frontend/src/app/feedback/page.tsx` — thêm nút + modal import sheet
- `frontend/src/lib/api.ts` — thêm `feedbacks.importSheet()`

---

## Task 1: Backend — Thêm parser B2C bug sheet vào gsheet_service

**Files:**
- Modify: `backend/services/gsheet_service.py`

Logic: Tái sử dụng helpers parse từ `scripts/import_b2c_bugs.py` (đã validated), wrap lại trong `fetch_b2c_bug_rows()`.

- [ ] **Step 1: Thêm hàm `fetch_b2c_bug_rows()` vào cuối gsheet_service.py**

```python
async def fetch_b2c_bug_rows(sheet_url: str) -> list[dict]:
    """
    Fetch B2C bug tracking sheet (18-column format) and return parsed rows.
    Each row dict maps directly to Feedback model fields.
    Skips rows with empty Mô tả - text.
    """
    import re as _re
    from datetime import date, datetime

    csv_url = _to_csv_export_url(sheet_url)
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(csv_url)
        resp.raise_for_status()

    reader = csv.reader(io.StringIO(resp.text))
    rows = list(reader)
    if not rows:
        return []

    header = [h.strip() for h in rows[0]]

    def _col(row, *names):
        for name in names:
            for i, h in enumerate(header):
                if name.lower() in h.lower() and i < len(row):
                    return row[i].strip()
        return ""

    def _int(val):
        try:
            return int(float(val.replace(",", ".").strip())) if val.strip() else None
        except (ValueError, TypeError):
            return None

    def _float(val):
        try:
            return float(val.replace(",", ".").strip()) if val.strip() else None
        except (ValueError, TypeError):
            return None

    def _date(val):
        val = val.strip()
        if not val or val.lower() in ("tuần sau", "dự kiến 2 tuần có bản test"):
            return None
        m = _re.match(r"^(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$", val)
        if m:
            try:
                return date(int(m.group(3) or 2026), int(m.group(2)), int(m.group(1))).isoformat()
            except ValueError:
                return None
        return None

    def _media(val):
        val = val.strip()
        if not val:
            return None
        parts = [p.strip() for p in _re.split(r"[\n,]+", val) if p.strip()]
        return parts or None

    def _status(val):
        return {"following": "evaluating", "done": "done"}.get(val.strip().lower(), "draft")

    def _type(val):
        return {"bug": "bug", "feature": "feature", "feature request": "feature"}.get(
            val.strip().lower(), "unclear"
        )

    result = []
    for row in rows[1:]:
        raw_content = _col(row, "Mô tả - text")
        if not raw_content:
            continue
        result.append({
            "raw_content": raw_content,
            "media_urls": _media(_col(row, "Mô tả - image")),
            "feedback_type": _type(_col(row, "Loại yêu cầu")),
            "status": _status(_col(row, "Status")),
            "submitted_by": _col(row, "PIC") or None,
            "deadline": _date(_col(row, "Deadline")),
            "priority_score": _float(_col(row, "Tổng điểm")),
            "tu_danh_gia": _int(_col(row, "Tú đánh giá")),
            "tu_danh_gia_note": _col(row, "Nguyên nhân") or None,
            "user_priority": _int(_col(row, "User đánh giá")),
            "user_priority_note": _col(row, "User note") or None,
            "tech_rating": _int(_col(row, "Dev đánh giá")),
            "root_cause": _col(row, "Nguyên nhân") or None,
            "solution_hint": _col(row, "Hướng giải quyết") or None,
            "created_at_raw": _col(row, "Ngày tạo"),
        })
    return result
```

- [ ] **Step 2: Verify import**

```bash
cd /Users/ngominhtu/code/qc-cs-ai/backend && python3 -c "
import asyncio, sys
sys.path.insert(0, '.')
from services.gsheet_service import fetch_b2c_bug_rows
# Test với URL public
# asyncio.run(fetch_b2c_bug_rows('https://docs.google.com/...'))
print('fetch_b2c_bug_rows imported OK')
"
```

---

## Task 2: Backend — Endpoint `POST /feedbacks/import-sheet`

**Files:**
- Modify: `backend/api/routes/feedbacks.py`

- [ ] **Step 1: Thêm Pydantic body model**

Thêm vào phần đầu feedbacks.py (sau các import hiện có):

```python
class ImportSheetBody(BaseModel):
    sheet_url: str
    product_id: str
    team: Optional[str] = None  # e.g. "B2C", "TEL"
    sheet_type: str = "b2c_bug"  # "b2c_bug" | "generic"
```

- [ ] **Step 2: Thêm endpoint**

Thêm endpoint mới vào feedbacks.py:

```python
@router.post("/import-sheet")
async def import_from_sheet(body: ImportSheetBody, db: AsyncSession = Depends(get_db)):
    from services.gsheet_service import fetch_b2c_bug_rows
    from datetime import datetime

    if body.sheet_type != "b2c_bug":
        raise HTTPException(400, "Chỉ hỗ trợ sheet_type='b2c_bug' hiện tại")

    rows = await fetch_b2c_bug_rows(body.sheet_url)
    if not rows:
        return {"inserted": 0, "skipped": 0, "message": "Sheet trống hoặc không có dữ liệu"}

    inserted = 0
    skipped = 0

    for row in rows:
        fb = Feedback(
            id=gen_uuid(),
            product_id=body.product_id,
            raw_content=row["raw_content"],
            media_urls=row.get("media_urls"),
            submitted_by=row.get("submitted_by"),
            source="manual",
            team=body.team,
            feedback_type=row.get("feedback_type", "unclear"),
            status=row.get("status", "draft"),
            deadline=row.get("deadline"),
            priority_score=row.get("priority_score"),
            tu_danh_gia=row.get("tu_danh_gia"),
            tu_danh_gia_note=row.get("tu_danh_gia_note"),
            user_priority=row.get("user_priority"),
            user_priority_note=row.get("user_priority_note"),
            tech_rating=row.get("tech_rating"),
        )

        raw_dt = row.get("created_at_raw", "")
        for fmt in ("%d/%m/%Y", "%d/%m/%y"):
            try:
                fb.created_at = datetime.strptime(raw_dt, fmt)
                break
            except ValueError:
                pass

        db.add(fb)

        root_cause = row.get("root_cause")
        solution_hint = row.get("solution_hint")
        if root_cause or solution_hint:
            db.add(FeedbackAnalysis(
                id=gen_uuid(),
                feedback_id=fb.id,
                root_cause=root_cause,
                solution_hint=solution_hint,
            ))

        inserted += 1

    await db.commit()
    return {"inserted": inserted, "skipped": skipped}
```

- [ ] **Step 3: Test endpoint**

```bash
cd /Users/ngominhtu/code/qc-cs-ai/backend && python3 -m uvicorn main:app --port 8001 --reload &
sleep 3
curl -s -X POST http://localhost:8001/api/feedbacks/import-sheet \
  -H "Content-Type: application/json" \
  -d '{"sheet_url":"PASTE_URL","product_id":"a47913fb-3cda-473d-912a-a388682556e7","team":"B2C"}' | python3 -m json.tool
kill %1
```

Expected: `{"inserted": N, "skipped": 0}`

---

## Task 3: Frontend — Nút + Modal "Import từ Sheet"

**Files:**
- Modify: `frontend/src/lib/api.ts` — thêm `feedbacks.importSheet()`
- Modify: `frontend/src/app/feedback/page.tsx` — thêm nút + Dialog

- [ ] **Step 1: Thêm API method vào api.ts**

Trong object `feedbacks` của `api.ts`, thêm:

```ts
importSheet: (body: { sheet_url: string; product_id: string; team?: string }) =>
  fetchAPI<{ inserted: number; skipped: number }>("/feedbacks/import-sheet", {
    method: "POST",
    body: JSON.stringify(body),
  }),
```

- [ ] **Step 2: Thêm ImportSheetModal component vào feedback/page.tsx**

Thêm Dialog với 3 fields: Sheet URL, Product (dropdown từ danh sách products), Team (B2C/TEL/C2C).

Khi submit: gọi `api.feedbacks.importSheet()` → toast kết quả → reload danh sách.

Nút trigger: thêm vào toolbar hiện có (cạnh nút "Tạo feedback"):

```tsx
<button
  onClick={() => setImportSheetOpen(true)}
  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-zinc-800 text-zinc-300 hover:bg-zinc-700 border border-zinc-700 transition"
>
  <TableIcon className="w-3.5 h-3.5" />
  Import Sheet
</button>
```

- [ ] **Step 3: Build check**

```bash
cd /Users/ngominhtu/code/qc-cs-ai/frontend && npm run build 2>&1 | tail -10
```

Expected: `✓ Compiled successfully`

---

## Task 4: Verification

- [ ] **Backend tests**

```bash
cd /Users/ngominhtu/code/qc-cs-ai/backend && python3 -m pytest tests/ -q 2>&1 | tail -5
```

Expected: all pass.

- [ ] **Smoke test thủ công**

1. Mở `http://localhost:3000/feedback`
2. Click "Import Sheet" → modal mở
3. Paste URL Google Sheet (public) → chọn product → Submit
4. Verify toast hiện số lượng inserted
5. Danh sách feedback reload và hiện items mới

- [ ] **Commit cuối**

```bash
cd /Users/ngominhtu/code/qc-cs-ai && git add backend/ frontend/
git commit -m "feat: import feedback from Google Sheet URL via /feedbacks/import-sheet endpoint + UI modal"
```
