# Roadmap Feature Design

## Goal

Add a Roadmap module to the QC CS AI portal that lets PM plan and track product work across phases, sprints, and tasks — per product (CS AI, CS Chat, Voice AI). Supports both list view and timeline/Gantt view.

## Architecture

**Approach:** Lightweight reuse of existing `ActionItem` model. Add two new small tables (`roadmap_phases`, `roadmap_sprints`) and two nullable FK columns to `action_items`. No duplicate data.

### New Tables

```
roadmap_phases
  id            UUID PK
  product_id    FK → products.id (CASCADE DELETE)
  name          String(200)
  description   Text nullable
  order_index   Integer default 0
  created_at    DateTime

roadmap_sprints
  id                UUID PK
  phase_id          FK → roadmap_phases.id (CASCADE DELETE)
  sprint_config_id  FK → sprint_configs.id (SET NULL) nullable
  name              String(200)
  sprint_number     Integer nullable  -- from sprint_config if linked
  start_date        Date nullable
  end_date          Date nullable
  order_index       Integer default 0
  created_at        DateTime
```

### Modified Table

```
action_items (existing)
  + phase_id   FK → roadmap_phases.id (SET NULL) nullable
  + sprint_id  FK → roadmap_sprints.id (SET NULL) nullable
```

**Rules:**
- ActionItem with `phase_id` + `sprint_id` → appears in Roadmap
- ActionItem without → appears only in `/actions` (unchanged)
- Deleting a phase sets `phase_id = null` on its tasks (tasks preserved, not deleted)
- Sprint links to `sprint_configs` to auto-fill dates; PM can override manually

---

## Navigation

Add "Roadmap" between "Solutions" and "Meetings" in NavBar:

```
Dashboard | Phản hồi | Solutions | Roadmap | Meetings | Actions | Documents | Cài đặt
```

---

## Pages & Components

### `/roadmap`

**Header:**
- Product tabs: [CS AI] [CS Chat] [Voice AI] — same pattern as other pages
- View toggle: [List] [Timeline]

**List View (default):**

```
─── Phase 1: Foundation ──────────────────── [+ Sprint] [Edit] [Delete]  (PM only)
  ▼ Sprint 3 (28/04 – 11/05)                                [+ Task] [Edit] [Delete]
      ☐ Task A   assignee   deadline   status-badge
      ☐ Task B   assignee   deadline   status-badge
  ▼ Sprint 4 (12/05 – 25/05)
      ☐ Task C   ...

─── Phase 2: Growth ──────────────────────── [+ Sprint] [Edit] [Delete]

[+ Add Phase]   (PM only, bottom of list)
```

**Timeline View:**

```
                  May 2026              Jun 2026
Phase             W1  W2  W3  W4  W1  W2  W3  W4
──────────────────────────────────────────────────
Phase 1: Foundation
  Sprint 3        [████████]
  Sprint 4            [████████]
    ↳ 3 done · 2 todo · 1 overdue ⚠
Phase 2: Growth
  Sprint 5                [████████]
```

- Click sprint bar → expand tasks inline
- Current sprint highlighted
- Overdue tasks show red badge
- Horizontal scroll if many weeks

---

## Key Interactions

### Add Phase
- PM clicks `+ Add Phase`
- Modal: name, description (optional)
- Saved with `product_id` from active product tab

### Add Sprint to Phase
- PM clicks `+ Sprint` on a phase
- Modal: pick sprint from Sprint Config dropdown (auto-fills name, number, dates), or enter manually
- If no Sprint Config exists → warning: "Chưa có Sprint Config, vào Cài đặt để cài"

### Add Task to Sprint
- PM clicks `+ Task` on a sprint
- Reuses existing Create Action Item modal
- Auto-sets `phase_id`, `sprint_id`, `product_id` from context
- Task appears both in `/roadmap` and `/actions`

### Edit / Delete
- Phase delete: confirm dialog → tasks get `phase_id = null` (not deleted)
- Sprint delete: confirm dialog → tasks get `sprint_id = null`
- Task edit: same as existing ActionItem edit

---

## Permissions

- **View** (list + timeline): all logged-in users
- **Create/Edit/Delete** phases, sprints, tasks: PM only (`PM_QC_EMAILS`)
- PM buttons hidden for non-PM users (not just disabled)

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/roadmap/phases?product_id=` | List phases with sprints and task counts |
| POST | `/api/roadmap/phases` | Create phase |
| PATCH | `/api/roadmap/phases/{id}` | Update phase (name, description, order) |
| DELETE | `/api/roadmap/phases/{id}` | Delete phase (nullifies task phase_id) |
| POST | `/api/roadmap/sprints` | Create sprint in a phase |
| PATCH | `/api/roadmap/sprints/{id}` | Update sprint |
| DELETE | `/api/roadmap/sprints/{id}` | Delete sprint (nullifies task sprint_id) |
| GET | `/api/roadmap/tasks?phase_id=&sprint_id=` | List tasks (ActionItems) for a sprint |

Tasks are created/updated via existing `/api/action-items` endpoints — no new task endpoints needed.

---

## Backend Files

| File | Change |
|------|--------|
| `backend/models/roadmap_phase.py` | New model |
| `backend/models/roadmap_sprint.py` | New model |
| `backend/models/action_item.py` | Add `phase_id`, `sprint_id` columns |
| `backend/schemas/roadmap.py` | Pydantic schemas |
| `backend/api/routes/roadmap.py` | Route handlers |
| `backend/main.py` | Register router |
| `backend/alembic/versions/0021_roadmap.py` | Migration |

## Frontend Files

| File | Change |
|------|--------|
| `frontend/src/app/roadmap/page.tsx` | New page |
| `frontend/src/components/NavBar.tsx` | Add Roadmap link |
| `frontend/src/lib/types.ts` | Add RoadmapPhase, RoadmapSprint types |
| `frontend/src/lib/api.ts` | Add roadmap API calls |

---

## Testing

- `backend/tests/test_roadmap.py` — API integration tests:
  - Create/list/delete phase
  - Create sprint linked to sprint_config
  - Create task within sprint (ActionItem with phase_id + sprint_id)
  - Delete phase → tasks get phase_id nullified
- `frontend/e2e/roadmap.spec.ts` — Playwright:
  - Page renders with product tabs
  - List view shows phases and sprints
  - API: phase CRUD, sprint CRUD

---

## Out of Scope

- Drag-and-drop reordering (order_index writable via PATCH, UI reorder not in v1)
- Dependencies between tasks
- Story points / velocity tracking
- Export to PDF/CSV
