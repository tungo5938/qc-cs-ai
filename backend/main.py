from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text

from core.config import get_settings
from core.database import engine
from api.routes import issues, knowledge_base, jira_webhook, jira_workspace, telegram_webhook, upload, scoring, products, feedbacks, solutions, meetings, action_items, dashboard, auth_settings, priority_config, documents, meeting_templates, sprint_configs


async def _ensure_feedback_rating_columns() -> None:
    """
    Safety net for production rollouts where app code is deployed
    before Alembic migration 0006 is applied.
    """
    if engine.dialect.name != "postgresql":
        return
    async with engine.begin() as conn:
        await conn.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS tu_danh_gia INTEGER")
        )
        await conn.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS priority_score DOUBLE PRECISION")
        )
        await conn.execute(
            text("ALTER TABLE feedbacks ADD COLUMN IF NOT EXISTS feedback_type TEXT")
        )


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    await _ensure_feedback_rating_columns()
    # Initialize and register Telegram bot
    if settings.telegram_bot_token:
        from services.telegram_service import get_application
        application = get_application()
        await application.initialize()
        if settings.backend_base_url and settings.backend_base_url.startswith("https://"):
            webhook_url = f"{settings.frontend_url.rstrip('/')}/api/telegram/webhook"
            await application.bot.set_webhook(
                url=webhook_url,
                secret_token=settings.telegram_webhook_secret or None,
                allowed_updates=["message"],
            )
    yield
    # Cleanup
    from services.telegram_service import _application
    if _application is not None:
        await _application.shutdown()


app = FastAPI(title="QC CS AI", version="1.0.0", lifespan=lifespan)

settings = get_settings()
_cors_origins = list({
    settings.frontend_url,
    "http://localhost:3000",
    "https://producthub.ghn.studio",
})
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(issues.router, prefix="/api")
app.include_router(knowledge_base.router, prefix="/api")
app.include_router(jira_webhook.router, prefix="/api")
app.include_router(jira_workspace.router, prefix="/api")
app.include_router(telegram_webhook.router, prefix="/api")
app.include_router(upload.router, prefix="/api")
app.include_router(scoring.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(feedbacks.router, prefix="/api")
app.include_router(solutions.router, prefix="/api")
app.include_router(meetings.router, prefix="/api")
app.include_router(action_items.router, prefix="/api")
app.include_router(dashboard.router, prefix="/api")
app.include_router(auth_settings.router, prefix="/api")
app.include_router(priority_config.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(meeting_templates.router, prefix="/api")
app.include_router(sprint_configs.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok", "ai": "openai-v2"}
