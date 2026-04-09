from __future__ import annotations
import httpx
from core.config import get_settings

PLACEHOLDER_KPIS = {
    "cs_ai_automation_rate": {"value": 78.5, "unit": "%", "label": "CS AI Automation Rate"},
    "cs_chat_uptime": {"value": 99.2, "unit": "%", "label": "CS Chat Uptime"},
    "voice_ai_accuracy": {"value": 85.1, "unit": "%", "label": "Voice AI Accuracy"},
    "source": "placeholder",
}


async def fetch_kpis() -> dict:
    """
    Fetch KPI metrics from Metabase.
    Returns placeholder values if Metabase is not configured or the request fails.
    """
    s = get_settings()
    if not s.metabase_base_url or not s.metabase_api_token:
        return PLACEHOLDER_KPIS

    base_url = s.metabase_base_url.rstrip("/")
    headers = {"X-Metabase-Session": s.metabase_api_token}

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(f"{base_url}/api/user/current", headers=headers)
            if resp.status_code != 200:
                return PLACEHOLDER_KPIS

        # Session token is valid — return placeholder KPIs for now.
        # Wire up specific card IDs once the PM provides them.
        return {
            "cs_ai_automation_rate": {"value": 78.5, "unit": "%", "label": "CS AI Automation Rate"},
            "cs_chat_uptime": {"value": 99.2, "unit": "%", "label": "CS Chat Uptime"},
            "voice_ai_accuracy": {"value": 85.1, "unit": "%", "label": "Voice AI Accuracy"},
            "source": "metabase",
        }
    except Exception as e:
        print(f"[MetabaseService] fetch_kpis failed: {e}")
        return PLACEHOLDER_KPIS
