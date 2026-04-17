from __future__ import annotations
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
import io

from core.database import get_db
from models.product import Product
from models.base import gen_uuid
from schemas.product import ProductOut, ProductCreate, ProductUpdate

router = APIRouter(prefix="/products", tags=["products"])


@router.get("", response_model=list[ProductOut])
async def list_products(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).order_by(Product.created_at.asc()))
    return result.scalars().all()


@router.post("", response_model=ProductOut, status_code=201)
async def create_product(body: ProductCreate, db: AsyncSession = Depends(get_db)):
    product = Product(
        id=gen_uuid(),
        name=body.name,
        telegram_group_id=body.telegram_group_id,
        kb_gdoc_url=body.kb_gdoc_url,
        jira_project_key=body.jira_project_key,
        color=body.color,
        product_goal=body.product_goal,
        kb_text=body.kb_text,
        google_sheet_url=body.google_sheet_url,
    )
    db.add(product)
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{product_id}", response_model=ProductOut)
async def get_product(product_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    return product


@router.put("/{product_id}", response_model=ProductOut)
async def update_product(
    product_id: str,
    body: ProductUpdate,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    for field, val in body.model_dump(exclude_unset=True).items():
        setattr(product, field, val)
    await db.commit()
    await db.refresh(product)
    return product


@router.delete("/{product_id}", status_code=204)
async def delete_product(product_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")
    await db.delete(product)
    await db.commit()


@router.post("/{product_id}/kb-upload", response_model=ProductOut)
async def upload_kb_file(
    product_id: str,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
):
    """
    Upload a .docx, .xlsx, or .txt file and parse it into kb_text for the product.
    - .docx: extracts paragraphs and table cells as structured text
    - .xlsx: extracts title (col B) + content (col F) rows as ### Title\nContent entries
    - .txt: stored as-is
    """
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    filename = file.filename or ""
    content_bytes = await file.read()

    try:
        if filename.endswith(".txt"):
            kb_text = content_bytes.decode("utf-8", errors="replace")

        elif filename.endswith(".docx"):
            import docx as _docx
            import json as _json
            doc = _docx.Document(io.BytesIO(content_bytes))
            lines = []
            for para in doc.paragraphs:
                text = para.text.strip()
                if not text:
                    continue
                if para.style.name == "Title":
                    lines.append(f"# {text}")
                elif para.style.name.startswith("Heading"):
                    lines.append(f"## {text}")
                else:
                    lines.append(text)
            for table in doc.tables:
                for row in table.rows:
                    cells = [c.text.strip() for c in row.cells if c.text.strip()]
                    if cells:
                        lines.append(" | ".join(cells))
            # Store docx as a single entry (it's a context doc, not Q&A pairs)
            full_text = "\n".join(lines)
            kb_text = _json.dumps([{"title": "Document", "content": full_text}], ensure_ascii=False)

        elif filename.endswith(".xlsx"):
            import openpyxl as _openpyxl
            import json as _json
            wb = _openpyxl.load_workbook(io.BytesIO(content_bytes))
            ws = wb.active
            rows = list(ws.iter_rows(values_only=True))
            if not rows:
                raise HTTPException(400, "Empty spreadsheet")
            entries = []
            for row in rows[1:]:
                title = str(row[1]).strip() if row[1] else ""
                content = str(row[5]).strip() if row[5] else ""
                if title and content:
                    content = content.replace("\\n", "\n")
                    entries.append({"title": title, "content": content})
            kb_text = _json.dumps(entries, ensure_ascii=False)

        else:
            raise HTTPException(400, f"Unsupported file type: {filename}. Use .docx, .xlsx, or .txt")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(422, f"Failed to parse file: {e}")

    product.kb_text = kb_text
    await db.commit()
    await db.refresh(product)
    return product


@router.get("/{product_id}/kb-entries")
async def get_kb_entries(product_id: str, db: AsyncSession = Depends(get_db)):
    """Return kb_text parsed as JSON entries for table display."""
    import json as _json
    result = await db.execute(select(Product).where(Product.id == product_id))
    product = result.scalar_one_or_none()
    if not product:
        raise HTTPException(404, "Product not found")

    kb_text = product.kb_text or ""
    try:
        entries = _json.loads(kb_text)
        if isinstance(entries, list):
            return {"entries": entries, "format": "json", "count": len(entries)}
    except Exception:
        pass
    # Plain text fallback
    return {"entries": [{"title": "KB Text", "content": kb_text}], "format": "text", "count": 1}
