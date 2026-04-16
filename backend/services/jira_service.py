from __future__ import annotations
from typing import Optional
import re
import base64
import httpx
from core.config import get_settings

JIRA_KEY_RE = re.compile(r"([A-Z][A-Z0-9]+-\d+)")
JIRA_KEY_STRICT_RE = re.compile(r'^[A-Z][A-Z0-9_]+-\d+$')


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


async def fetch_epic_tickets(epic_key: str) -> list[dict]:
    """Fetch all Jira tickets belonging to an epic."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_api_token:
        return []
    if not JIRA_KEY_STRICT_RE.match(epic_key):
        return []
    url = f"https://{settings.jira_domain}/rest/api/3/search"
    jql = f'"Epic Link" = {epic_key} OR parent = {epic_key} ORDER BY created DESC'
    async with httpx.AsyncClient() as client:
        r = await client.get(
            url,
            params={"jql": jql, "maxResults": 50, "fields": "summary,status,issuetype,assignee"},
            headers=_auth_header(),
            timeout=10,
        )
    if r.status_code != 200:
        return []
    issues = r.json().get("issues", [])
    return [
        {
            "key": i["key"],
            "title": i["fields"]["summary"],
            "status": i["fields"]["status"]["name"],
            "type": i["fields"]["issuetype"]["name"],
            "url": f"https://{settings.jira_domain}/browse/{i['key']}",
        }
        for i in issues
    ]


async def create_ticket(project_key: str, title: str, description: str, issue_type: str = "Task") -> dict:
    """Create a new Jira ticket."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_email or not settings.jira_api_token:
        raise ValueError("Jira credentials not configured")
    url = f"https://{settings.jira_domain}/rest/api/3/issue"
    payload = {
        "fields": {
            "project": {"key": project_key},
            "summary": title,
            "description": {"type": "doc", "version": 1, "content": [{"type": "paragraph", "content": [{"type": "text", "text": description}]}]},
            "issuetype": {"name": issue_type},
        }
    }
    async with httpx.AsyncClient() as client:
        r = await client.post(url, json=payload, headers=_auth_header(), timeout=10)
    r.raise_for_status()
    data = r.json()
    return {"key": data["key"], "url": f"https://{settings.jira_domain}/browse/{data['key']}"}


async def update_ticket_status(ticket_key: str, transition_name: str) -> bool:
    """Transition a Jira ticket to a new status."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_email or not settings.jira_api_token:
        return False
    async with httpx.AsyncClient() as client:
        tr = await client.get(
            f"https://{settings.jira_domain}/rest/api/3/issue/{ticket_key}/transitions",
            headers=_auth_header(), timeout=10,
        )
        if tr.status_code == 404:
            raise ValueError(f"Ticket {ticket_key} not found")
        if tr.status_code != 200:
            return False
        transitions = tr.json().get("transitions", [])
        match = next((t for t in transitions if transition_name.lower() in t["name"].lower()), None)
        if not match:
            return False
        r = await client.post(
            f"https://{settings.jira_domain}/rest/api/3/issue/{ticket_key}/transitions",
            json={"transition": {"id": match["id"]}},
            headers=_auth_header(), timeout=10,
        )
    return r.status_code == 204


def _build_adf_document(sections: list[tuple[str, str]]) -> dict:
    """Build Atlassian Document Format doc from (heading, body) tuples."""
    content = []
    for heading, body in sections:
        if not body:
            continue
        if heading:
            content.append({
                "type": "heading",
                "attrs": {"level": 2},
                "content": [{"type": "text", "text": heading}]
            })
        for paragraph in body.split("\n"):
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            content.append({
                "type": "paragraph",
                "content": [{"type": "text", "text": paragraph}]
            })
    return {"type": "doc", "version": 1, "content": content}


async def lookup_user_account_id(email: str) -> Optional[str]:
    """Lookup Jira user accountId by email. Returns None if not found."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_email or not settings.jira_api_token:
        return None
    url = f"https://{settings.jira_domain}/rest/api/3/user/search"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, params={"query": email}, headers=_auth_header())
    if r.status_code != 200:
        return None
    users = r.json()
    if not users:
        return None
    return users[0].get("accountId")


async def lookup_sprint_id(board_id: int, sprint_name: str) -> Optional[int]:
    """Lookup sprint ID by name on a board. Returns None if not found."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_api_token:
        return None
    url = f"https://{settings.jira_domain}/rest/agile/1.0/board/{board_id}/sprint"
    async with httpx.AsyncClient(timeout=10) as client:
        r = await client.get(url, params={"state": "active,future", "maxResults": 50}, headers=_auth_header())
    if r.status_code != 200:
        return None
    sprints = r.json().get("values", [])
    name_lower = sprint_name.lower()
    for sprint in sprints:
        if name_lower in sprint.get("name", "").lower():
            return sprint["id"]
    return None


async def upload_attachment(ticket_key: str, image_url: str) -> bool:
    """Download image from URL and upload as Jira attachment. Returns True on success."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_email or not settings.jira_api_token:
        return False
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            img_resp = await client.get(image_url)
            if img_resp.status_code != 200:
                return False
            content_type = img_resp.headers.get("content-type", "image/jpeg")
            filename = image_url.split("/")[-1].split("?")[0] or "attachment.jpg"
            auth_header = _auth_header()
            auth_header.pop("Content-Type", None)
            auth_header["X-Atlassian-Token"] = "no-check"
            upload_url = f"https://{settings.jira_domain}/rest/api/3/issue/{ticket_key}/attachments"
            r = await client.post(
                upload_url,
                headers=auth_header,
                files={"file": (filename, img_resp.content, content_type)},
            )
            return r.status_code == 200
    except Exception as e:
        print(f"[jira_service] upload_attachment failed: {e}")
        return False


async def create_ticket_full(
    project_key: str,
    title: str,
    raw_content: str,
    root_cause: Optional[str],
    solution_hint: Optional[str],
    acceptance_criteria: Optional[str],
    assignee_account_id: Optional[str] = None,
    epic_key: str = "",
    sprint_id: Optional[int] = None,
    issue_type: str = "Story",
) -> dict:
    """Create a Jira ticket with full ADF description, epic link, sprint, and assignee."""
    settings = get_settings()
    if not settings.jira_domain or not settings.jira_email or not settings.jira_api_token:
        raise ValueError("Jira credentials not configured")

    sections = [
        ("Nội dung gốc", raw_content or ""),
        ("Kết quả phân tích", root_cause or ""),
        ("Hướng giải quyết", solution_hint or ""),
        ("Acceptance Criteria", acceptance_criteria or ""),
    ]
    description_adf = _build_adf_document(sections)

    fields: dict = {
        "project": {"key": project_key},
        "summary": title,
        "description": description_adf,
        "issuetype": {"name": issue_type},
    }
    if epic_key:
        fields["parent"] = {"key": epic_key}
    if assignee_account_id:
        fields["assignee"] = {"accountId": assignee_account_id}
    if sprint_id:
        fields["customfield_10020"] = sprint_id

    url = f"https://{settings.jira_domain}/rest/api/3/issue"
    async with httpx.AsyncClient(timeout=15) as client:
        r = await client.post(url, json={"fields": fields}, headers=_auth_header())
    r.raise_for_status()
    data = r.json()
    return {"key": data["key"], "url": f"https://{settings.jira_domain}/browse/{data['key']}"}


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
