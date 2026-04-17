from __future__ import annotations
from typing import Optional
import json
import re
import base64
from openai import AsyncOpenAI
from core.config import get_settings
from models.knowledge_base import KBEntry

_client: Optional[AsyncOpenAI] = None


def get_client() -> AsyncOpenAI:
    global _client
    if _client is None:
        _client = AsyncOpenAI(api_key=get_settings().openai_api_key)
    return _client


def _kb_context(entries: list[KBEntry]) -> str:
    if not entries:
        return "Không có dữ liệu trong knowledge base."
    parts = []
    for e in entries:
        ref = f" (Ref: {e.source_ref})" if e.source_ref else ""
        parts.append(f"### {e.title}{ref}\n{e.content}")
    return "\n\n".join(parts)


def _parse_json_response(text: str) -> dict:
    m = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    m = re.search(r"\{.*\}", text, re.DOTALL)
    if m:
        return json.loads(m.group(0))
    raise ValueError(f"No JSON found in response: {text[:200]}")


CLASSIFY_SYSTEM = """Bạn là chuyên gia phân tích QC cho hệ thống GHN CS AI (phần mềm hỗ trợ chăm sóc khách hàng).
Nhiệm vụ của bạn là phân loại phản hồi từ các team CS B2C, CS C2C và Telesales.

<knowledge_base>
{kb_context}
</knowledge_base>

QUY TẮC PHÂN LOẠI:
- "bug": Tính năng hoặc quy trình ĐÃ CÓ trong knowledge base nhưng đang hoạt động sai/không đúng kỳ vọng.
- "feature_request": Yêu cầu chức năng CHƯA CÓ trong knowledge base, là điều mới hoàn toàn.
- "unclear": Không đủ thông tin để phân loại.

NHẬN DIỆN TEAM:
- "cs_b2c": Liên quan đến khách hàng cá nhân, giao hàng B2C, shipper, người nhận.
- "cs_c2c": Liên quan đến giao dịch C2C, người gửi cá nhân.
- "telesales": Liên quan đến bán hàng qua điện thoại, tư vấn khách hàng doanh nghiệp.
- "unknown": Không xác định được team.

PHÂN TÍCH NGUYÊN NHÂN GỐC RỄ:
- Tham chiếu các ticket/entry trong knowledge base có liên quan
- Nhóm theo loại vấn đề (UI, logic nghiệp vụ, tích hợp hệ thống, hiệu năng)
- Nêu rõ entry KB nào liên quan bằng tiêu đề và ref nếu có

ĐÁNH GIÁ MỨC ĐỘ ẢNH HƯỞNG ĐẾN KHÁCH HÀNG (CSAT score 1–10):
- 1–3: Ít khách hàng bị ảnh hưởng, có workaround dễ dàng
- 4–6: Một số khách hàng bị ảnh hưởng, trải nghiệm giảm nhưng vẫn dùng được
- 7–8: Nhiều khách hàng bị ảnh hưởng đáng kể, khó có workaround
- 9–10: Ảnh hưởng nghiêm trọng, khách hàng không thể sử dụng dịch vụ

Trả lời ONLY bằng JSON hợp lệ theo đúng định dạng sau:
{{
  "type": "bug" | "feature_request" | "unclear",
  "team": "cs_b2c" | "cs_c2c" | "telesales" | "unknown",
  "confidence": 0.0-1.0,
  "priority": "low" | "medium" | "high" | "critical",
  "title": "tiêu đề ngắn tối đa 100 ký tự",
  "description": "mô tả chi tiết vấn đề bằng tiếng Việt",
  "csat_score": 1-10,
  "root_cause_suggestion": "phân tích nguyên nhân gốc rễ, tham chiếu KB nếu có, hoặc null",
  "kb_references": ["Tiêu đề KB entry liên quan 1", "Tiêu đề KB entry liên quan 2"],
  "follow_up_question": "một câu hỏi cụ thể bằng tiếng Việt nếu cần làm rõ, hoặc null"
}}"""


async def classify_image(
    image_bytes: bytes,
    mime_type: str,
    kb_entries: list[KBEntry],
    text_context: str = "",
) -> dict:
    b64 = base64.standard_b64encode(image_bytes).decode()
    data_url = f"data:{mime_type};base64,{b64}"

    content = []
    if text_context:
        content.append({"type": "text", "text": f"Tin nhắn của người dùng: {text_context}\n\nẢnh chụp màn hình:"})
    else:
        content.append({"type": "text", "text": "Phân tích ảnh chụp màn hình này:"})

    content.append({
        "type": "image_url",
        "image_url": {"url": data_url, "detail": "high"},
    })
    content.append({"type": "text", "text": "Phân loại phản hồi này và trả lời bằng JSON."})

    response = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": CLASSIFY_SYSTEM.format(kb_context=_kb_context(kb_entries))},
            {"role": "user", "content": content},
        ],
    )
    raw = response.choices[0].message.content
    result = _parse_json_response(raw)
    result["_raw"] = raw
    return result


async def classify_with_context(
    original_text: str,
    original_image_url: Optional[str],
    replies: list[str],
    kb_entries: list[KBEntry],
) -> dict:
    user_text = f"Tin nhắn gốc: {original_text}"
    if original_image_url:
        user_text += f"\n\nLink ảnh: {original_image_url}"
    if replies:
        user_text += "\n\nCâu trả lời bổ sung:\n" + "\n".join(f"- {r}" for r in replies)
    user_text += "\n\nPhân loại phản hồi này và trả lời bằng JSON."

    response = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=1024,
        messages=[
            {"role": "system", "content": CLASSIFY_SYSTEM.format(kb_context=_kb_context(kb_entries))},
            {"role": "user", "content": user_text},
        ],
    )
    raw = response.choices[0].message.content
    result = _parse_json_response(raw)
    result["_raw"] = raw
    return result


async def generate_feedback_title(raw_content: str) -> str:
    """Generate a short Vietnamese title (≤80 chars) summarising the feedback issue."""
    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o-mini",
            max_tokens=60,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "Bạn tóm tắt vấn đề phản hồi thành một tiêu đề ngắn bằng tiếng Việt, "
                        "tối đa 80 ký tự, không dấu chấm cuối, không viết hoa toàn bộ. "
                        "Chỉ trả về tiêu đề, không giải thích gì thêm."
                    ),
                },
                {"role": "user", "content": raw_content[:1000]},
            ],
        )
        title = response.choices[0].message.content.strip().strip('"').strip("'")
        return title[:200]
    except Exception:
        return ""


async def generate_kb_summary(raw_content: str) -> str:
    response = await get_client().chat.completions.create(
        model="gpt-4o",
        max_tokens=512,
        messages=[
            {"role": "system", "content": "Bạn là technical writer. Tóm tắt nội dung sau thành một knowledge base entry ngắn gọn, có cấu trúc. Tập trung vào các sự kiện hữu ích cho việc phân loại lỗi và phân tích nguyên nhân. Giữ dưới 300 từ. Viết bằng tiếng Việt."},
            {"role": "user", "content": raw_content},
        ],
    )
    return response.choices[0].message.content


async def generate_follow_up_question(classification: dict, round_num: int) -> str:
    if classification.get("follow_up_question"):
        return classification["follow_up_question"]
    if classification.get("type") == "bug":
        questions = [
            "Bạn có thể mô tả các bước để tái hiện lỗi này không?",
            "Kết quả mong đợi là gì và thực tế xảy ra như thế nào?",
        ]
    else:
        questions = [
            "Tính năng này sẽ giải quyết vấn đề cụ thể nào cho bạn?",
            "Bạn gặp hạn chế này thường xuyên không? Trong trường hợp nào?",
        ]
    return questions[min(round_num - 1, len(questions) - 1)]


ANALYZE_FEEDBACK_SYSTEM = """Bạn là AI phân tích feedback sản phẩm cho PM của GHN.
Phân tích feedback dựa trên mục tiêu sản phẩm và knowledge base được cung cấp.

Trả về JSON với các trường:
- root_cause: str (nguyên nhân gốc rễ, tiếng Việt, tối đa 300 ký tự)
- impact_level: "low" | "medium" | "high" (dựa trên mức độ ảnh hưởng đến product goal)
- affected_area: "ui" | "logic" | "performance" | "integration" | "other"
- kb_references: list[str] (các mục KB liên quan, trích từ kb_text nếu có)
- solution_hint: str (gợi ý giải pháp ngắn gọn, tiếng Việt)

Chỉ trả về JSON hợp lệ, không có văn bản nào khác."""

SOLUTION_DRAFT_SYSTEM = """Bạn là AI hỗ trợ PM tại GHN soạn thảo giải pháp cho feedback sản phẩm.
Dựa trên nội dung feedback và phân tích đã có, tạo một solution draft với JSON gồm các trường:
- problem_statement: str (mô tả vấn đề rõ ràng, tiếng Việt)
- proposed_solution: str (giải pháp đề xuất chi tiết, tiếng Việt)
- success_metrics: str (các chỉ số đo lường thành công, tiếng Việt)
- effort_estimate: "S" | "M" | "L" | "XL"
- open_questions: str (các câu hỏi cần làm rõ thêm, tiếng Việt)

Chỉ trả về JSON hợp lệ, không có văn bản nào khác."""


def _format_kb_for_prompt(kb_text: str) -> str:
    """Format kb_text (either JSON array or plain text) for AI prompt."""
    if not kb_text:
        return ""
    import json as _json
    try:
        entries = _json.loads(kb_text)
        if isinstance(entries, list):
            parts = []
            for e in entries:
                if isinstance(e, dict):
                    title = e.get("title", "")
                    content = e.get("content", "")
                    if title and content:
                        parts.append(f"### {title}\n{content}")
                    elif content:
                        parts.append(content)
            return "\n\n".join(parts)
    except Exception:
        pass
    # Plain text fallback
    return kb_text


async def analyze_feedback(content: str, product_name: str, kb_context: str = "", product_goal: str = "", kb_text: str = "") -> dict:
    """Analyze product feedback using GPT-4o. Returns parsed analysis dict."""
    system = ANALYZE_FEEDBACK_SYSTEM
    if product_goal:
        system = f"Mục tiêu sản phẩm: {product_goal}\n\n" + system

    user_prompt = f"Sản phẩm: {product_name}\n\nFeedback:\n{content}"
    formatted_kb = _format_kb_for_prompt(kb_text)
    if formatted_kb:
        # Limit to 20000 chars to avoid token overflow
        user_prompt += f"\n\nKnowledge Base:\n{formatted_kb[:20000]}"
    elif kb_context:
        user_prompt += f"\n\nContext KB:\n{kb_context}"

    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = response.choices[0].message.content
        result = _parse_json_response(raw)
        return result
    except Exception as e:
        return {
            "root_cause": None,
            "impact_level": "medium",
            "affected_area": "other",
            "kb_references": [],
            "solution_hint": "",
            "error": str(e),
        }


async def analyze_feedback_with_image(
    content: str,
    image_bytes: bytes,
    mime_type: str,
    product_name: str,
    product_goal: str = "",
    kb_text: str = "",
) -> dict:
    """Analyze feedback with an attached image using GPT-4o vision."""
    b64 = base64.standard_b64encode(image_bytes).decode()
    data_url = f"data:{mime_type};base64,{b64}"

    system = ANALYZE_FEEDBACK_SYSTEM
    if product_goal:
        system = f"Mục tiêu sản phẩm: {product_goal}\n\n" + system

    parts = []
    text_part = f"Sản phẩm: {product_name}\n\nFeedback: {content}"
    formatted_kb = _format_kb_for_prompt(kb_text)
    if formatted_kb:
        # Limit to 20000 chars to avoid token overflow
        text_part += f"\n\nKnowledge Base:\n{formatted_kb[:20000]}"
    parts.append({"type": "text", "text": text_part})
    parts.append({"type": "image_url", "image_url": {"url": data_url, "detail": "high"}})
    parts.append({"type": "text", "text": "Phân tích feedback và ảnh này, trả về JSON."})

    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": parts},
            ],
        )
        raw = response.choices[0].message.content
        return _parse_json_response(raw)
    except Exception as e:
        return {
            "root_cause": None,
            "impact_level": "medium",
            "affected_area": "other",
            "kb_references": [],
            "solution_hint": "",
            "error": str(e),
        }


EXTRACT_ACTION_ITEMS_SYSTEM = """Bạn là AI hỗ trợ PM. Từ notes cuộc họp sau, extract tất cả action items.
Trả về JSON array, mỗi item có:
- title: str (mô tả task ngắn gọn, tiếng Việt)
- assignee: str | null (tên người được assign nếu có)
- deadline: str | null (ISO date YYYY-MM-DD nếu mention, else null)

Chỉ trả về JSON array hợp lệ, không có văn bản nào khác."""


def _parse_json_array_response(text: str) -> list:
    m = re.search(r"```(?:json)?\s*(\[.*?\])\s*```", text, re.DOTALL)
    if m:
        return json.loads(m.group(1))
    m = re.search(r"\[.*\]", text, re.DOTALL)
    if m:
        return json.loads(m.group(0))
    raise ValueError(f"No JSON array found in response: {text[:200]}")


async def extract_action_items(meeting_notes: str, product_name: str) -> list[dict]:
    """Extract action items from meeting notes using GPT-4o. Returns list of dicts."""
    user_prompt = f"Sản phẩm: {product_name}\n\nNotes cuộc họp:\n{meeting_notes}"

    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[
                {"role": "system", "content": EXTRACT_ACTION_ITEMS_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = response.choices[0].message.content
        result = _parse_json_array_response(raw)
        return result if isinstance(result, list) else []
    except Exception as e:
        print(f"[extract_action_items] failed: {e}")
        return []


async def chat_with_workspace_context(
    message: str,
    prd_content: dict | None,
    tldraw_data: dict | None,
    jira_tickets: list[dict],
    solution_title: str,
) -> dict:
    """
    Returns structured action:
    {
      "action": "update_prd" | "create_jira_ticket" | "update_canvas" | "reply_only",
      "prd_patch": {"section_id": str | null, "new_content": str} | None,
      "jira_ticket": {"title": str, "description": str, "type": str} | None,
      "canvas_patch": {"shape_id": str, "label": str} | None,
      "message": str
    }
    """
    context_parts = [f"Solution: {solution_title}"]
    if prd_content:
        context_parts.append(f"PRD (Tiptap JSON): {json.dumps(prd_content)[:2000]}")
    if tldraw_data:
        context_parts.append(f"Canvas shapes: {json.dumps(tldraw_data)[:1000]}")
    if jira_tickets:
        ticket_summary = ", ".join(
            f"{t['key']}: {t['title']} ({t['status']})" for t in jira_tickets[:10]
        )
        context_parts.append(f"Jira tickets: {ticket_summary}")

    system_prompt = """You are a PM assistant helping manage product solutions.
You have access to a PRD document, canvas diagram, and Jira tickets.
When the user asks you to update something, return a structured JSON action.

Respond ONLY with valid JSON in this format:
{
  "action": "update_prd" | "create_jira_ticket" | "update_canvas" | "reply_only",
  "prd_patch": {"section_id": "string or null", "new_content": "the new text content"} or null,
  "jira_ticket": {"title": "...", "description": "...", "type": "Task"} or null,
  "canvas_patch": {"shape_id": "...", "label": "..."} or null,
  "message": "Human-readable confirmation message in Vietnamese"
}"""

    response = await get_client().chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": "\n".join(context_parts) + f"\n\nUser request: {message}",
            },
        ],
        temperature=0.3,
    )
    return _parse_json_response(response.choices[0].message.content)


GENERATE_SOLUTION_HINT_SYSTEM = """Bạn là AI hỗ trợ PM tại GHN đề xuất hướng giải quyết cho feedback sản phẩm.
Dựa trên thông tin feedback và phân tích, đề xuất hướng giải quyết ngắn gọn, thực tế, bằng tiếng Việt.
Tối đa 300 ký tự. Chỉ trả về nội dung hướng giải quyết, không giải thích thêm."""

GENERATE_AC_SYSTEM = """Bạn là AI hỗ trợ PM tại GHN viết Acceptance Criteria (AC) cho Jira ticket.
Dựa trên hướng giải quyết được cung cấp, tạo danh sách AC rõ ràng, kiểm thử được, bằng tiếng Việt.
Định dạng: mỗi AC một dòng bắt đầu bằng "- ".
Tối đa 5 AC. Chỉ trả về danh sách AC, không giải thích thêm."""


async def generate_solution_hint(
    raw_content: str,
    root_cause: Optional[str],
    impact_level: Optional[str],
    affected_area: Optional[str],
    product_name: str = "",
    product_goal: str = "",
) -> str:
    """Generate solution hint using GPT-4o. Returns plain text."""
    system = GENERATE_SOLUTION_HINT_SYSTEM
    if product_goal:
        system = f"Mục tiêu sản phẩm: {product_goal}\n\n" + system
    user_prompt = f"Sản phẩm: {product_name}\n\nFeedback: {raw_content}\n\nNguyên nhân: {root_cause or 'chưa xác định'}\nMức độ: {impact_level or 'medium'}\nKhu vực: {affected_area or 'other'}"
    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=256,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception:
        raise


async def generate_acceptance_criteria(solution_hint: str) -> str:
    """Generate acceptance criteria from solution hint using GPT-4o. Returns plain text list."""
    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=512,
            messages=[
                {"role": "system", "content": GENERATE_AC_SYSTEM},
                {"role": "user", "content": f"Hướng giải quyết: {solution_hint}"},
            ],
        )
        return response.choices[0].message.content.strip()
    except Exception:
        raise


async def chat_with_document_context(
    active_doc_path: str,
    active_doc_content: str,
    tagged_docs: list[dict],  # [{"path": str, "content": str}]
    message: str,
) -> dict:
    """Chat with AI about documents. Returns {"reply": str, "actions": [...]}."""
    context_parts = [f"--- {active_doc_path} ---\n{active_doc_content}"]
    for d in tagged_docs:
        context_parts.append(f"--- {d['path']} ---\n{d['content']}")
    context = "\n\n".join(context_parts)

    system = (
        "Bạn là AI assistant giúp quản lý tài liệu sản phẩm của GHN CS team.\n"
        "Bạn có thể đọc và cập nhật tài liệu markdown.\n"
        "Nếu user yêu cầu cập nhật tài liệu, trả về JSON với cấu trúc sau:\n"
        '{\"reply\": \"<giải thích ngắn>\", \"actions\": [{\"type\": \"update_document\", \"document_path\": \"<path>\", \"new_content\": \"<full markdown content>\"}]}\n'
        "Nếu không cần cập nhật tài liệu, trả về:\n"
        '{\"reply\": \"<câu trả lời>\", \"actions\": []}\n'
        "Luôn trả về JSON hợp lệ. KHÔNG bao bọc trong markdown code block."
    )

    user_prompt = f"Tài liệu hiện tại:\n{context[:30000]}\n\nUser: {message}"

    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=4096,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = response.choices[0].message.content or ""
        parsed = _parse_json_response(raw)
        return {
            "reply": parsed.get("reply", raw),
            "actions": parsed.get("actions", []),
        }
    except Exception as e:
        return {"reply": f"Lỗi: {e}", "actions": []}


async def generate_solution_draft(feedback_content: str, analysis: dict, product_name: str) -> dict:
    """Generate a solution draft using GPT-4o. Returns parsed draft dict."""
    user_prompt = (
        f"Sản phẩm: {product_name}\n\n"
        f"Feedback gốc:\n{feedback_content}\n\n"
        f"Phân tích:\n"
        f"- Nguyên nhân: {analysis.get('root_cause', '')}\n"
        f"- Mức độ ảnh hưởng: {analysis.get('impact_level', '')}\n"
        f"- Khu vực bị ảnh hưởng: {analysis.get('affected_area', '')}\n"
        f"- Gợi ý: {analysis.get('solution_hint', '')}"
    )

    try:
        response = await get_client().chat.completions.create(
            model="gpt-4o",
            max_tokens=1024,
            messages=[
                {"role": "system", "content": SOLUTION_DRAFT_SYSTEM},
                {"role": "user", "content": user_prompt},
            ],
        )
        raw = response.choices[0].message.content
        result = _parse_json_response(raw)
        return result
    except Exception as e:
        return {
            "problem_statement": feedback_content[:500],
            "proposed_solution": "",
            "success_metrics": "",
            "effort_estimate": "M",
            "open_questions": "",
            "error": str(e),
        }
