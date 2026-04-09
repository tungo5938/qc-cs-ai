"""
Telegram bot FSM.

Flow per message in monitored groups:
  1. Any message with photo/video → start classification
  2. Classify with AI (max 2 Q&A rounds)
  3. Post summary or follow-up question
  4. On follow-up reply (same poster, reply_to = bot's last message) → continue FSM
"""
from __future__ import annotations
from typing import Optional
import asyncio
import io
import httpx
from telegram import Update, Bot, Message
from telegram.ext import Application, MessageHandler, filters, ContextTypes
from sqlalchemy import select

from core.config import get_settings
from core.database import AsyncSessionLocal
from models.issue import Issue, IssueType, IssueStatus, IssuePriority, IssueSource, TeamType
from models.telegram_thread import TelegramThread, QAState
from models.feedback import Feedback
from models.product import Product
from models.base import gen_uuid
from services import ai_service, kb_service, scoring_service

_application: Optional[Application] = None
CONFIDENCE_THRESHOLD = 0.80

TEAM_KEYWORDS = {
    TeamType.cs_b2c: ["b2c", "cs b2c", "csb2c", "b 2 c"],
    TeamType.cs_c2c: ["c2c", "cs c2c", "csc2c", "c 2 c"],
    TeamType.telesales: ["telesales", "tele sales", "tele", "sale"],
}

def _detect_team(text: str) -> TeamType:
    lower = text.lower()
    for team, keywords in TEAM_KEYWORDS.items():
        if any(kw in lower for kw in keywords):
            return team
    return TeamType.unknown


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
    return {"low": "🟢 Thấp", "medium": "🟡 Trung bình", "high": "🟠 Cao", "critical": "🔴 Nghiêm trọng"}.get(priority, priority)


def _type_label(t: str) -> str:
    return {"bug": "🐛 Lỗi", "feature_request": "✨ Yêu cầu tính năng", "unclear": "❓ Chưa rõ"}.get(t, t)


def _escape_md(text: str) -> str:
    """Escape special characters for Telegram MarkdownV2."""
    for ch in r"\_*[]()~`>#+-=|{}.!":
        text = text.replace(ch, f"\\{ch}")
    return text


def _summary_message(issue: Issue) -> str:
    desc = issue.description[:300] + ("..." if len(issue.description) > 300 else "")
    return (
        f"✅ *Đã ghi nhận phản hồi của bạn\\!*\n\n"
        f"*Loại:* {_type_label(issue.type)}\n"
        f"*Mức độ:* {_priority_to_label(issue.priority)}\n"
        f"*Tiêu đề:* {_escape_md(issue.title)}\n\n"
        f"_{_escape_md(desc)}_\n\n"
        f"🆔 Mã issue: `{issue.id[:8]}`\n"
        f"📌 Đội QC/PM sẽ xem xét và phản hồi sớm\\."
    )


# ── FSM core ─────────────────────────────────────────────────────────────────

async def _finalize_issue(
    db,
    thread: TelegramThread,
    classification: dict,
    media_urls: list[str],
    bot: Bot,
    detected_team: TeamType = TeamType.unknown,
) -> Issue:
    issue_type = IssueType(classification.get("type", "unclear"))
    priority = IssuePriority(classification.get("priority", "medium"))
    # Team: prefer what AI detected from content, then what we parsed from text
    ai_team_str = classification.get("team", "unknown")
    try:
        ai_team = TeamType(ai_team_str)
    except ValueError:
        ai_team = TeamType.unknown
    team = ai_team if ai_team != TeamType.unknown else detected_team

    kb_refs = classification.get("kb_references", [])
    root_cause = classification.get("root_cause_suggestion")
    if root_cause and kb_refs:
        root_cause = root_cause + "\n\nKB liên quan: " + ", ".join(kb_refs)

    csat = classification.get("csat_score")
    csat_float = float(csat) if csat is not None else None

    issue = Issue(
        id=thread.issue_id or gen_uuid(),
        type=issue_type,
        title=classification.get("title", "Chưa có tiêu đề")[:200],
        description=classification.get("description", thread.collected_context or "")[:2000],
        status=IssueStatus.pending_review,
        priority=priority,
        source=IssueSource.telegram,
        team=team,
        telegram_group_id=thread.group_id,
        telegram_message_id=thread.root_message_id,
        telegram_poster_id=thread.poster_tg_user_id,
        media_urls=media_urls,
        ai_classification_raw={"raw": classification.get("_raw", ""), "confidence": classification.get("confidence"), "kb_references": kb_refs},
        root_cause=root_cause,
        csat_score=csat_float,
        is_public=False,
    )
    if not thread.issue_id:
        db.add(issue)
        thread.issue_id = issue.id
    else:
        existing = await db.get(Issue, thread.issue_id)
        if existing:
            existing.type = issue_type
            existing.title = issue.title
            existing.description = issue.description
            existing.priority = priority
            existing.team = team
            existing.root_cause = root_cause
            existing.ai_classification_raw = issue.ai_classification_raw
            existing.csat_score = csat_float
            issue = existing

    thread.qa_state = QAState.complete
    await db.flush()
    # Auto-calculate composite score from CSAT alone (other scores come later)
    await scoring_service.recalculate_issue(db, issue)

    # Post summary to group
    summary = _summary_message(issue)
    sent = await bot.send_message(chat_id=thread.group_id, text=summary, parse_mode="MarkdownV2")
    thread.last_bot_message_id = sent.message_id
    await db.flush()

    # Ask for team if unknown
    if issue.team == TeamType.unknown:
        await bot.send_message(
            chat_id=thread.group_id,
            text="❓ Bạn thuộc team nào\\? Vui lòng reply tin nhắn này:\n*CS B2C* \\| *CS C2C* \\| *Telesales*",
            reply_to_message_id=sent.message_id,
            parse_mode="MarkdownV2",
        )

    return issue


async def _handle_product_feedback(msg: Message, bot: Bot, product: Product):
    """
    Handle a message from a Telegram group that is mapped to a Product.
    Creates a Feedback record, runs analysis pipeline, then replies to the group.
    """
    text_content = msg.caption or msg.text or ""
    media_urls = []

    if msg.photo:
        largest = max(msg.photo, key=lambda p: p.file_size or 0)
        tg_file = await bot.get_file(largest.file_id)
        media_urls.append(tg_file.file_path)
    elif msg.document and msg.document.mime_type and msg.document.mime_type.startswith("image/"):
        tg_file = await bot.get_file(msg.document.file_id)
        media_urls.append(tg_file.file_path)
    elif msg.video:
        tg_file = await bot.get_file(msg.video.file_id)
        media_urls.append(tg_file.file_path)

    async with AsyncSessionLocal() as db:
        feedback = Feedback(
            id=gen_uuid(),
            product_id=product.id,
            raw_content=text_content or "(media only)",
            media_urls=media_urls if media_urls else None,
            submitted_by=msg.from_user.username or msg.from_user.first_name if msg.from_user else None,
            source="telegram",
            status="new",
            telegram_message_id=str(msg.message_id),
            telegram_group_id=str(msg.chat_id),
        )
        db.add(feedback)
        await db.flush()

        # Post acknowledgement to group before analysis
        try:
            await bot.send_message(
                chat_id=msg.chat_id,
                text=f"✅ Đã ghi nhận feedback cho {product.name}. Đang phân tích...",
                reply_to_message_id=msg.message_id,
            )
        except Exception as e:
            print(f"[TelegramBot] Failed to send ack message: {e}")

        # Run analysis pipeline
        try:
            from api.routes.feedbacks import _run_analysis_pipeline
            await _run_analysis_pipeline(db, feedback)
        except Exception as e:
            print(f"[TelegramBot] Analysis pipeline failed: {e}")

        await db.commit()
        print(f"[TelegramBot] Created feedback {feedback.id} for product {product.name}")


async def _handle_new_feedback(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Entry point: new message with media in a monitored group."""
    if not update.message:
        print("[TelegramBot] No message in update")
        return
    msg: Message = update.message
    settings = get_settings()

    print(f"[TelegramBot] Message from chat_id={msg.chat_id}, monitored={settings.monitored_group_ids}, has_photo={bool(msg.photo)}")

    # Check if this group is mapped to a Product in the products table
    async with AsyncSessionLocal() as db:
        product_result = await db.execute(
            select(Product).where(Product.telegram_group_id == str(msg.chat_id))
        )
        product = product_result.scalar_one_or_none()

    if product:
        text_content = msg.caption or msg.text or ""
        has_media = bool(msg.photo or msg.document or msg.video)
        if has_media or len(text_content.strip()) >= 5:
            await _handle_product_feedback(msg, context.bot, product)
        return

    if msg.chat_id not in settings.monitored_group_ids:
        print(f"[TelegramBot] Ignoring chat_id={msg.chat_id} not in monitored list")
        return

    # Only process messages with photos, documents, or meaningful text
    has_media = bool(msg.photo or msg.document or msg.video)
    text_content = msg.caption or msg.text or ""
    if not has_media and len(text_content.strip()) < 5:
        return

    print(f"[TelegramBot] Opening DB session")
    async with AsyncSessionLocal() as db:
        # Check if this is a reply to an active bot Q&A thread
        if msg.reply_to_message:
            await _handle_qa_reply(db, msg, context.bot, settings)
            return

        # Download & upload media
        media_urls: list[str] = []
        image_bytes: Optional[bytes] = None
        mime_type = "image/jpeg"
        temp_issue_id = gen_uuid()
        print(f"[TelegramBot] Downloading media, has_photo={bool(msg.photo)}")

        if msg.photo:
            largest = max(msg.photo, key=lambda p: p.file_size or 0)
            print(f"[TelegramBot] Getting file: {largest.file_id[:30]}...")
            tg_file = await context.bot.get_file(largest.file_id)
            print(f"[TelegramBot] Downloading from: {tg_file.file_path}")
            image_bytes, mime_type = await _download_file(context.bot, largest.file_id)
            print(f"[TelegramBot] Downloaded {len(image_bytes)} bytes")
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
            collected_context=text_content,
        )
        db.add(thread)
        await db.flush()

        # Classify
        kb_entries = await kb_service.get_relevant_entries(db, text_content or "feedback", limit=5)

        if image_bytes:
            classification = await ai_service.classify_image(image_bytes, mime_type, kb_entries, msg.caption or "")
        else:
            classification = await ai_service.classify_with_context(text_content, None, [], kb_entries)

        confidence = classification.get("confidence", 0.0)

        detected_team = _detect_team(text_content)

        if confidence >= CONFIDENCE_THRESHOLD:
            await _finalize_issue(db, thread, classification, media_urls, context.bot, detected_team)
            await db.commit()
        else:
            # Ask follow-up Q1
            question = await ai_service.generate_follow_up_question(classification, 1)
            poster_mention = f"@{msg.from_user.username}" if msg.from_user.username else msg.from_user.first_name
            bot_msg = await context.bot.send_message(
                chat_id=msg.chat_id,
                text=f"{poster_mention} {_escape_md(question)}",
                reply_to_message_id=msg.message_id,
                parse_mode="MarkdownV2",
            )
            thread.qa_state = QAState.awaiting_reply_1
            thread.qa_round = 1
            thread.last_bot_message_id = bot_msg.message_id
            thread.collected_context = f"{thread.collected_context}\n[AI initial]: {classification.get('description', '')}"

            ai_team_str = classification.get("team", "unknown")
            try:
                ai_team = TeamType(ai_team_str)
            except ValueError:
                ai_team = TeamType.unknown
            team = ai_team if ai_team != TeamType.unknown else detected_team

            issue = Issue(
                id=temp_issue_id,
                type=IssueType(classification.get("type", "unclear")),
                title=classification.get("title", "Đang phân loại")[:200],
                description=classification.get("description", "")[:2000],
                status=IssueStatus.pending_review,
                priority=IssuePriority(classification.get("priority", "medium")),
                source=IssueSource.telegram,
                team=team,
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

    # First check: completed thread waiting for team reply
    result = await db.execute(
        select(TelegramThread).where(
            TelegramThread.group_id == msg.chat_id,
            TelegramThread.last_bot_message_id == replied_to_id,
            TelegramThread.qa_state == QAState.complete,
        )
    )
    completed_thread = result.scalar_one_or_none()
    if completed_thread and completed_thread.issue_id:
        team = _detect_team(msg.text or "")
        if team != TeamType.unknown:
            issue_result = await db.execute(select(Issue).where(Issue.id == completed_thread.issue_id))
            issue = issue_result.scalar_one_or_none()
            if issue:
                issue.team = team
                await db.commit()
                team_labels = {"cs_b2c": "CS B2C", "cs_c2c": "CS C2C", "telesales": "Telesales"}
                label = team_labels.get(team.value, team.value)
                await bot.send_message(
                    chat_id=msg.chat_id,
                    text=f"✅ Đã cập nhật team: *{_escape_md(label)}*",
                    parse_mode="MarkdownV2",
                )
        return

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

    detected_team = _detect_team(reply_text)

    if confidence >= CONFIDENCE_THRESHOLD or thread.qa_round >= 2:
        # Finalize via _finalize_issue to get team-ask behavior
        await _finalize_issue(db, thread, classification, media_urls, bot, detected_team)
        thread = (await db.execute(select(TelegramThread).where(TelegramThread.id == thread.id))).scalar_one()
    else:
        # Ask Q2
        question = await ai_service.generate_follow_up_question(classification, 2)
        poster_mention = f"@{msg.from_user.username}" if msg.from_user.username else msg.from_user.first_name
        bot_msg = await bot.send_message(
            chat_id=msg.chat_id,
            text=f"{poster_mention} {_escape_md(question)}",
            reply_to_message_id=msg.message_id,
            parse_mode="MarkdownV2",
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
