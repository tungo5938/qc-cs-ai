from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.database import get_db
from core.dependencies import require_pm_qc
from models.knowledge_base import KBEntry, KBSourceType
from models.base import gen_uuid
from schemas.knowledge_base import KBEntryOut, KBEntryCreate, KBImportGdoc, KBImportJira
from services import kb_service, jira_service

router = APIRouter(prefix="/kb", tags=["knowledge-base"])


@router.get("", response_model=list[KBEntryOut])
async def list_entries(
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    result = await db.execute(
        select(KBEntry).where(KBEntry.is_active == True).order_by(KBEntry.created_at.desc())
    )
    return result.scalars().all()


@router.post("", response_model=KBEntryOut, status_code=201)
async def create_entry(
    body: KBEntryCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    entry = KBEntry(
        id=gen_uuid(),
        source_type=KBSourceType.manual,
        source_ref=body.source_ref,
        title=body.title,
        content=body.content,
    )
    db.add(entry)
    await db.flush()
    await db.refresh(entry)
    return entry


@router.delete("/{entry_id}")
async def delete_entry(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    result = await db.execute(select(KBEntry).where(KBEntry.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(404, "Entry not found")
    entry.is_active = False
    await db.flush()
    return {"ok": True}


@router.post("/import/gdoc")
async def import_gdoc(
    body: KBImportGdoc,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    entries = await kb_service.import_from_gdoc(db, body.url, body.imported_by_email)
    if not entries:
        return {"imported": 0, "message": "Already imported or no content found"}
    return {"imported": len(entries)}


@router.post("/import/jira")
async def import_jira(
    body: KBImportJira,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    ticket_key = jira_service.extract_ticket_key(body.jira_url)
    if not ticket_key:
        raise HTTPException(400, "Cannot extract Jira ticket key from URL")
    ticket_data = await jira_service.fetch_ticket(ticket_key)
    if not ticket_data:
        raise HTTPException(404, f"Jira ticket {ticket_key} not found")
    entry = await kb_service.append_from_jira(db, ticket_data, body.imported_by_email)
    await db.refresh(entry)
    return KBEntryOut.model_validate(entry)
