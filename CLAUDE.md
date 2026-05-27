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

The app uses **NextAuth** with Google OAuth + JWT session cookies. The middleware (`src/middleware.ts`) protects all routes except `/login` and `/api/auth/*`.

### Admin access
Admin email: `tunm1@ghn.vn` (listed in `NEXT_PUBLIC_PM_QC_EMAILS` and backend `PM_QC_EMAILS`).

### Frontend `.env.local` (required to run locally)
```
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
NEXT_PUBLIC_PM_QC_EMAILS=tunm1@ghn.vn
NEXTAUTH_SECRET=preview-test-secret-local
NEXTAUTH_URL=http://localhost:3000
GOOGLE_CLIENT_ID=placeholder
GOOGLE_CLIENT_SECRET=placeholder
```

### Testing with Playwright (UI preview/verification)

Because the middleware requires a valid NextAuth JWT cookie, **sessionStorage injection alone is not enough**. The correct approach:

**Step 1 — generate a JWT token:**
```js
// run from frontend/ directory
const { encode } = require('./node_modules/next-auth/jwt');
const token = await encode({
  token: { email: 'tunm1@ghn.vn', name: 'Tun M', sub: 'test', iat: Math.floor(Date.now()/1000), exp: Math.floor(Date.now()/1000)+86400 },
  secret: 'preview-test-secret-local',  // must match NEXTAUTH_SECRET in .env.local
});
```

**Step 2 — set the cookie in Playwright context before navigation:**
```js
await context.addCookies([{
  name: 'next-auth.session-token',
  value: token,
  domain: 'localhost',
  path: '/',
  httpOnly: true,
  sameSite: 'Lax',
}]);
```

**Step 3 — mock `/api/auth/session` so the frontend sees a logged-in user:**
```js
await page.route('**/api/auth/session*', async route => {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({ user: { email: 'tunm1@ghn.vn', name: 'Tun M' }, expires: '2099-01-01' }),
  });
});
```

**Step 4 — navigate directly to the protected page:**
```js
await page.goto('http://localhost:3000/feedback');
```

### UI change verification workflow

**Before AND after every UI change, Claude must:**
1. Start the dev server if not running: `cd frontend && npm run dev > /tmp/qc_frontend.log 2>&1 &`
2. Wait until ready: `until curl -s http://localhost:3000 > /dev/null 2>&1; do sleep 2; done`
3. Run a Playwright script (using the auth cookie approach above) to screenshot the affected page
4. Send the screenshot to the user to confirm the result looks correct
5. Only mark the task as done after the screenshot is reviewed

Playwright is available at `frontend/node_modules/.bin/playwright` and can be imported via:
```js
import { chromium } from '/home/user/qc-cs-ai/frontend/node_modules/playwright/index.mjs';
```

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
