# Feedback Table Bug Fix — Design Doc

**Date:** 2026-05-18  
**Goal:** Fix column overflow, clipping, and layout inconsistency bugs trên `/feedback` page.

---

## Problem Summary

Bảng feedback (`table-fixed`) có 4 nhóm bug khiến các giá trị cột bị chồng lên nhau hoặc không hiển thị đầy đủ:

1. **TypeCell & TeamCell dùng `position: absolute` dropdown** — bị clip bởi `overflow-hidden` của table container. SprintCell và StatusCell đã migrate sang Radix Popover, nhưng TypeCell và TeamCell chưa.

2. **Team & Type `<td>` thiếu fixed width** — chỉ có `whitespace-nowrap`, không có `w-*`, khiến cột co giãn tự do và đè vào cột Tiêu đề.

3. **Header `<th>` width không khớp `<td>` width** — `<th>` khai báo `w-16` (Team) và `w-20` (Type) nhưng `<td>` không enforce → layout lệch trên `table-fixed`.

4. **TitleCell thiếu `truncate`** — title dài tràn ra khỏi cột thay vì bị cắt gọn.

---

## Solution

### Fix 1: Migrate TypeCell → Radix Popover

Xóa `useRef`, `useEffect` click-outside, `position: absolute` div. Thay bằng `<Popover>` + `<PopoverContent>` (pattern giống StatusCell hiện tại). `<td>` Type: thêm `w-20 overflow-hidden`.

### Fix 2: Migrate TeamCell → Radix Popover

Tương tự TypeCell. `<td>` Team: thêm `w-16 overflow-hidden`.

### Fix 3: Đồng bộ header/body width

Đảm bảo mỗi cột có cùng `w-*` ở cả `<th>` và `<td>`:

| Cột | `<th>` | `<td>` |
|-----|--------|--------|
| Team | `w-16` | `w-16 overflow-hidden` |
| Loại | `w-20` | `w-20 overflow-hidden` |
| Trạng thái | `w-28` | `w-36 overflow-hidden` → đổi thành `w-28` |
| Rating ×3 | `w-12` | `w-12` ✓ |
| Score | `w-14` | `w-14` ✓ |
| Deadline | `w-24` | `w-24` ✓ |
| Sprint | `w-20` | `w-20 overflow-hidden` ✓ |
| Notified | `w-10` | `w-10` ✓ |
| Action | `w-10` | `w-10` ✓ |

### Fix 4: TitleCell truncate

`TitleCell` wrapper div thêm `truncate`. `<td>` Title: giữ `max-w-0 w-full` (chuẩn cho table-fixed flex column).

---

## Files Changed

- `frontend/src/app/feedback/page.tsx` — TypeCell, TeamCell, FeedbackRow `<td>` widths, TitleCell

---

## Out of Scope

- Design system toàn sản phẩm (plan riêng)
- Thêm cột mới hoặc thay đổi logic nghiệp vụ
- Dark mode fixes
