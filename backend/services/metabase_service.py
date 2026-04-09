from __future__ import annotations
import httpx
from core.config import get_settings

CS_CHAT_CARD_ID = 792  # GHN Chat - Hàng khách hàng: Số khách, Số mess, Số ticket

PLACEHOLDER_KPIS = {
    "cs_ai": {"label": "CS AI — Đơn tạo bởi AI", "value": None, "unit": "đơn", "source": "placeholder"},
    "cs_chat_clients": {"label": "CS Chat — Tổng khách hàng", "value": None, "unit": "KH", "source": "placeholder"},
    "cs_chat_messages": {"label": "CS Chat — Tổng tin nhắn", "value": None, "unit": "msg", "source": "placeholder"},
    "cs_chat_tickets": {"label": "CS Chat — Tổng ticket", "value": None, "unit": "ticket", "source": "placeholder"},
    "voice_ai": {"label": "Voice AI — Accuracy", "value": None, "unit": "%", "source": "placeholder"},
    "source": "placeholder",
}


async def fetch_kpis() -> dict:
    """
    Fetch KPI metrics from Metabase.
    - CS Chat: Card 792 (Nhóm, total_client, total_message, total_ticket) — aggregated totals
    - CS AI, Voice AI: placeholder until card IDs are configured
    """
    s = get_settings()
    if not s.metabase_base_url or not s.metabase_api_token:
        return PLACEHOLDER_KPIS

    base_url = s.metabase_base_url.rstrip("/")
    headers = {"X-Metabase-Session": s.metabase_api_token, "Content-Type": "application/json"}

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.post(
                f"{base_url}/api/card/{CS_CHAT_CARD_ID}/query",
                headers=headers,
                json={},
            )
            if resp.status_code not in (200, 202):
                return PLACEHOLDER_KPIS

            data = resp.json()
            rows = data.get("data", {}).get("rows", [])
            cols = [c["name"] for c in data.get("data", {}).get("cols", [])]

            # Aggregate across all groups
            idx_client = cols.index("total_client") if "total_client" in cols else None
            idx_msg = cols.index("total_message") if "total_message" in cols else None
            idx_ticket = cols.index("total_ticket") if "total_ticket" in cols else None

            total_clients = sum(r[idx_client] for r in rows) if idx_client is not None else None
            total_messages = sum(r[idx_msg] for r in rows) if idx_msg is not None else None
            total_tickets = sum(r[idx_ticket] for r in rows) if idx_ticket is not None else None

        return {
            "cs_ai": {"label": "CS AI — Đơn tạo bởi AI", "value": None, "unit": "đơn", "source": "placeholder"},
            "cs_chat_clients": {
                "label": "CS Chat — Tổng khách hàng",
                "value": total_clients,
                "unit": "KH",
                "source": "metabase",
            },
            "cs_chat_messages": {
                "label": "CS Chat — Tổng tin nhắn",
                "value": total_messages,
                "unit": "msg",
                "source": "metabase",
            },
            "cs_chat_tickets": {
                "label": "CS Chat — Tổng ticket",
                "value": total_tickets,
                "unit": "ticket",
                "source": "metabase",
            },
            "voice_ai": {"label": "Voice AI — Accuracy", "value": None, "unit": "%", "source": "placeholder"},
            "source": "metabase",
        }

    except Exception as e:
        print(f"[MetabaseService] fetch_kpis failed: {e}")
        return PLACEHOLDER_KPIS
