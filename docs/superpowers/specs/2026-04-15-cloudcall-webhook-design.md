# CloudCall Webhook Receiver — Design Spec

**Date:** 2026-04-15
**Status:** Approved

---

## Overview

A standalone FastAPI service hosted on Railway that receives webhook payloads from CloudCall (voicebot/call center), parses them into structured data, and persists them to a dedicated PostgreSQL database. Completely separate from the qc-cs-ai project and its database.

---

## Database Schema

### `calls`
One row per call. Upserted on `call_id` for idempotency.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | server-generated |
| `call_id` | VARCHAR UNIQUE | from payload |
| `application` | VARCHAR | e.g. `cloudcall` |
| `direction` | VARCHAR | `inbound` / `outbound` |
| `domain` | VARCHAR | |
| `from_number` | VARCHAR | |
| `to_number` | VARCHAR | |
| `hotline` | VARCHAR | |
| `status` | VARCHAR | `answered`, `missed`, etc. |
| `state` | VARCHAR | `completed`, etc. |
| `duration` | INT | total seconds |
| `billsec` | INT | billed seconds |
| `language` | VARCHAR | |
| `recording_url` | TEXT | |
| `sip_hangup_disposition` | VARCHAR | |
| `call_result` | VARCHAR | from `voicebot_result.call_result` |
| `bot_result` | TEXT | from `voicebot_result.call_result_detail.bot_result` |
| `bot_duration` | INT | from `voicebot_result.call_result_detail.bot_duration` |
| `bot_script_group` | JSONB | array of script group names |
| `received_at` | TIMESTAMP | server time on receipt |

### `call_transcripts`
One row per conversation turn, ordered by `turn_index`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `call_id` | FK → calls.id | cascade delete |
| `turn_index` | INT | 0-based order |
| `role` | VARCHAR | `customer` or `bot` |
| `text` | TEXT | |

### `call_step_logs`
One row per step/transfer event, ordered by `step_index`.

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | |
| `call_id` | FK → calls.id | cascade delete |
| `step_index` | INT | 0-based order |
| `type` | VARCHAR | `step` or `transfer` |
| `value` | TEXT | human-readable description |

---

## API

### `POST /webhook/cloudcall`

Receives the CloudCall voicebot payload.

**Validation:**
- Required fields: `call_id`, `status`, `state`
- If `WEBHOOK_SECRET` env var is set, validate `X-Webhook-Secret` request header

**Behavior:**
- Upsert `calls` row on `call_id` (re-delivery safe)
- Delete + re-insert `call_transcripts` and `call_step_logs` for that call (handles re-delivery)
- Returns `{"ok": true}` on success

**Error responses:**
- `400` — missing required fields
- `403` — invalid webhook secret
- `500` — database error

---

## Project Structure

```
cloudcall-webhook/
├── main.py                  # FastAPI app, mounts router
├── core/
│   ├── config.py            # Pydantic Settings (DATABASE_URL, WEBHOOK_SECRET)
│   └── database.py          # Async SQLAlchemy engine + session factory
├── models/
│   └── call.py              # Call, CallTranscript, CallStepLog ORM models
├── schemas/
│   └── cloudcall.py         # Pydantic request schema matching CloudCall payload
├── api/
│   └── cloudcall.py         # POST /webhook/cloudcall handler logic
├── alembic/                 # DB migrations
│   └── versions/
├── requirements.txt
├── railway.toml
└── .env                     # local only, not committed
```

---

## Railway Deployment

- **Service:** FastAPI app (`uvicorn main:app`)
- **Database:** Railway PostgreSQL plugin (new instance, not shared with qc-cs-ai)
- **Env vars:**
  - `DATABASE_URL` — injected by Railway PostgreSQL plugin
  - `WEBHOOK_SECRET` — optional shared secret for request validation

---

## Tech Stack

- **Runtime:** Python 3.11
- **Framework:** FastAPI + uvicorn
- **ORM:** SQLAlchemy async + asyncpg
- **Migrations:** Alembic
- **Database:** PostgreSQL (Railway)
- **Validation:** Pydantic v2
