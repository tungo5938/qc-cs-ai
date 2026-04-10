from __future__ import annotations
import csv
import io
import httpx


async def fetch_sheet_rows(sheet_url: str) -> list[dict]:
    """
    Fetch public Google Sheet as CSV and return list of row dicts.
    sheet_url should be the export URL: ...?format=csv&gid=...
    Returns rows with keys: row_index, type, content, user_priority, tu_danh_gia, tech_rating, tuan_done, trang_thai, jira, ghi_chu
    Skips header row and empty content rows.
    """
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
        resp = await client.get(sheet_url)
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
