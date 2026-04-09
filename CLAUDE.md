# CLAUDE.md — QC CS AI

Internal QC/PM feedback tool for GHN CS AI team. Telegram bot + stakeholder web portal.

---

## Running Locally

```bash
# Start backend (FastAPI :8000) + localtunnel + set Telegram webhook
./dev.sh

# Start frontend separately (Next.js :3000)
cd frontend && npm run dev

# Or start backend only
cd backend && python3 -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Logs: `/tmp/qc_backend.log`, `/tmp/qc_frontend.log`, `/tmp/qc_tunnel.log`
API docs: `http://localhost:8000/docs`

### DB migrations
```bash
cd backend && python3 -m alembic upgrade head
```

---

## Auth Flow — CRITICAL for UI Testing

The portal uses **sessionStorage-based email gate**, not cookies or JWTs.

### How it works
1. On any page load, `EmailGate` checks `sessionStorage.getItem("qc_user_email")`
2. If missing/invalid → shows email input form (must be `@ghn.vn` or `@ghn.com.vn`)
3. If valid → renders the page
4. `/admin/*` routes additionally redirect to `/` if email is missing

### Admin access
The "Quản trị" nav link only appears if the email is in `NEXT_PUBLIC_PM_QC_EMAILS`.
Admin email locally: `tunm1@ghn.vn`

### Testing admin pages with browser tools (Playwright)
**Always inject the session before navigating to any protected page:**
```js
// Step 1: go to home first
await page.goto('http://localhost:3000');

// Step 2: inject admin email into sessionStorage
await page.evaluate(() => {
  sessionStorage.setItem('qc_user_email', 'tunm1@ghn.vn');
});

// Step 3: now navigate to the protected page
await page.goto('http://localhost:3000/admin');
```

Never navigate directly to `/admin` without setting sessionStorage first — it will redirect to `/`.

---

## Project Structure

```
qc-cs-ai/
├── backend/
│   ├── main.py                    # FastAPI app entry
│   ├── core/
│   │   ├── config.py              # Settings (pydantic-settings, reads .env)
│   │   └── database.py            # Async SQLAlchemy engine
│   ├── api/routes/
│   │   ├── issues.py              # CRUD for issues
│   │   ├── knowledge_base.py      # KB management
│   │   ├── telegram_webhook.py    # Telegram bot webhook handler
│   │   ├── jira_webhook.py        # Jira status webhook
│   │   ├── upload.py              # Media upload (Cloudinary)
│   │   └── scoring.py             # Issue scoring
│   ├── models/                    # SQLAlchemy ORM models
│   ├── schemas/                   # Pydantic request/response schemas
│   ├── services/
│   │   ├── ai_service.py          # OpenAI calls (classification, follow-up Q&A)
│   │   ├── telegram_service.py    # python-telegram-bot Application
│   │   ├── kb_service.py          # Knowledge base retrieval
│   │   ├── jira_service.py        # Jira API
│   │   └── scoring_service.py     # Composite score calculation
│   ├── worker/
│   │   └── jira_notifier.py       # Webhook-triggered Jira→Telegram notifications
│   ├── alembic/                   # DB migration versions
│   ├── .env                       # Local secrets (not committed)
│   └── requirements.txt
├── frontend/
│   ├── src/app/
│   │   ├── page.tsx               # Public issues feed
│   │   ├── submit/page.tsx        # Submit bug/feature form
│   │   ├── issues/[id]/page.tsx   # Issue detail (public)
│   │   └── admin/
│   │       ├── layout.tsx         # Admin auth guard (sessionStorage check)
│   │       ├── page.tsx           # PM/QC queue — approve/reject/classify
│   │       ├── knowledge-base/    # KB management UI
│   │       └── settings/          # App settings
│   ├── src/components/
│   │   ├── EmailGate.tsx          # Email input gate wrapping public pages
│   │   ├── NavBar.tsx             # Shows "Quản trị" link only for PM_QC_EMAILS
│   │   ├── IssueCard.tsx          # Issue list item
│   │   └── JiraStatusBadge.tsx    # Jira status display
│   ├── src/lib/
│   │   ├── api.ts                 # Typed API client (wraps fetch to backend)
│   │   ├── types.ts               # Shared TypeScript types
│   │   └── constants.ts           # Labels, colors, GHN_EMAIL_REGEX
│   └── .env.local                 # NEXT_PUBLIC_* vars (not committed)
├── scripts/
│   └── dev_local.py               # Orchestrates backend + localtunnel + webhook setup
├── dev.sh                         # Shortcut: python3 scripts/dev_local.py
└── railway.toml                   # Railway deployment config
```

---

## Key API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/telegram/webhook` | Telegram bot messages |
| GET | `/api/issues` | List approved issues (public feed) |
| GET | `/api/issues/admin` | All issues (admin queue) |
| PATCH | `/api/issues/{id}` | Update status/classification (admin) |
| POST | `/api/upload` | Upload image/video → Cloudinary |
| GET/POST | `/api/knowledge-base` | KB entries |
| POST | `/api/jira/webhook` | Jira status change notifications |
| GET | `/health` | Health check |

---

## Environment Variables

### Backend (`backend/.env`)
```
DATABASE_URL=postgresql+asyncpg://...
OPENAI_API_KEY=...
TELEGRAM_BOT_TOKEN=...
TELEGRAM_WEBHOOK_SECRET=...
TELEGRAM_MONITORED_GROUP_IDS=-5104498769
TELEGRAM_ANNOUNCEMENT_GROUP_ID=...
JIRA_DOMAIN=faboshopteam.atlassian.net
JIRA_EMAIL=tunm1@ghn.vn
JIRA_API_TOKEN=...
JIRA_WEBHOOK_SECRET=...
PM_QC_EMAILS=tunm1@ghn.vn
FRONTEND_URL=https://frontend-production-f2af.up.railway.app
BACKEND_BASE_URL=http://localhost:8000   # keep empty/localhost to skip auto-webhook-set on startup
```

### Frontend (`frontend/.env.local`)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_PM_QC_EMAILS=tunm1@ghn.vn
```

---

## Tech Stack

- **Backend:** Python FastAPI + SQLAlchemy async + PostgreSQL (Railway)
- **Frontend:** Next.js 15 App Router + TailwindCSS
- **AI:** OpenAI (gpt-4o) for issue classification and follow-up Q&A
- **Bot:** python-telegram-bot v21 (webhook mode)
- **Media:** Cloudinary
- **Tunnel (dev):** localtunnel (`lt`)
- **Hosting:** Railway
