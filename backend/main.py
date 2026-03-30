from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from core.config import get_settings
from api.routes import issues, knowledge_base, jira_webhook, telegram_webhook, upload


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    # Initialize and register Telegram bot
    if settings.telegram_bot_token:
        from services.telegram_service import get_application
        application = get_application()
        await application.initialize()
        if settings.backend_base_url:
            webhook_url = f"{settings.backend_base_url.rstrip('/')}/api/telegram/webhook"
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
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(issues.router, prefix="/api")
app.include_router(knowledge_base.router, prefix="/api")
app.include_router(jira_webhook.router, prefix="/api")
app.include_router(telegram_webhook.router, prefix="/api")
app.include_router(upload.router, prefix="/api")


@app.get("/health")
async def health():
    return {"status": "ok"}
