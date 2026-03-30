from fastapi import APIRouter, Request, HTTPException, Depends
from telegram import Update
from core.config import get_settings, Settings
from services.telegram_service import get_application

router = APIRouter(prefix="/telegram", tags=["telegram"])


@router.post("/webhook")
async def telegram_webhook(
    request: Request,
    settings: Settings = Depends(get_settings),
):
    # Verify Telegram secret token
    token = request.headers.get("X-Telegram-Bot-Api-Secret-Token", "")
    if settings.telegram_webhook_secret and token != settings.telegram_webhook_secret:
        raise HTTPException(403, "Invalid Telegram webhook token")

    data = await request.json()
    application = get_application()
    update = Update.de_json(data, application.bot)
    await application.process_update(update)
    return {"ok": True}
