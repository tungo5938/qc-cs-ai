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
