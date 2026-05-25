from __future__ import annotations
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
import io

from core.database import get_db
from models.feedback import Feedback
from models.feedback_analysis import FeedbackAnalysis
from models.product import Product
from models.priority_config import PriorityConfig
from models.document import ProductDocument
from models.base import gen_uuid
from pydantic import BaseModel
from schemas.feedback import FeedbackOut, FeedbackCreate, FeedbackUpdate, AnalysisUpdate, CreateJiraBody
from services import ai_service
from services import gsheet_service

router = APIRouter(prefix="/feedbacks", tags=["feedbacks"])


def _fb_out(feedback: Feedback, *, for_list: bool = False) -> dict:
    d = FeedbackOut.model_validate(feedback).model_dump()
    d["sprint_name"] = feedback.sprint.name if feedback.sprint else None
    if for_list:
        d["analysis"] = None
        content = d.get("raw_content") or ""
        if len(content) > 400:
            d["raw_content"] = content[:400]
    return d


def _production_deadline_from_sprint(sprint) -> Optional[str]:
    """YYYY-MM-DD from 'Thông báo Production' meeting, if scheduled."""
    if not sprint or not getattr(sprint, "meetings", None):
        return None
    for m in sprint.meetings:
        if "Thông báo Production" in (m.name or "") and m.scheduled_at:
            return m.scheduled_at.date().isoformat()
    return None

# ── Type keywords ────────────────────────────────────────────────────────────

_BUG_KEYWORDS = [
    "bug", "lỗi", "loi", "error", "crash", "broken", "sập", "không hoạt động",
    "không chạy", "không load", "fail", "failed", "issue", "problem", "defect",
]
_FEATURE_KEYWORDS = [
    "feature", "tính năng", "tinh nang", "thêm", "them", "cải thiện", "cai thien",
    "improve", "improvement", "enhancement", "request", "yêu cầu", "yeu cau",
    "đề xuất", "de xuat", "mong muốn", "wish",
]


def _classify_type(content: str) -> str:
    text = content.lower()
    if any(kw in text for kw in _BUG_KEYWORDS):
        return "bug"
    if any(kw in text for kw in _FEATURE_KEYWORDS):
        return "feature"
    return "unclear"


# ── Priority helpers ─────────────────────────────────────────────────────────

def _impact_to_score(impact_level: Optional[str]) -> Optional[int]:
    """Convert impact_level string to numeric score 1-10."""
    return {"high": 8, "medium": 5, "low": 2}.get(impact_level or "", None)


async def _get_weights(db: AsyncSession) -> tuple[float, float, float]:
    """Return (user_w, ai_w, tech_w) from DB config, falling back to defaults."""
    cfg = await db.get(PriorityConfig, "default")
    if cfg:
        return cfg.user_rating_weight, cfg.po_rating_weight, cfg.dev_rating_weight
    return 0.4, 0.4, 0.2


def _compute_priority_score(
    user_priority: Optional[int],
    tu_danh_gia: Optional[int],
    tech_rating: Optional[int],
    weights: tuple[float, float, float],
) -> Optional[float]:
    """
    Weighted average of available scores (skip None values).
    All inputs on scale 1-10. tech_rating: higher = easier (positive contribution).
    """
    user_w, ai_w, tech_w = weights
    named = [
        (user_w, user_priority),
        (ai_w, tu_danh_gia),
        (tech_w, tech_rating),
    ]
    available = [(w, v) for w, v in named if v is not None]
    if not available:
        return None
    total_w = sum(w for w, _ in available)
    weighted_sum = sum(w * v for w, v in available)
    return round(weighted_sum / total_w, 1)


# ── Analysis pipeline ────────────────────────────────────────────────────────

async def _run_analysis_pipeline(db: AsyncSession, feedback: Feedback) -> Feedback:
    feedback.status = "analyzing"
    await db.flush()

    product_name = product_goal = kb_text = ""
    root_cause_prompt = solution_hint_prompt = None
    if feedback.product_id:
        product = await db.get(Product, feedback.product_id)
        if product:
            product_name = product.name
            product_goal = product.product_goal or ""
            root_cause_prompt = product.root_cause_prompt or None
            solution_hint_prompt = product.solution_hint_prompt or None
            # Use product_documents as KB context (fallback to product.kb_text)
            docs_result = await db.execute(
                select(ProductDocument).where(ProductDocument.product_id == feedback.product_id).order_by(ProductDocument.path)
            )
            docs = docs_result.scalars().all()
            if docs:
                kb_text = "\n\n".join(
                    f"# {d.title}\n{d.content}" for d in docs if d.content
                )
            else:
                kb_text = product.kb_text or ""

    try:
        analysis_data = await ai_service.analyze_feedback(
            content=feedback.raw_content,
            product_name=product_name,
            product_goal=product_goal,
            kb_text=kb_text,
            root_cause_prompt=root_cause_prompt,
            solution_hint_prompt=solution_hint_prompt,
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

    existing_result = await db.execute(
        select(FeedbackAnalysis).where(FeedbackAnalysis.feedback_id == feedback.id)
    )
    existing_analysis = existing_result.scalar_one_or_none()

    if existing_analysis:
        existing_analysis.root_cause = analysis_data.get("root_cause")
        existing_analysis.impact_level = analysis_data.get("impact_level")
        existing_analysis.affected_area = analysis_data.get("affected_area")
        existing_analysis.kb_references = analysis_data.get("kb_references", [])
        existing_analysis.ai_raw = analysis_data
    else:
        db.add(FeedbackAnalysis(
            id=gen_uuid(),
            feedback_id=feedback.id,
            root_cause=analysis_data.get("root_cause"),
            impact_level=analysis_data.get("impact_level"),
            affected_area=analysis_data.get("affected_area"),
            kb_references=analysis_data.get("kb_references", []),
            ai_raw=analysis_data,
        ))

    feedback.status = "analyzed"
    await db.flush()

    tu_danh_gia = _impact_to_score(analysis_data.get("impact_level"))
    feedback.tu_danh_gia = tu_danh_gia

    weights = await _get_weights(db)
    feedback.priority_score = _compute_priority_score(
        feedback.user_priority, tu_danh_gia, feedback.tech_rating, weights
    )
    await db.flush()

    try:
        from models.solution_draft import SolutionDraft  # noqa: F401

        draft_data = await ai_service.generate_solution_draft(
            feedback_content=feedback.raw_content,
            analysis=analysis_data,
            product_name=product_name,
        )
        db.add(SolutionDraft(
            id=gen_uuid(),
            feedback_id=feedback.id,
            product_id=feedback.product_id,
            problem_statement=draft_data.get("problem_statement", ""),
            proposed_solution=draft_data.get("proposed_solution", ""),
            success_metrics=draft_data.get("success_metrics", ""),
            effort_estimate=draft_data.get("effort_estimate", "M"),
            open_questions=draft_data.get("open_questions", ""),
            status="draft",
        ))
        feedback.status = "solution_drafted"
        await db.flush()
    except ImportError:
        pass
    except Exception as e:
        print(f"[FeedbackPipeline] generate_solution_draft failed: {e}")

    return feedback


async def _background_analyze(feedback_id: str) -> None:
    """Run full analysis pipeline in a background task after creation."""
    from core.database import AsyncSessionLocal
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Feedback)
            .options(selectinload(Feedback.analysis), selectinload(Feedback.sprint))
            .where(Feedback.id == feedback_id)
        )
        feedback = result.scalar_one_or_none()
        if feedback and feedback.status == "new":
            await _run_analysis_pipeline(db, feedback)
            await db.commit()


# ── Routes ───────────────────────────────────────────────────────────────────

@router.get("")
async def list_feedbacks(
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    feedback_type: Optional[str] = None,
    team: Optional[str] = None,
    db: AsyncSession = Depends(get_db),
):
    query = select(Feedback).options(selectinload(Feedback.sprint))
    if product_id:
        query = query.where(Feedback.product_id == product_id)
    if status:
        query = query.where(Feedback.status == status)
    if feedback_type:
        query = query.where(Feedback.feedback_type == feedback_type)
    if team:
        query = query.where(Feedback.team == team)
    query = query.order_by(Feedback.created_at.desc())
    result = await db.execute(query)
    feedbacks = result.scalars().all()
    return [_fb_out(f, for_list=True) for f in feedbacks]


@router.post("", status_code=201)
async def create_feedback(
    body: FeedbackCreate,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    product = await db.get(Product, body.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    title = await ai_service.generate_feedback_title(body.raw_content)

    feedback = Feedback(
        id=gen_uuid(),
        product_id=body.product_id,
        title=title or None,
        raw_content=body.raw_content,
        media_urls=body.media_urls,
        submitted_by=body.submitted_by,
        source="manual",
        status="new",
        feedback_type=_classify_type(body.raw_content),
    )
    db.add(feedback)
    await db.flush()
    await db.commit()

    # Auto-trigger AI analysis in background
    background_tasks.add_task(_background_analyze, feedback.id)

    return {"id": feedback.id, "status": feedback.status, "feedback_type": feedback.feedback_type}


@router.get("/export")
async def export_feedbacks_proxy(
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    feedback_type: Optional[str] = None,
    fields: str = "basic,content,ratings",
    db: AsyncSession = Depends(get_db),
):
    """Proxy to the real export handler — defined here to take priority over /{feedback_id}."""
    return await _export_feedbacks(product_id, status, feedback_type, fields, db)


@router.get("/{feedback_id}")
async def get_feedback(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.analysis), selectinload(Feedback.sprint))
        .where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    return _fb_out(feedback)


@router.post("/{feedback_id}/analyze")
async def analyze_feedback(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.analysis), selectinload(Feedback.sprint))
        .where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")

    feedback = await _run_analysis_pipeline(db, feedback)
    await db.commit()

    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.analysis), selectinload(Feedback.sprint))
        .where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return _fb_out(feedback)


class ImportSheetBody(BaseModel):
    sheet_url: str
    product_id: str
    team: Optional[str] = None  # "B2C" | "TEL" | "C2C"
    sheet_type: str = "b2c_bug"  # only "b2c_bug" supported for now


class RateBody(BaseModel):
    user_priority: Optional[int] = None   # User rating 1-10
    user_priority_note: Optional[str] = None
    tu_danh_gia: Optional[int] = None     # PO rating 1-10
    tu_danh_gia_note: Optional[str] = None
    tech_rating: Optional[int] = None     # Dev rating 1-10 (1=lowest effort)
    tech_rating_note: Optional[str] = None


@router.patch("/{feedback_id}/rate")
async def rate_feedback(
    feedback_id: str,
    body: RateBody,
    db: AsyncSession = Depends(get_db),
):
    """Allow any user to set/update ratings and recompute priority score."""
    result = await db.execute(
        select(Feedback).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")

    if body.user_priority is not None:
        if not (1 <= body.user_priority <= 10):
            raise HTTPException(400, "user_priority phải từ 1-10")
        feedback.user_priority = body.user_priority
    if body.user_priority_note is not None:
        feedback.user_priority_note = body.user_priority_note
    if body.tu_danh_gia is not None:
        if not (1 <= body.tu_danh_gia <= 10):
            raise HTTPException(400, "tu_danh_gia phải từ 1-10")
        feedback.tu_danh_gia = body.tu_danh_gia
    if body.tu_danh_gia_note is not None:
        feedback.tu_danh_gia_note = body.tu_danh_gia_note
    if body.tech_rating is not None:
        if not (1 <= body.tech_rating <= 10):
            raise HTTPException(400, "tech_rating phải từ 1-10")
        feedback.tech_rating = body.tech_rating
    if body.tech_rating_note is not None:
        feedback.tech_rating_note = body.tech_rating_note

    weights = await _get_weights(db)
    feedback.priority_score = _compute_priority_score(
        feedback.user_priority, feedback.tu_danh_gia, feedback.tech_rating, weights
    )
    await db.commit()

    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return _fb_out(feedback)


async def _export_feedbacks(
    product_id: Optional[str] = None,
    status: Optional[str] = None,
    feedback_type: Optional[str] = None,
    fields: str = "basic,content,ratings",
    db: AsyncSession = None,
):
    """Export feedbacks to Excel. fields groups: basic,content,analysis,ratings,solution"""
    try:
        import openpyxl
    except ImportError:
        raise HTTPException(500, "openpyxl not installed")

    query = (
        select(Feedback)
        .options(selectinload(Feedback.analysis), selectinload(Feedback.product))
    )
    if product_id:
        query = query.where(Feedback.product_id == product_id)
    if status:
        query = query.where(Feedback.status == status)
    if feedback_type:
        query = query.where(Feedback.feedback_type == feedback_type)
    query = query.order_by(Feedback.created_at.desc())
    result = await db.execute(query)
    feedbacks = result.scalars().all()

    field_groups = {g.strip() for g in fields.split(",")}

    # Build column list
    columns: list[tuple[str, callable]] = []

    if "basic" in field_groups:
        columns += [
            ("ID", lambda f: f.id),
            ("Ngày tạo", lambda f: f.created_at.strftime("%d/%m/%Y %H:%M") if f.created_at else ""),
            ("Sản phẩm", lambda f: f.product.name if f.product else ""),
            ("Nguồn", lambda f: f.source or ""),
            ("Loại", lambda f: f.feedback_type or ""),
            ("Trạng thái", lambda f: f.status or ""),
        ]
    if "content" in field_groups:
        columns += [
            ("Nội dung feedback", lambda f: f.raw_content or ""),
            ("Người gửi", lambda f: f.submitted_by or ""),
        ]
    if "ratings" in field_groups:
        columns += [
            ("User Rating (1-10)", lambda f: f.user_priority if f.user_priority is not None else ""),
            ("PO Rating (1-10)", lambda f: f.tu_danh_gia if f.tu_danh_gia is not None else ""),
            ("Dev Rating/Effort (1-10)", lambda f: f.tech_rating if f.tech_rating is not None else ""),
            ("Priority Score", lambda f: f.priority_score if f.priority_score is not None else ""),
        ]
    if "analysis" in field_groups:
        columns += [
            ("Nguyên nhân gốc rễ", lambda f: (f.analysis.root_cause or "") if f.analysis else ""),
            ("Mức độ ảnh hưởng", lambda f: (f.analysis.impact_level or "") if f.analysis else ""),
            ("Khu vực ảnh hưởng", lambda f: (f.analysis.affected_area or "") if f.analysis else ""),
            ("KB tham chiếu", lambda f: ", ".join(f.analysis.kb_references or []) if f.analysis else ""),
        ]
    if "solution" in field_groups:
        from models.solution_draft import SolutionDraft
        # Fetch solution drafts for these feedback IDs
        fb_ids = [f.id for f in feedbacks]
        sol_result = await db.execute(
            select(SolutionDraft).where(SolutionDraft.feedback_id.in_(fb_ids))
        )
        sol_map: dict[str, SolutionDraft] = {s.feedback_id: s for s in sol_result.scalars().all()}
        columns += [
            ("Solution ID", lambda f: sol_map.get(f.id, None) and sol_map[f.id].id or ""),
            ("Solution Status", lambda f: sol_map.get(f.id, None) and sol_map[f.id].status or ""),
            ("Problem Statement", lambda f: sol_map.get(f.id, None) and (sol_map[f.id].problem_statement or "") or ""),
        ]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Feedbacks"

    # Header row
    header_font = openpyxl.styles.Font(bold=True)
    header_fill = openpyxl.styles.PatternFill("solid", fgColor="E8F0FE")
    for col_idx, (header, _) in enumerate(columns, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill

    # Data rows
    for row_idx, fb in enumerate(feedbacks, 2):
        for col_idx, (_, getter) in enumerate(columns, 1):
            try:
                ws.cell(row=row_idx, column=col_idx, value=getter(fb))
            except Exception:
                ws.cell(row=row_idx, column=col_idx, value="")

    # Auto column width
    for col in ws.columns:
        max_len = max((len(str(cell.value or "")) for cell in col), default=10)
        ws.column_dimensions[col[0].column_letter].width = min(max_len + 4, 60)

    buf = io.BytesIO()
    wb.save(buf)
    buf.seek(0)

    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=feedbacks.xlsx"},
    )


@router.post("/sync-sheet")
async def sync_sheet(
    product_id: str,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
):
    """
    Sync feedback from the product's Google Sheet.
    Deduplicates by gsheet_row_index. Auto-classifies type. Queues AI analysis.
    """
    product = await db.get(Product, product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    sheet_url = product.google_sheet_url
    if not sheet_url:
        raise HTTPException(400, "Product has no google_sheet_url configured")

    try:
        rows = await gsheet_service.fetch_sheet_rows(sheet_url)
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch sheet: {e}")

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
    new_ids = []

    for row in rows:
        if row["row_index"] in existing_indices:
            skipped += 1
            continue

        row_title = await ai_service.generate_feedback_title(row["content"])
        feedback = Feedback(
            id=gen_uuid(),
            product_id=product_id,
            title=row_title or None,
            raw_content=row["content"],
            submitted_by="gsheet",
            source="gsheet",
            status="new",
            gsheet_row_index=row["row_index"],
            user_priority=row["user_priority"],
            tech_rating=row["tech_rating"],
            feedback_type=_classify_type(row["content"]),
        )
        db.add(feedback)
        await db.flush()
        new_ids.append(feedback.id)
        imported += 1

    await db.commit()

    for fid in new_ids:
        background_tasks.add_task(_background_analyze, fid)

    return {"imported": imported, "skipped": skipped, "total_rows": len(rows)}


@router.post("/import-sheet")
async def import_from_sheet(body: ImportSheetBody, db: AsyncSession = Depends(get_db)):
    """
    Import feedbacks from a B2C bug tracking Google Sheet.
    Parses all 18 columns, creates FeedbackAnalysis records where available.
    Does not deduplicate — intended for one-time or manual imports.
    """
    if body.sheet_type != "b2c_bug":
        raise HTTPException(400, "Only sheet_type='b2c_bug' is supported")

    product = await db.get(Product, body.product_id)
    if not product:
        raise HTTPException(404, "Product not found")

    try:
        rows = await gsheet_service.fetch_b2c_bug_rows(body.sheet_url)
    except Exception as e:
        raise HTTPException(502, f"Failed to fetch sheet: {e}")

    if not rows:
        return {"inserted": 0, "skipped": 0, "message": "Sheet trống hoặc không có dữ liệu"}

    inserted = 0
    for row in rows:
        fb = Feedback(
            id=gen_uuid(),
            product_id=body.product_id,
            raw_content=row["raw_content"],
            media_urls=row.get("media_urls"),
            submitted_by=row.get("submitted_by"),
            source="manual",
            team=body.team,
            feedback_type=row.get("feedback_type", "unclear"),
            status=row.get("status", "draft"),
            deadline=row.get("deadline"),
            priority_score=row.get("priority_score"),
            tu_danh_gia=row.get("tu_danh_gia"),
            tu_danh_gia_note=row.get("tu_danh_gia_note"),
            user_priority=row.get("user_priority"),
            user_priority_note=row.get("user_priority_note"),
            tech_rating=row.get("tech_rating"),
        )
        raw_dt = row.get("created_at_raw", "")
        for fmt in ("%d/%m/%Y", "%d/%m/%y"):
            try:
                from datetime import datetime as _dt
                fb.created_at = _dt.strptime(raw_dt, fmt)
                break
            except ValueError:
                pass

        db.add(fb)

        root_cause = row.get("root_cause")
        solution_hint = row.get("solution_hint")
        if root_cause or solution_hint:
            db.add(FeedbackAnalysis(
                id=gen_uuid(),
                feedback_id=fb.id,
                root_cause=root_cause,
                solution_hint=solution_hint,
            ))

        inserted += 1

    await db.commit()
    return {"inserted": inserted, "skipped": 0}


@router.patch("/{feedback_id}")
async def update_feedback(
    feedback_id: str,
    body: FeedbackUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Edit title and/or raw_content of a feedback."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    for field in body.model_fields_set:
        setattr(feedback, field, getattr(body, field))

    if "sprint_id" in body.model_fields_set:
        if body.sprint_id:
            from models.sprint import Sprint

            sprint_result = await db.execute(
                select(Sprint)
                .options(selectinload(Sprint.meetings))
                .where(Sprint.id == body.sprint_id)
            )
            sprint = sprint_result.scalar_one_or_none()
            if sprint and "deadline" not in body.model_fields_set:
                auto_deadline = _production_deadline_from_sprint(sprint)
                if auto_deadline:
                    feedback.deadline = auto_deadline
        elif "deadline" not in body.model_fields_set:
            feedback.deadline = None

    await db.commit()
    await db.refresh(feedback)
    result = await db.execute(
        select(Feedback)
        .options(selectinload(Feedback.analysis), selectinload(Feedback.sprint))
        .where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return _fb_out(feedback)


@router.patch("/{feedback_id}/analysis")
async def update_analysis(
    feedback_id: str,
    body: AnalysisUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Edit root_cause and/or solution_hint in FeedbackAnalysis."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    if not feedback.analysis:
        raise HTTPException(404, "Analysis not found — run analyze first")
    if body.root_cause is not None:
        feedback.analysis.root_cause = body.root_cause
    if body.solution_hint is not None:
        feedback.analysis.solution_hint = body.solution_hint
    await db.commit()
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return _fb_out(feedback)


@router.post("/{feedback_id}/generate-solution")
async def generate_solution(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    """AI-generate solution_hint and save to FeedbackAnalysis."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")

    product_name = product_goal = ""
    solution_hint_prompt = None
    if feedback.product_id:
        product = await db.get(Product, feedback.product_id)
        if product:
            product_name = product.name
            product_goal = product.product_goal or ""
            solution_hint_prompt = product.solution_hint_prompt or None

    root_cause = feedback.analysis.root_cause if feedback.analysis else None
    impact_level = feedback.analysis.impact_level if feedback.analysis else None
    affected_area = feedback.analysis.affected_area if feedback.analysis else None

    try:
        hint = await ai_service.generate_solution_hint(
            raw_content=feedback.raw_content,
            root_cause=root_cause,
            impact_level=impact_level,
            affected_area=affected_area,
            product_name=product_name,
            product_goal=product_goal,
            solution_hint_prompt=solution_hint_prompt,
        )
    except Exception as e:
        raise HTTPException(502, f"AI service error: {e}")

    if feedback.analysis:
        feedback.analysis.solution_hint = hint
    else:
        db.add(FeedbackAnalysis(
            id=gen_uuid(),
            feedback_id=feedback.id,
            solution_hint=hint,
        ))

    await db.commit()
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    return _fb_out(feedback)


@router.post("/{feedback_id}/suggest-actions")
async def suggest_actions(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    """AI-suggest action items from feedback analysis. Returns list of {title, assignee}."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")

    product_name = ""
    if feedback.product_id:
        product = await db.get(Product, feedback.product_id)
        if product:
            product_name = product.name

    analysis = feedback.analysis
    actions = await ai_service.suggest_actions_from_feedback(
        feedback_content=feedback.raw_content or "",
        root_cause=analysis.root_cause if analysis else None,
        solution_hint=analysis.solution_hint if analysis else None,
        product_name=product_name,
    )
    return {"actions": actions}


@router.post("/{feedback_id}/generate-ac")
async def generate_ac(
    feedback_id: str,
    db: AsyncSession = Depends(get_db),
):
    """AI-generate acceptance criteria from solution_hint. Returns plain text, does NOT save to DB."""
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")
    solution_hint = (feedback.analysis.solution_hint if feedback.analysis else None) or ""
    if not solution_hint:
        raise HTTPException(400, "solution_hint is empty — generate solution first")
    try:
        ac = await ai_service.generate_acceptance_criteria(solution_hint)
    except Exception as e:
        raise HTTPException(502, f"AI service error: {e}")
    return {"acceptance_criteria": ac}


@router.post("/{feedback_id}/create-jira")
async def create_jira_ticket(
    feedback_id: str,
    body: CreateJiraBody,
    db: AsyncSession = Depends(get_db),
):
    """Create a Jira ticket from feedback data. Uploads attachments if requested."""
    from services import jira_service
    result = await db.execute(
        select(Feedback).options(selectinload(Feedback.analysis), selectinload(Feedback.sprint)).where(Feedback.id == feedback_id)
    )
    feedback = result.scalar_one_or_none()
    if not feedback:
        raise HTTPException(404, "Feedback not found")

    assignee_id = await jira_service.lookup_user_account_id("tunm1@ghn.vn")

    sprint_id = None
    if body.sprint_name:
        sprint_id = await jira_service.lookup_sprint_id(board_id=18, sprint_name=body.sprint_name)

    try:
        ticket = await jira_service.create_ticket_full(
            project_key="GB",
            title=body.title,
            raw_content=body.raw_content,
            root_cause=body.root_cause,
            solution_hint=body.solution_hint,
            acceptance_criteria=body.acceptance_criteria,
            assignee_account_id=assignee_id,
            epic_key=body.epic_key or "",
            sprint_id=sprint_id,
            issue_type="Story",
        )
    except ValueError as e:
        raise HTTPException(400, str(e))
    except Exception as e:
        raise HTTPException(502, f"Jira API error: {e}")

    if body.upload_attachments and feedback.media_urls:
        for url in feedback.media_urls:
            try:
                await jira_service.upload_attachment(ticket["key"], url)
            except Exception as e:
                print(f"[create_jira_ticket] attachment upload failed for {url}: {e}")

    return ticket
