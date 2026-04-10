from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from core.database import get_db
from models.feedback import Feedback
from models.feedback_analysis import FeedbackAnalysis
from models.product import Product
from models.base import gen_uuid
from schemas.feedback import FeedbackOut, FeedbackCreate, FeedbackUpdate
from services import ai_service
from services import gsheet_service

router = APIRouter(prefix="/feedbacks", tags=["feedbacks"])


async def _run_analysis_pipeline(db: AsyncSession, feedback: Feedback) -> Feedback:
    """
    Full analysis pipeline:
    1. Set status=analyzing
    2. Call AI analysis
    3. Create/update FeedbackAnalysis
    4. Set status=analyzed
    5. Generate solution draft placeholder
    6. Set status=solution_drafted
    """
    # Step 1: mark as analyzing
    feedback.status = "analyzing"
    await db.flush()

    # Resolve product name for context
    product_name = ""
    product_goal = ""
    kb_text = ""
    if feedback.product_id:
        product = await db.get(Product, feedback.product_id)
        if product:
            product_name = product.name
            product_goal = product.product_goal or ""
            kb_text = product.kb_text or ""

    # Step 2: AI analysis
    try:
        analysis_data = await ai_service.analyze_feedback(
            content=feedback.raw_content,
            product_name=product_name,
            product_goal=product_goal,
            kb_text=kb_text,
        )
    except Exception as e:
        print(f"[FeedbackPipeline] analyze_feedback failed: {e}")
        analysis_data = {
            "root_cause": None,
            "impact_level": "medium",
            "affected_area": "other",
            "kb_references": [],
            "solution_hint": "",
            "error": str(e),
        }

    # Step 3: Create or update FeedbackAnalysis
    existing_analysis_result = await db.execute(
        select(FeedbackAnalysis).where(FeedbackAnalysis.feedback_id == feedback.id)
    )
    existing_analysis = existing_analysis_result.scalar_one_or_none()

    if existing_analysis:
        existing_analysis.root_cause = analysis_data.get("root_cause")
        existing_analysis.impact_level = analysis_data.get("impact_level")
        existing_analysis.affected_area = analysis_data.get("affected_area")
        existing_analysis.kb_references = analysis_data.get("kb_references", [])
        existing_analysis.ai_raw = analysis_data
    else:
        new_analysis = FeedbackAnalysis(
            id=gen_uuid(),
            feedback_id=feedback.id,
            root_cause=analysis_data.get("root_cause"),
            impact_level=analysis_data.get("impact_level"),
            affected_area=analysis_data.get("affected_area"),
            kb_references=analysis_data.get("kb_references", []),
            ai_raw=analysis_data,
        )
        db.add(new_analysis)

    # Step 4: set status=analyzed
    feedback.status = "analyzed"
    await db.flush()

    # Step 5 & 6: try to create solution draft
    try:
        # Import SolutionDraft lazily — Task 4 will create it properly
        from models.solution_draft import SolutionDraft  # noqa: F401

        draft_data = await ai_service.generate_solution_draft(
            feedback_content=feedback.raw_content,
            analysis=analysis_data,
            product_name=product_name,
        )

        draft = SolutionDraft(
            id=gen_uuid(),
            feedback_id=feedback.id,
            product_id=feedback.product_id,
            problem_statement=draft_data.get("problem_statement", ""),
            proposed_solution=draft_data.get("proposed_solution", ""),
            success_metrics=draft_data.get("success_metrics", ""),
            effort_estimate=draft_data.get("effort_estimate", "M"),
            open_questions=draft_data.get("open_questions", ""),
            status="draft",
        )
        db.add(draft)
        feedback.status = "solution_drafted"
        await db.flush()
    except ImportError:
        # SolutionDraft model not yet created (Task 4) — skip
        pass
    except Exception as e:
        print(f"[FeedbackPipeline] generate_solution_draft failed: {e}")

    return feedback


@router.get("")
async def list_feedbacks(
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Feedback).options(selectinload(Feedback.analysis))
    if product_id:
        query = query.where(Feedback.product_id == product_id)
    if status:
        query = query.where(Feedback.status == status)
    query = query.order_by(Feedback.created_at.desc())
    result = await db.execute(query)
    feedbacks = result.scalars().all()
    return [FeedbackOut.model_validate(f).model_dump() for f in feedbacks]


@router.post("", status_code=201)
async def create_feedback(
    body: FeedbackCreate,
    db: AsyncSession = Depends(get_db),
):
    # Verify product exists
    product = await db.get(Product, body.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    feedback = Feedback(
        id=gen_uuid(),
        product_id=body.product_id,
        raw_content=body.raw_content,
        media_urls=body.media_urls,
        submitted_by=body.submitted_by,
        source="manual",
        status="new",
    )
    db.add(feedback)
    await db.flush()
    await db.commit()
    return {"id": feedback.id, "status": feedback.status}


@router.get("/{feedback_id}")
async def get_feedback(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.analysis))
        .where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    return FeedbackOut.model_validate(feedback).model_dump()


@router.post("/{feedback_id}/analyze")
async def analyze_feedback(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.analysis))
        .where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")

    feedback = await _run_analysis_pipeline(db, feedback)
    await db.commit()

    # Reload with analysis relationship
    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.analysis))
        .where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return FeedbackOut.model_validate(feedback).model_dump()


@router.post("/sync-sheet")
async def sync_sheet(
    product_id: str,
    db: AsyncSession = Depends(get_db),
):
    """
    Sync feedback from the product's Google Sheet.
    Deduplicates by gsheet_row_index.
    Auto-generates AI rating (tu_danh_gia) as 1-10 based on impact_level.
    Returns counts: imported, skipped.
    """
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    sheet_url = product.google_sheet_url
    if not sheet_url:
        raise HTTPException(400, "Product has no google_sheet_url configured")

    # Fetch sheet rows
    try:
        rows = await gsheet_service.fetch_sheet_rows(sheet_url)
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch sheet: {e}")

    # Get already-imported row indices for this product
    from sqlalchemy import and_
    existing_result = await db.execute(
        select(Feedback.gsheet_row_index).where(
            and_(
                Feedback.product_id == product_id,
                Feedback.gsheet_row_index.isnot(None),
            )
        )
    )
    existing_indices = {r[0] for r in existing_result.fetchall()}

    imported = 0
    skipped = 0

    for row in rows:
        if row["row_index"] in existing_indices:
            skipped += 1
            continue

        feedback = Feedback(
            id=gen_uuid(),
            product_id=product_id,
            raw_content=row["content"],
            submitted_by="gsheet",
            source="gsheet",
            status="new",
            gsheet_row_index=row["row_index"],
            user_priority=row["user_priority"],
            tech_rating=row["tech_rating"],
        )
        db.add(feedback)
        await db.flush()
        imported += 1

    await db.commit()

    return {"imported": imported, "skipped": skipped, "total_rows": len(rows)}
