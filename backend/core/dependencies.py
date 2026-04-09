from __future__ import annotations
from typing import Literal, Optional
from fastapi import Header, Depends
from core.config import Settings, get_settings


def get_current_role(
    x_user_email: Optional[str] = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> Literal["pm_qc", "user", "anonymous"]:
    if not x_user_email:
        return "anonymous"
    email = x_user_email.strip().lower()
    if email in settings.pm_qc_email_list:
        return "pm_qc"
    if email.endswith("@ghn.vn") or email.endswith("@ghn.com.vn"):
        return "user"
    return "anonymous"


def require_pm_qc(role: str = Depends(get_current_role)):
    from fastapi import HTTPException
    if role != "pm_qc":
        raise HTTPException(status_code=403, detail="PM/QC access required")
    return role
