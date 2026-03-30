from telegram import Bot
from core.config import Settings


async def notify_done(issue, link, settings: Settings) -> None:
    """Send Telegram notifications when a Jira ticket is marked Done."""
    if not settings.telegram_bot_token:
        return

    bot = Bot(token=settings.telegram_bot_token)
    ticket_key = link.jira_ticket_key
    title = issue.title if issue else ticket_key

    message = (
        f"✅ *Ticket Resolved*\n\n"
        f"*{ticket_key}* — {title}\n"
        f"Status: Done\n"
        f"Jira: {link.jira_url}"
    )

    sent_groups: set[int] = set()

    # Notify original group where bug was raised
    if issue and issue.telegram_group_id:
        try:
            await bot.send_message(
                chat_id=issue.telegram_group_id,
                text=message,
                parse_mode="Markdown",
            )
            sent_groups.add(issue.telegram_group_id)
        except Exception:
            pass

    # Notify announcement group
    if settings.telegram_announcement_group_id:
        try:
            ann_id = int(settings.telegram_announcement_group_id)
            if ann_id not in sent_groups:
                await bot.send_message(chat_id=ann_id, text=message, parse_mode="Markdown")
        except Exception:
            pass
