"""
Telegram bot FSM.

Flow per message in monitored groups:
  1. Any message with photo/video → start classification
  2. Classify with AI (max 2 Q&A rounds)
  3. Post summary or follow-up question
  4. On follow-up reply (same poster, reply_to = bot's last message) → continue FSM
"""
import asyncio
import io
import httpx
from telegram import Update, Bot, Message
from telegram.ext import Application, MessageHandler, filters, ContextTypes
from sqlalchemy import select

from core.config import get_settings
from core.database import AsyncSessionLocal
from models.issue import Issue, IssueType, IssueStatus, IssuePriority, IssueSource
from models.telegram_thread import TelegramThread, QAState
from models.base import gen_uuid
from services import ai_service, kb_service

_application: Application | None = None
CONFIDENCE_THRESHOLD = 0.80


def get_application() -> Application:
    global _application
    if _application is None:
        settings = get_settings()
        _application = (
            Application.builder()
            .token(settings.telegram_bot_token)
            .build()
        )
        _application.add_handler(
            MessageHandler(filters.ALL & ~filters.COMMAND, handle_message)
        )
    return _application


# ── helpers ──────────────────────────────────────────────────────────────────

async def _download_file(bot: Bot, file_id: str) -> tuple[bytes, str]:
    """Download a Telegram file, return (bytes, mime_type)."""
    tg_file = await bot.get_file(file_id)
    async with httpx.AsyncClient() as client:
        resp = await client.get(tg_file.file_path)
        resp.raise_for_status()
    mime = "image/jpeg"
    if tg_file.file_path.endswith(".png"):
        mime = "image/png"
    elif tg_file.file_path.endswith(".gif"):
        mime = "image/gif"
    return resp.content, mime


def _priority_to_label(priority: str) -> str:
    return {"low": "🟢 Low", "medium": "🟡 Medium", "high": "🟠 High", "critical": "🔴 Critical"}.get(priority, priority)


def _type_label(t: str) -> str:
    return {"bug": "🐛 Bug", "feature_request": "✨ Feature Request", "unclear": "❓ Unclear"}.get(t, t)


def _summary_message(issue: Issue) -> str:
    return (
        f"📋 *Feedback Logged*\n\n"
        f"*Type:* {_type_label(issue.type)}\n"
        f"*Priority:* {_priority_to_label(issue.priority)}\n"
        f"*Title:* {issue.title}\n\n"
        f"_{issue.description[:300]}{'...' if len(issue.description) > 300 else ''}_\n\n"
        f"🆔 Issue ID: `{issue.id[:8]}`"
    )


# ── FSM core ─────────────────────────────────────────────────────────────────

async def _finalize_issue(
    db,
    thread: TelegramThread,
    classification: dict,
    media_urls: list[str],
    bot: Bot,
) -> Issue:
    issue_type = IssueType(classification.get("type", "unclear"))
    priority = IssuePriority(classification.get("priority", "medium"))

    issue = Issue(
        id=thread.issue_id or gen_uuid(),
        type=issue_type,
        title=classification.get("title", "Untitled")[:200],
        description=classification.get("description", thread.collected_context or "")[:2000],
        status=IssueStatus.pending_review,
        priority=priority,
        source=IssueSource.telegram,
        telegram_group_id=thread.group_id,
        telegram_message_id=thread.root_message_id,
        telegram_poster_id=thread.poster_tg_user_id,
        media_urls=media_urls,
        ai_classification_raw={"raw": classification.get("_raw", ""), "confidence": classification.get("confidence")},
        root_cause=classification.get("root_cause_suggestion"),
        is_public=False,
    )
    if not thread.issue_id:
        db.add(issue)
        thread.issue_id = issue.id

    thread.qa_state = QAState.complete
    await db.flush()

    # Post summary to group
    summary = _summary_message(issue)
    sent = await bot.send_message(chat_id=thread.group_id, text=summary, parse_mode="Markdown")
    thread.last_bot_message_id = sent.message_id
    await db.flush()
    return issue


async def _handle_new_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry point: new message with media in a monitored group."""
    if not update.message:
        return
    msg: Message = update.message
    settings = get_settings()

    if msg.chat_id not in settings.monitored_group_ids:
        return

    # Only process messages with photos or documents (images/video)
    has_media = bool(msg.photo or msg.document or msg.video)
    if not has_media and not msg.text:
        return

    async with AsyncSessionLocal() as db:
        # Check if this is a reply to an active bot Q&A thread
        if msg.reply_to_message:
            await _handle_qa_reply(db, msg, context.bot, settings)
            return

        # Only start new thread for messages with media
        if not has_media:
            return

        # Download & upload media
        media_urls: list[str] = []
        image_bytes: bytes | None = None
        mime_type = "image/jpeg"
        temp_issue_id = gen_uuid()

        if msg.photo:
            largest = max(msg.photo, key=lambda p: p.file_size or 0)
            tg_file = await context.bot.get_file(largest.file_id)
            image_bytes, mime_type = await _download_file(context.bot, largest.file_id)
            media_urls.append(tg_file.file_path)
        elif msg.document and msg.document.mime_type and msg.document.mime_type.startswith("image/"):
            tg_file = await context.bot.get_file(msg.document.file_id)
            image_bytes, mime_type = await _download_file(context.bot, msg.document.file_id)
            media_urls.append(tg_file.file_path)
        elif msg.video:
            tg_file = await context.bot.get_file(msg.video.file_id)
            media_urls.append(tg_file.file_path)

        # Create TelegramThread
        thread = TelegramThread(
            id=gen_uuid(),
            group_id=msg.chat_id,
            root_message_id=msg.message_id,
            poster_tg_user_id=msg.from_user.id,
            qa_state=QAState.awaiting_classification,
            collected_context=msg.caption or msg.text or "",
        )
        db.add(thread)
        await db.flush()

        # Classify
        kb_entries = await kb_service.get_relevant_entries(db, msg.caption or msg.text or "feedback", limit=5)

        if image_bytes:
            classification = await ai_service.classify_image(image_bytes, mime_type, kb_entries, msg.caption or "")
        else:
            classification = await ai_service.classify_with_context(msg.text or "", None, [], kb_entries)

        confidence = classification.get("confidence", 0.0)

        if confidence >= CONFIDENCE_THRESHOLD:
            await _finalize_issue(db, thread, classification, media_urls, context.bot)
        else:
            # Ask follow-up Q1
            question = await ai_service.generate_follow_up_question(classification, 1)
            poster_mention = f"@{msg.from_user.username}" if msg.from_user.username else msg.from_user.first_name
            bot_msg = await context.bot.send_message(
                chat_id=msg.chat_id,
                text=f"{poster_mention} {question}",
                reply_to_message_id=msg.message_id,
            )
            thread.qa_state = QAState.awaiting_reply_1
            thread.qa_round = 1
            thread.last_bot_message_id = bot_msg.message_id
            # Store partial classification for context
            thread.collected_context = f"{thread.collected_context}\n[AI initial]: {classification.get('description', '')}"
            # Store media urls temporarily in issue_id field until issue is created
            # We store them in a temporary Issue with pending state
            issue = Issue(
                id=temp_issue_id,
                type=IssueType(classification.get("type", "unclear")),
                title=classification.get("title", "Pending classification")[:200],
                description=classification.get("description", "")[:2000],
                status=IssueStatus.pending_review,
                priority=IssuePriority(classification.get("priority", "medium")),
                source=IssueSource.telegram,
                telegram_group_id=msg.chat_id,
                telegram_message_id=msg.message_id,
                telegram_poster_id=msg.from_user.id,
                media_urls=media_urls,
                ai_classification_raw={"raw": classification.get("_raw", ""), "confidence": confidence},
                is_public=False,
            )
            db.add(issue)
            thread.issue_id = temp_issue_id
            await db.commit()


async def _handle_qa_reply(db, msg: Message, bot: Bot, settings):
    """Handle a reply message that continues a Q&A thread."""
    replied_to_id = msg.reply_to_message.message_id

    result = await db.execute(
        select(TelegramThread).where(
            TelegramThread.group_id == msg.chat_id,
            TelegramThread.last_bot_message_id == replied_to_id,
            TelegramThread.qa_state.in_([QAState.awaiting_reply_1, QAState.awaiting_reply_2]),
        )
    )
    thread = result.scalar_one_or_none()
    if not thread:
        return

    # Only accept reply from original poster
    if msg.from_user.id != thread.poster_tg_user_id:
        return

    reply_text = msg.text or msg.caption or ""
    thread.collected_context = (thread.collected_context or "") + f"\n[Reply {thread.qa_round}]: {reply_text}"

    # Re-classify with context
    issue_result = await db.execute(select(Issue).where(Issue.id == thread.issue_id))
    issue = issue_result.scalar_one_or_none()
    media_urls = issue.media_urls if issue else []

    kb_entries = await kb_service.get_relevant_entries(db, reply_text, limit=5)
    replies = [reply_text]
    classification = await ai_service.classify_with_context(
        thread.collected_context or "",
        media_urls[0] if media_urls else None,
        replies,
        kb_entries,
    )
    confidence = classification.get("confidence", 0.0)

    if confidence >= CONFIDENCE_THRESHOLD or thread.qa_round >= 2:
        # Finalize
        if issue:
            issue.type = IssueType(classification.get("type", "unclear"))
            issue.title = classification.get("title", issue.title)[:200]
            issue.description = classification.get("description", issue.description)[:2000]
            issue.priority = IssuePriority(classification.get("priority", "medium"))
            issue.root_cause = classification.get("root_cause_suggestion")
            issue.ai_classification_raw = {"raw": classification.get("_raw", ""), "confidence": confidence}
            await db.flush()
        thread.qa_state = QAState.complete
        summary = _summary_message(issue) if issue else "✅ Feedback logged."
        sent = await bot.send_message(chat_id=msg.chat_id, text=summary, parse_mode="Markdown")
        thread.last_bot_message_id = sent.message_id
    else:
        # Ask Q2
        question = await ai_service.generate_follow_up_question(classification, 2)
        poster_mention = f"@{msg.from_user.username}" if msg.from_user.username else msg.from_user.first_name
        bot_msg = await bot.send_message(
            chat_id=msg.chat_id,
            text=f"{poster_mention} {question}",
            reply_to_message_id=msg.message_id,
        )
        thread.qa_state = QAState.awaiting_reply_2
        thread.qa_round = 2
        thread.last_bot_message_id = bot_msg.message_id

    await db.commit()


async def handle_message(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Top-level handler — catches all exceptions to avoid crashing the bot."""
    try:
        await _handle_new_feedback(update, context)
    except Exception as e:
        print(f"[TelegramBot] Error handling message: {e}")
