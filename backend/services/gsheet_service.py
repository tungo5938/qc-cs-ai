from __future__ import annotations
import csv
import io
import re
from datetime import date, datetime
from typing import Optional
import httpx


def _to_csv_export_url(sheet_url: str) -> str:
    """Convert a regular Google Sheet URL to a CSV export URL."""
    # Match spreadsheet ID
    m = re.search(r"/spreadsheets/d/([a-zA-Z0-9_-]+)", sheet_url)
    if not m:
        return sheet_url  # not a Google Sheet URL, return as-is
    spreadsheet_id = m.group(1)
    # Extract gid if present
    gid_m = re.search(r"[#&?]gid=(\d+)", sheet_url)
    gid = gid_m.group(1) if gid_m else "0"
    return f"https://docs.google.com/spreadsheets/d/{spreadsheet_id}/export?format=csv&gid={gid}"


async def fetch_sheet_rows(sheet_url: str) -> list[dict]:
    """
    Fetch public Google Sheet as CSV and return list of row dicts.
    Accepts both editor URLs and CSV export URLs — auto-converts if needed.
    Returns rows with keys: row_index, type, content, user_priority, tu_danh_gia, tech_rating, tuan_done, trang_thai, jira, ghi_chu
    Skips header row and empty content rows.
    """
    csv_url = _to_csv_export_url(sheet_url)
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(csv_url)
        resp.raise_for_status()

    text = resp.text
    reader = csv.reader(io.StringIO(text))
    rows = list(reader)

    if not rows:
        return []

    # Skip header (row 0)
    result = []
    for i, row in enumerate(rows[1:], start=1):  # row_index is 1-based (skipping header)
        # Pad row to at least 9 columns
        while len(row) < 9:
            row.append("")

        content = row[1].strip()
        if not content:  # skip empty content rows
            continue

        def _safe_int(val: str) -> int | None:
            try:
                return int(float(val.strip())) if val.strip() else None
            except (ValueError, TypeError):
                return None

        result.append({
            "row_index": i,
            "type": row[0].strip(),
            "content": content,
            "user_priority": _safe_int(row[2]),
            "tu_danh_gia": _safe_int(row[3]),
            "tech_rating": _safe_int(row[4]),
            "tuan_done": row[5].strip() or None,
            "trang_thai": row[6].strip() or None,
            "jira": row[7].strip() or None,
            "ghi_chu": row[8].strip() or None,
        })

    return result


async def fetch_b2c_bug_rows(sheet_url: str) -> list[dict]:
    """
    Fetch B2C bug tracking sheet (18-column format) and return parsed rows.
    Uses header-name matching so column order changes don't break parsing.
    Each row dict maps directly to Feedback model fields.
    Skips rows with empty 'Mô tả - text'.
    """
    csv_url = _to_csv_export_url(sheet_url)
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(csv_url)
        resp.raise_for_status()

    reader = csv.reader(io.StringIO(resp.text))
    rows = list(reader)
    if not rows:
        return []

    header = [h.strip() for h in rows[0]]

    def _col(row: list[str], *names: str) -> str:
        for name in names:
            for i, h in enumerate(header):
                if name.lower() in h.lower() and i < len(row):
                    return row[i].strip()
        return ""

    def _int(val: str) -> Optional[int]:
        try:
            return int(float(val.replace(",", ".").strip())) if val.strip() else None
        except (ValueError, TypeError):
            return None

    def _float(val: str) -> Optional[float]:
        try:
            return float(val.replace(",", ".").strip()) if val.strip() else None
        except (ValueError, TypeError):
            return None

    def _parse_date(val: str) -> Optional[str]:
        val = val.strip()
        if not val or val.lower() in ("tuần sau", "dự kiến 2 tuần có bản test"):
            return None
        m = re.match(r"^(\d{1,2})/(\d{1,2})(?:/(\d{4}))?$", val)
        if m:
            try:
                return date(int(m.group(3) or 2026), int(m.group(2)), int(m.group(1))).isoformat()
            except ValueError:
                return None
        return None

    def _media(val: str) -> Optional[list]:
        val = val.strip()
        if not val:
            return None
        parts = [p.strip() for p in re.split(r"[\n,]+", val) if p.strip()]
        return parts or None

    def _status(val: str) -> str:
        return {"following": "evaluating", "done": "done"}.get(val.strip().lower(), "draft")

    def _type(val: str) -> str:
        return {"bug": "bug", "feature": "feature", "feature request": "feature"}.get(
            val.strip().lower(), "unclear"
        )

    result = []
    for row in rows[1:]:
        raw_content = _col(row, "Mô tả - text")
        if not raw_content:
            continue
        result.append({
            "raw_content": raw_content,
            "media_urls": _media(_col(row, "Mô tả - image")),
            "feedback_type": _type(_col(row, "Loại yêu cầu")),
            "status": _status(_col(row, "Status")),
            "submitted_by": _col(row, "PIC") or None,
            "deadline": _parse_date(_col(row, "Deadline")),
            "priority_score": _float(_col(row, "Tổng điểm")),
            "tu_danh_gia": _int(_col(row, "Tú đánh giá")),
            "tu_danh_gia_note": _col(row, "Nguyên nhân") or None,
            "user_priority": _int(_col(row, "User đánh giá")),
            "user_priority_note": _col(row, "User note") or None,
            "tech_rating": _int(_col(row, "Dev đánh giá")),
            "root_cause": _col(row, "Nguyên nhân") or None,
            "solution_hint": _col(row, "Hướng giải quyết") or None,
            "created_at_raw": _col(row, "Ngày tạo"),
        })
    return result
