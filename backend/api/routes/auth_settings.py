from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from core.config import get_settings
from core.database import get_db
from models.allowed_email import AllowedEmail

router = APIRouter(prefix="/auth", tags=["auth"])


def _require_admin(x_admin_email: Optional[str] = Header(None)) -> str:
    settings = get_settings()
    if not x_admin_email or x_admin_email.lower() not in settings.pm_qc_email_list:
        raise HTTPException(status_code=403, detail="Admin access required")
    return x_admin_email.lower()


@router.get("/allowed-emails/check")
async def check_email(email: str, db: AsyncSession = Depends(get_db)):
    """Called by NextAuth signIn callback to verify non-GHN emails."""
    result = await db.execute(
        select(AllowedEmail).where(AllowedEmail.email == email.lower().strip())
    )
    return {"allowed": result.scalar_one_or_none() is not None}


@router.get("/allowed-emails")
async def list_allowed(
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(_require_admin),
):
    result = await db.execute(
        select(AllowedEmail).order_by(AllowedEmail.created_at.desc())
    )
    entries = result.scalars().all()
    return [
        {"id": e.id, "email": e.email, "added_by": e.added_by, "created_at": str(e.created_at)}
        for e in entries
    ]


class AddEmailBody(BaseModel):
    email: str


@router.post("/allowed-emails", status_code=201)
async def add_allowed(
    body: AddEmailBody,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(_require_admin),
):
    email = body.email.lower().strip()
    existing = await db.execute(select(AllowedEmail).where(AllowedEmail.email == email))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already allowed")
    entry = AllowedEmail(email=email, added_by=admin_email)
    db.add(entry)
    await db.commit()
    await db.refresh(entry)
    return {"id": entry.id, "email": entry.email, "added_by": entry.added_by, "created_at": str(entry.created_at)}


@router.delete("/allowed-emails/{entry_id}")
async def remove_allowed(
    entry_id: str,
    db: AsyncSession = Depends(get_db),
    admin_email: str = Depends(_require_admin),
):
    result = await db.execute(select(AllowedEmail).where(AllowedEmail.id == entry_id))
    entry = result.scalar_one_or_none()
    if not entry:
        raise HTTPException(status_code=404, detail="Not found")
    await db.delete(entry)
    await db.commit()
    return {"deleted": True}
