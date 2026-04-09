from __future__ import annotations
from typing import Optional
import re
import base64
import httpx
from core.config import get_settings

JIRA_KEY_RE = re.compile(r"([A-Z][A-Z0-9]+-\d+)")


def extract_ticket_key(jira_url: str) -> Optional[str]:
    m = JIRA_KEY_RE.search(jira_url)
    return m.group(1) if m else None


def _auth_header() -> dict:
    s = get_settings()
    token = base64.b64encode(f"{s.jira_email}:{s.jira_api_token}".encode()).decode()
    return {"Authorization": f"Basic {token}", "Content-Type": "application/json"}


async def fetch_ticket(ticket_key: str) -> Optional[dict]:
    """Fetch Jira ticket fields. Returns None if not found."""
    s = get_settings()
    if not s.jira_domain or not s.jira_email or not s.jira_api_token:
        return None
    url = f"https://{s.jira_domain}/rest/api/3/issue/{ticket_key}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers=_auth_header())
        if resp.status_code == 404:
            return None
        resp.raise_for_status()
        data = resp.json()
        fields = data.get("fields", {})
        description_raw = fields.get("description") or {}
        description_text = _extract_adf_text(description_raw)
        return {
            "key": data["key"],
            "summary": fields.get("summary", ""),
            "description": description_text,
            "status": fields.get("status", {}).get("name", ""),
            "labels": fields.get("labels", []),
        }


def _extract_adf_text(adf: dict | str) -> str:
    """Extract plain text from Atlassian Document Format (ADF) or plain string."""
    if isinstance(adf, str):
        return adf
    if not isinstance(adf, dict):
        return ""
    texts = []
    for node in adf.get("content", []):
        texts.append(_extract_adf_text(node))
    if adf.get("type") == "text":
        texts.append(adf.get("text", ""))
    return " ".join(t for t in texts if t).strip()
