import json
import re
import base64
from anthropic import AsyncAnthropic
from core.config import get_settings
from models.knowledge_base import KBEntry

_client: AsyncAnthropic | None = None


def get_client() -> AsyncAnthropic:
    global _client
    if _client is None:
        _client = AsyncAnthropic(api_key=get_settings().anthropic_api_key)
    return _client


def _kb_context(entries: list[KBEntry]) -> str:
    if not entries:
        return "No knowledge base entries available."
    parts = []
    for e in entries:
        parts.append(f"### {e.title}\n{e.content}")
    return "\n\n".join(parts)


def _parse_json_response(text: str) -> dict:
    """Extract JSON from Claude response, handling markdown fences."""
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        return json.loads(m.group(0))
    raise ValueError(f"No JSON found in response: {text[:200]}")


CLASSIFY_SYSTEM = """You are a QC analyst for GHN CS AI (a customer service AI product).
Your job is to classify incoming feedback from QC/user teams.

<knowledge_base>
{kb_context}
</knowledge_base>

Classify the message/image as either a "bug" (something broken or wrong) or "feature_request" (new capability wanted).
Use the knowledge base to understand the product and make accurate classifications.

Respond ONLY with valid JSON in this exact format:
{{
  "type": "bug" | "feature_request" | "unclear",
  "confidence": 0.0-1.0,
  "priority": "low" | "medium" | "high" | "critical",
  "title": "short title (max 100 chars)",
  "description": "detailed description of the issue",
  "root_cause_suggestion": "possible root cause based on knowledge base, or null",
  "follow_up_question": "one specific follow-up question to ask if unclear, or null"
}}"""


async def classify_image(
    image_bytes: bytes,
    mime_type: str,
    kb_entries: list[KBEntry],
    text_context: str = "",
) -> dict:
    """Classify a screenshot/image. Returns structured classification dict."""
    settings = get_settings()
    b64 = base64.standard_b64encode(image_bytes).decode()

    content = []
    if text_context:
        content.append({"type": "text", "text": f"User message: {text_context}\n\nScreenshot:"})
    else:
        content.append({"type": "text", "text": "Analyze this screenshot:"})

    content.append({
        "type": "image",
        "source": {"type": "base64", "media_type": mime_type, "data": b64},
    })
    content.append({"type": "text", "text": "Classify this feedback and respond with JSON."})

    response = await get_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=CLASSIFY_SYSTEM.format(kb_context=_kb_context(kb_entries)),
        messages=[{"role": "user", "content": content}],
    )
    raw = response.content[0].text
    result = _parse_json_response(raw)
    result["_raw"] = raw
    return result


async def classify_with_context(
    original_text: str,
    original_image_url: str | None,
    replies: list[str],
    kb_entries: list[KBEntry],
) -> dict:
    """Classify with accumulated Q&A context (no image re-fetch needed)."""
    settings = get_settings()

    conversation = []
    user_content = []
    if original_image_url:
        user_content.append({"type": "text", "text": f"Original message: {original_text}\n\nOriginal screenshot: {original_image_url}"})
    else:
        user_content.append({"type": "text", "text": f"Original message: {original_text}"})

    if replies:
        user_content.append({"type": "text", "text": "\n\nFollow-up answers:\n" + "\n".join(f"- {r}" for r in replies)})

    user_content.append({"type": "text", "text": "\nClassify this feedback and respond with JSON."})
    conversation.append({"role": "user", "content": user_content})

    response = await get_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=1024,
        system=CLASSIFY_SYSTEM.format(kb_context=_kb_context(kb_entries)),
        messages=conversation,
    )
    raw = response.content[0].text
    result = _parse_json_response(raw)
    result["_raw"] = raw
    return result


async def generate_kb_summary(raw_content: str) -> str:
    """Condense raw Jira/doc content into a structured KB summary."""
    settings = get_settings()
    response = await get_client().messages.create(
        model=settings.anthropic_model,
        max_tokens=512,
        system="You are a technical writer. Summarize the following content into a concise, structured knowledge base entry. Focus on facts useful for bug classification and root cause analysis. Keep it under 300 words.",
        messages=[{"role": "user", "content": raw_content}],
    )
    return response.content[0].text


async def generate_follow_up_question(classification: dict, round_num: int) -> str:
    """Generate a targeted follow-up question based on current classification."""
    if classification.get("follow_up_question"):
        return classification["follow_up_question"]
    # Fallback questions based on type
    if classification.get("type") == "bug":
        questions = [
            "Can you describe the exact steps to reproduce this issue?",
            "What was the expected behavior vs what actually happened?",
        ]
    else:
        questions = [
            "What specific problem would this feature solve for you?",
            "How often do you encounter the limitation this feature would address?",
        ]
    return questions[min(round_num - 1, len(questions) - 1)]
