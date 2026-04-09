from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel
from typing import Optional

from core.database import get_db
from core.dependencies import require_pm_qc
from models.issue import Issue
from models.scoring import ScoringConfig, TeamRaterConfig
from services import scoring_service, ai_service, kb_service

router = APIRouter(prefix="/scoring", tags=["scoring"])


# ── Request schemas ────────────────────────────────────────────────────────────

class UserRatingRequest(BaseModel):
    rating: float          # 1–10
    rater_email: str

class PORatingRequest(BaseModel):
    rating: float          # 1–10
    po_email: str

class EffortRequest(BaseModel):
    effort: int            # 1–10
    set_by_email: str

class ScoringConfigUpdate(BaseModel):
    user_rating_weight: Optional[float] = None
    po_rating_weight: Optional[float] = None
    csat_weight: Optional[float] = None
    effort_weight: Optional[float] = None
    threshold_medium: Optional[float] = None
    threshold_high: Optional[float] = None
    threshold_critical: Optional[float] = None
    po_emails: Optional[list[str]] = None

class TeamRaterUpdate(BaseModel):
    team: str
    rater_email: str


# ── Helpers ────────────────────────────────────────────────────────────────────

async def _get_issue(db: AsyncSession, issue_id: str) -> Issue:
    issue = await db.get(Issue, issue_id)
    if not issue:
        raise HTTPException(status_code=404, detail="Issue not found")
    return issue


# ── Rating endpoints ───────────────────────────────────────────────────────────

@router.post("/{issue_id}/user-rate")
async def user_rate(issue_id: str, body: UserRatingRequest, db: AsyncSession = Depends(get_db)):
    """Designated team rater submits their 1–10 rating."""
    if not 1 <= body.rating <= 10:
        raise HTTPException(status_code=422, detail="Rating must be 1–10")
    issue = await _get_issue(db, issue_id)

    # Verify this email is the designated rater for the issue's team
    allowed = await scoring_service.get_team_rater(db, issue.team.value if issue.team else "unknown")
    if allowed and allowed.lower() != body.rater_email.lower():
        raise HTTPException(status_code=403, detail=f"Only {allowed} can rate this team's issues")

    issue.user_rating = body.rating
    issue.user_rating_by = body.rater_email
    await scoring_service.recalculate_issue(db, issue)
    await db.commit()
    return {"ok": True, "composite_score": issue.composite_score, "priority": issue.priority}


@router.post("/{issue_id}/po-rate")
async def po_rate(issue_id: str, body: PORatingRequest, db: AsyncSession = Depends(get_db)):
    """PO submits their 1–10 rating."""
    if not 1 <= body.rating <= 10:
        raise HTTPException(status_code=422, detail="Rating must be 1–10")
    if not await scoring_service.is_po(db, body.po_email):
        raise HTTPException(status_code=403, detail="Only designated POs can submit PO rating")

    issue = await _get_issue(db, issue_id)
    issue.po_rating = body.rating
    issue.po_rating_by = body.po_email
    await scoring_service.recalculate_issue(db, issue)
    await db.commit()
    return {"ok": True, "composite_score": issue.composite_score, "priority": issue.priority}


@router.post("/{issue_id}/effort")
async def set_effort(
    issue_id: str,
    body: EffortRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    """PM/QC sets tech effort (1–10, lower = less effort)."""
    if not 1 <= body.effort <= 10:
        raise HTTPException(status_code=422, detail="Effort must be 1–10")
    issue = await _get_issue(db, issue_id)
    issue.tech_effort = body.effort
    issue.effort_set_by = body.set_by_email
    await scoring_service.recalculate_issue(db, issue)
    await db.commit()
    return {"ok": True, "composite_score": issue.composite_score, "priority": issue.priority}


@router.post("/{issue_id}/recalculate-csat")
async def recalculate_csat(
    issue_id: str,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    """Re-run AI CSAT evaluation and recalculate composite score."""
    issue = await _get_issue(db, issue_id)
    kb_entries = await kb_service.get_relevant_entries(db, issue.description or issue.title, limit=5)
    classification = await ai_service.classify_with_context(
        issue.description or issue.title,
        None,
        [],
        kb_entries,
    )
    csat = classification.get("csat_score")
    if csat is not None:
        issue.csat_score = float(csat)
        await scoring_service.recalculate_issue(db, issue)
        await db.commit()
    return {"ok": True, "csat_score": issue.csat_score, "composite_score": issue.composite_score, "priority": issue.priority}


# ── Config endpoints ───────────────────────────────────────────────────────────

@router.get("/config")
async def get_config(db: AsyncSession = Depends(get_db), _: str = Depends(require_pm_qc)):
    cfg = await scoring_service.get_config(db)
    raters_result = await db.execute(select(TeamRaterConfig))
    raters = {r.team: r.rater_email for r in raters_result.scalars().all()}
    return {
        "user_rating_weight": cfg.user_rating_weight,
        "po_rating_weight": cfg.po_rating_weight,
        "csat_weight": cfg.csat_weight,
        "effort_weight": cfg.effort_weight,
        "threshold_medium": cfg.threshold_medium,
        "threshold_high": cfg.threshold_high,
        "threshold_critical": cfg.threshold_critical,
        "po_emails": cfg.po_emails,
        "team_raters": raters,
    }


@router.put("/config")
async def update_config(
    body: ScoringConfigUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    cfg = await scoring_service.get_config(db)
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(cfg, field, value)
    await db.commit()
    return {"ok": True}


@router.put("/config/team-raters")
async def update_team_rater(
    body: TeamRaterUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(require_pm_qc),
):
    row = await db.get(TeamRaterConfig, body.team)
    if row:
        row.rater_email = body.rater_email
    else:
        db.add(TeamRaterConfig(team=body.team, rater_email=body.rater_email))
    await db.commit()
    return {"ok": True}
