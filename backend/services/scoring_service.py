from __future__ import annotations
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from models.issue import Issue, IssuePriority
from models.scoring import ScoringConfig, TeamRaterConfig


async def get_config(db: AsyncSession) -> ScoringConfig:
    cfg = await db.get(ScoringConfig, 1)
    if cfg is None:
        cfg = ScoringConfig(id=1)
        db.add(cfg)
        await db.flush()
    return cfg


def compute_composite(
    user_rating: float | None,
    po_rating: float | None,
    csat_score: float | None,
    tech_effort: int | None,
    cfg: ScoringConfig,
) -> float | None:
    """Compute weighted composite score 0–10. Returns None if no inputs at all."""
    parts = []
    weights = []

    if user_rating is not None:
        parts.append(user_rating * cfg.user_rating_weight)
        weights.append(cfg.user_rating_weight)
    if po_rating is not None:
        parts.append(po_rating * cfg.po_rating_weight)
        weights.append(cfg.po_rating_weight)
    if csat_score is not None:
        parts.append(csat_score * cfg.csat_weight)
        weights.append(cfg.csat_weight)
    if tech_effort is not None:
        # Invert: effort 1 → score 10, effort 10 → score 1
        effort_score = (11 - tech_effort)
        parts.append(effort_score * cfg.effort_weight)
        weights.append(cfg.effort_weight)

    if not weights:
        return None

    total_weight = sum(weights)
    raw = sum(parts) / total_weight
    return round(min(max(raw, 0.0), 10.0), 2)


def score_to_priority(score: float, cfg: ScoringConfig) -> IssuePriority:
    if score >= cfg.threshold_critical:
        return IssuePriority.critical
    if score >= cfg.threshold_high:
        return IssuePriority.high
    if score >= cfg.threshold_medium:
        return IssuePriority.medium
    return IssuePriority.low


async def recalculate_issue(db: AsyncSession, issue: Issue) -> None:
    """Recompute composite_score and update priority. Flushes but does not commit."""
    cfg = await get_config(db)
    score = compute_composite(
        issue.user_rating,
        issue.po_rating,
        issue.csat_score,
        issue.tech_effort,
        cfg,
    )
    if score is not None:
        issue.composite_score = score
        issue.priority = score_to_priority(score, cfg)
        await db.flush()


async def get_team_rater(db: AsyncSession, team: str) -> str | None:
    row = await db.get(TeamRaterConfig, team)
    return row.rater_email if row else None


async def is_po(db: AsyncSession, email: str) -> bool:
    cfg = await get_config(db)
    return email.lower() in [e.lower() for e in (cfg.po_emails or [])]
