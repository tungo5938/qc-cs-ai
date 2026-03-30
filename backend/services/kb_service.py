import re
import httpx
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from models.knowledge_base import KBEntry, KBSourceType
from models.base import gen_uuid


def _extract_gdoc_id(url: str) -> str | None:
    m = re.search(r"/d/([a-zA-Z0-9_-]+)", url)
    return m.group(1) if m else None


async def import_from_gdoc(db: AsyncSession, url: str, imported_by: str | None = None) -> list[KBEntry]:
    """One-time import from a public Google Doc. Skips if already imported."""
    existing = await db.scalar(select(KBEntry).where(KBEntry.source_ref == url, KBEntry.is_active == True))
    if existing:
        return []

    doc_id = _extract_gdoc_id(url)
    if not doc_id:
        raise ValueError(f"Cannot extract Google Doc ID from URL: {url}")

    export_url = f"https://docs.google.com/document/d/{doc_id}/export?format=txt"
    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as client:
        resp = await client.get(export_url)
        resp.raise_for_status()
        raw_text = resp.text

    chunks = _split_by_headings(raw_text)
    entries = []
    for title, content in chunks:
        entry = KBEntry(
            id=gen_uuid(),
            source_type=KBSourceType.google_doc,
            source_ref=url,
            title=title,
            content=content,
            imported_by_email=imported_by,
        )
        db.add(entry)
        entries.append(entry)
    await db.flush()
    return entries


def _split_by_headings(text: str) -> list[tuple[str, str]]:
    """Split plain text into (title, body) chunks by lines that look like headings."""
    lines = text.splitlines()
    chunks: list[tuple[str, str]] = []
    current_title = "Introduction"
    current_lines: list[str] = []

    for line in lines:
        stripped = line.strip()
        if not stripped:
            current_lines.append("")
            continue
        # Heuristic: short line (<= 80 chars) with no trailing punctuation = heading
        if len(stripped) <= 80 and not stripped.endswith((".", ",", ";", ":", "?")):
            if current_lines:
                body = "\n".join(current_lines).strip()
                if body:
                    chunks.append((current_title, body))
            current_title = stripped
            current_lines = []
        else:
            current_lines.append(stripped)

    if current_lines:
        body = "\n".join(current_lines).strip()
        if body:
            chunks.append((current_title, body))

    return chunks if chunks else [("Document", text)]


async def get_relevant_entries(db: AsyncSession, query: str, limit: int = 5) -> list[KBEntry]:
    """Full-text search over kb_entries using PostgreSQL tsvector."""
    sql = text("""
        SELECT * FROM kb_entries
        WHERE is_active = true
          AND to_tsvector('english', content) @@ plainto_tsquery('english', :query)
        ORDER BY ts_rank(to_tsvector('english', content), plainto_tsquery('english', :query)) DESC
        LIMIT :limit
    """)
    result = await db.execute(sql, {"query": query, "limit": limit})
    rows = result.fetchall()
    # Re-fetch as ORM objects
    if not rows:
        # Fallback: return most recent entries
        result2 = await db.execute(
            select(KBEntry).where(KBEntry.is_active == True).order_by(KBEntry.created_at.desc()).limit(limit)
        )
        return list(result2.scalars().all())
    ids = [row[0] for row in rows]
    result3 = await db.execute(select(KBEntry).where(KBEntry.id.in_(ids)))
    return list(result3.scalars().all())


async def append_from_jira(db: AsyncSession, ticket_data: dict, imported_by: str | None = None) -> KBEntry:
    """Create a KB entry from a fetched Jira ticket."""
    content = f"Summary: {ticket_data['summary']}\n\nDescription: {ticket_data['description']}"
    entry = KBEntry(
        id=gen_uuid(),
        source_type=KBSourceType.jira_ticket,
        source_ref=ticket_data["key"],
        title=f"[{ticket_data['key']}] {ticket_data['summary']}",
        content=content,
        imported_by_email=imported_by,
    )
    db.add(entry)
    await db.flush()
    return entry
