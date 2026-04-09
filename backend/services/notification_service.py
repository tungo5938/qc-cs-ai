from __future__ import annotations
from typing import Optional
import httpx
from core.config import get_settings


async def send_action_reminder(
    action_item_title: str,
    assignee: Optional[str],
    deadline: Optional[str],
    product_name: str,
    bot_token: Optional[str] = None,
    chat_id: Optional[str] = None,
) -> None:
    """Send a Telegram reminder message for an action item to the PM's chat."""
    settings = get_settings()
    token = bot_token or settings.telegram_bot_token
    target_chat_id = chat_id or settings.pm_telegram_chat_id

    if not token or not target_chat_id:
        print("[notification_service] Telegram bot_token or chat_id not configured, skipping reminder.")
        return

    assignee_text = assignee or "Chưa assign"
    deadline_text = deadline or "Chưa có deadline"

    message = (
        f"[{product_name}] ⏰ Task nhắc nhở: {action_item_title}\n"
        f"👤 Assignee: {assignee_text}\n"
        f"📅 Deadline: {deadline_text}"
    )

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": target_chat_id,
        "text": message,
    }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.post(url, json=payload)
            response.raise_for_status()
    except Exception as e:
        print(f"[notification_service] Failed to send Telegram reminder: {e}")
