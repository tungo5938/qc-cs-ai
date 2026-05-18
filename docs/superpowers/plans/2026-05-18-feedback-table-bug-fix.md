# Feedback Table Bug Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix column overflow, clipping, và layout inconsistency bugs trên `/feedback` page khiến các giá trị cột bị chồng lên nhau hoặc không hiển thị đầy đủ.

**Architecture:** Tất cả thay đổi trong một file duy nhất `frontend/src/app/feedback/page.tsx`. TypeCell và TeamCell được migrate từ `position: absolute` dropdown sang Radix Popover (giống StatusCell và SprintCell đã làm). `<td>` widths được đồng bộ với `<th>` widths. TitleCell đã có `truncate` nhưng wrapper `<td>` cần giữ đúng `max-w-0 w-full`.

**Tech Stack:** Next.js 15, React, Radix UI Popover (đã cài qua shadcn/ui), TailwindCSS

---

## File Map

**Modify:**
- `frontend/src/app/feedback/page.tsx` — TypeCell (lines ~1029–1087), TeamCell (lines ~1212–1266), FeedbackRow `<td>` widths (lines ~1370–1435), header `<th>` widths (lines ~1747–1777)

---

## Task 1: Migrate TypeCell sang Radix Popover

**Files:**
- Modify: `frontend/src/app/feedback/page.tsx` — TypeCell function (~line 1029)

Vấn đề: TypeCell dùng `useRef` + `useEffect` click-outside + `position: absolute z-20` div — bị clip bởi `overflow-hidden` của table container.

- [ ] **Step 1: Thay toàn bộ TypeCell function**

Tìm đoạn từ `function TypeCell(` đến closing `}` (~line 1029–1087) và thay bằng:

```tsx
function TypeCell({ fb, onSaved }: { fb: Feedback; onSaved: (patch: Partial<Feedback>) => void }) {
  const [open, setOpen] = useState(false);

  async function select(value: string) {
    setOpen(false);
    if (value === (fb.feedback_type ?? "")) return;
    const updated = await api.feedbacks.update(fb.id, { feedback_type: value });
    onSaved({ feedback_type: (updated as Feedback).feedback_type });
  }

  const typeOption = TYPE_OPTIONS.find((o) => o.value === fb.feedback_type);
  const typeColor = fb.feedback_type
    ? (FEEDBACK_TYPE_COLORS[fb.feedback_type] ?? "bg-gray-100 text-gray-500")
    : "";

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-1 text-xs px-1.5 py-0.5 rounded font-medium transition cursor-pointer hover:ring-1 hover:ring-gray-400 whitespace-nowrap ${
              typeOption ? typeColor : "text-gray-300 hover:text-gray-500"
            }`}
            title="Click để thay đổi loại"
          >
            {typeOption ? (
              <>
                <typeOption.Icon className="w-3 h-3 shrink-0" />
                <span>{typeOption.label}</span>
              </>
            ) : (
              <span>—</span>
            )}
            <ChevronDown className="w-2.5 h-2.5 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-36 p-1" align="start" sideOffset={4}>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition cursor-pointer ${
                fb.feedback_type === opt.value
                  ? "bg-gray-100 text-gray-900 font-semibold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <opt.Icon className="w-3 h-3 shrink-0" />
              <span className="flex-1 text-left">{opt.label}</span>
              {fb.feedback_type === opt.value && (
                <CheckIcon className="w-3 h-3 text-gray-500 shrink-0" />
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeCell không còn dùng `useRef`/`useEffect` click-outside**

```bash
grep -n "ref.current\|removeEventListener\|addEventListener" /Users/ngominhtu/code/qc-cs-ai/frontend/src/app/feedback/page.tsx | grep -A2 -B2 "TypeCell"
```

Expected: không có kết quả nào liên quan TypeCell.

- [ ] **Step 3: Commit**

```bash
cd /Users/ngominhtu/code/qc-cs-ai && git add frontend/src/app/feedback/page.tsx
git commit -m "fix: migrate TypeCell to Radix Popover — fix dropdown clipping"
```

---

## Task 2: Migrate TeamCell sang Radix Popover

**Files:**
- Modify: `frontend/src/app/feedback/page.tsx` — TeamCell function (~line 1212)

Vấn đề: Tương tự TypeCell — `position: absolute` bị clip.

- [ ] **Step 1: Thay toàn bộ TeamCell function**

Tìm đoạn từ `function TeamCell(` đến closing `}` (~line 1212–1266) và thay bằng:

```tsx
function TeamCell({ fb, onSaved }: { fb: Feedback; onSaved: (patch: Partial<Feedback>) => void }) {
  const [open, setOpen] = useState(false);

  async function select(value: string | null) {
    setOpen(false);
    if (value === (fb.team ?? null)) return;
    const updated = await api.feedbacks.update(fb.id, { team: value });
    onSaved({ team: (updated as Feedback).team });
  }

  const color = fb.team ? (TEAM_COLORS[fb.team] ?? "bg-gray-100 text-gray-600") : "";

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            className={`flex items-center gap-0.5 text-xs px-1.5 py-0.5 rounded font-medium transition cursor-pointer hover:ring-1 hover:ring-gray-400 whitespace-nowrap ${
              fb.team ? color : "text-gray-300 hover:text-gray-500"
            }`}
            title="Click để chọn team"
          >
            <span>{fb.team ?? "—"}</span>
            <ChevronDown className="w-2.5 h-2.5 opacity-50 shrink-0" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-28 p-1" align="start" sideOffset={4}>
          <button
            onClick={() => select(null)}
            className="w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded text-gray-400 hover:bg-gray-50 cursor-pointer"
          >
            <span className="flex-1 text-left">Bỏ chọn</span>
            {!fb.team && <CheckIcon className="w-3 h-3 text-gray-400 shrink-0" />}
          </button>
          {TEAM_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => select(opt.value)}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs rounded transition cursor-pointer ${
                fb.team === opt.value
                  ? "bg-gray-100 text-gray-900 font-semibold"
                  : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              }`}
            >
              <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TEAM_COLORS[opt.value]}`}>
                {opt.label}
              </span>
              {fb.team === opt.value && (
                <CheckIcon className="w-3 h-3 text-gray-500 shrink-0 ml-auto" />
              )}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  );
}
```

- [ ] **Step 2: Verify không còn `absolute z-20` trong TeamCell**

```bash
grep -n "absolute z-20" /Users/ngominhtu/code/qc-cs-ai/frontend/src/app/feedback/page.tsx
```

Expected: không có kết quả nào.

- [ ] **Step 3: Commit**

```bash
cd /Users/ngominhtu/code/qc-cs-ai && git add frontend/src/app/feedback/page.tsx
git commit -m "fix: migrate TeamCell to Radix Popover — fix dropdown clipping"
```

---

## Task 3: Đồng bộ `<th>` và `<td>` widths + fix Team/Type td

**Files:**
- Modify: `frontend/src/app/feedback/page.tsx` — FeedbackRow `<td>`s (~line 1370–1435), thead `<th>`s (~line 1748–1777)

Vấn đề: Team `<td>` dùng `whitespace-nowrap` không có `w-*`; Type `<td>` tương tự. Status `<td>` dùng `w-36` nhưng `<th>` khai báo `w-28`. Cần đồng bộ.

- [ ] **Step 1: Fix các `<td>` trong FeedbackRow**

Tìm và thay từng `<td>` trong `FeedbackRow` (chú ý chỉ thay đúng className, không thay nội dung):

**Team `<td>`** — tìm:
```tsx
      <td className="py-2 px-2 whitespace-nowrap">
        <TeamCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>
```
Thay thành:
```tsx
      <td className="py-2 px-2 w-16 overflow-hidden">
        <TeamCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>
```

**Type `<td>`** — tìm:
```tsx
      <td className="py-2 px-2 whitespace-nowrap">
        <TypeCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>
```
Thay thành:
```tsx
      <td className="py-2 px-2 w-20 overflow-hidden">
        <TypeCell fb={fb} onSaved={p => onRated(fb.id, p)} />
      </td>
```

**Status `<td>`** — tìm:
```tsx
      <td className="py-2 px-2 w-36 overflow-hidden">
```
Thay thành:
```tsx
      <td className="py-2 px-2 w-28 overflow-hidden">
```

- [ ] **Step 2: Verify widths khớp giữa thead và tbody**

```bash
grep -n "w-16\|w-20\|w-28\|w-24\|w-14\|w-12\|w-10" /Users/ngominhtu/code/qc-cs-ai/frontend/src/app/feedback/page.tsx | grep -E "(<th|<td)" | head -30
```

Expected: Team có `w-16` ở cả `<th>` và `<td>`, Type có `w-20`, Status có `w-28`.

- [ ] **Step 3: Commit**

```bash
cd /Users/ngominhtu/code/qc-cs-ai && git add frontend/src/app/feedback/page.tsx
git commit -m "fix: sync th/td widths — Team w-16, Type w-20, Status w-28"
```

---

## Task 4: Build check + smoke test thủ công

**Files:** Không thay đổi file mới

- [ ] **Step 1: Chạy TypeScript build check**

```bash
cd /Users/ngominhtu/code/qc-cs-ai/frontend && npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` hoặc không có TypeScript error. Nếu có lỗi → fix theo thông báo.

- [ ] **Step 2: Chạy backend tests**

```bash
cd /Users/ngominhtu/code/qc-cs-ai/backend && python3 -m pytest tests/ -q 2>&1 | tail -10
```

Expected: tất cả pass, không có failure.

- [ ] **Step 3: Smoke test thủ công trên browser**

Đảm bảo frontend đang chạy (`npm run dev`), mở `http://localhost:3000/feedback`:

1. Click dropdown **Loại** trên bất kỳ row nào → dropdown mở xuống dạng dọc, không bị clip
2. Click dropdown **Team** → tương tự, dropdown dọc, không bị clip
3. Click dropdown **Trạng thái** → vẫn hoạt động đúng (không bị regression)
4. Click dropdown **Sprint** → vẫn hoạt động đúng
5. Kiểm tra cột Team và Loại không còn tràn sang cột Tiêu đề
6. Tiêu đề dài bị truncate gọn trong cột, không tràn sang cột khác

- [ ] **Step 4: Final commit nếu có thay đổi nhỏ từ smoke test**

```bash
cd /Users/ngominhtu/code/qc-cs-ai && git add frontend/src/app/feedback/page.tsx
git commit -m "fix: feedback table — all dropdown cells use Radix Popover, widths synced"
```
