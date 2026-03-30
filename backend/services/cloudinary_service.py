import asyncio
from functools import partial
from typing import Optional
import cloudinary
import cloudinary.uploader
from core.config import get_settings


def _init_cloudinary():
    s = get_settings()
    cloudinary.config(
        cloud_name=s.cloudinary_cloud_name,
        api_key=s.cloudinary_api_key,
        api_secret=s.cloudinary_api_secret,
        secure=True,
    )


_init_cloudinary()


async def upload_bytes(
    data: bytes,
    issue_id: str,
    filename: str,
    resource_type: str = "auto",
) -> dict:
    """Upload raw bytes to Cloudinary, return {secure_url, public_id, resource_type}."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(
            cloudinary.uploader.upload,
            data,
            folder=f"qc-cs-ai/{issue_id}",
            public_id=filename,
            resource_type=resource_type,
            overwrite=False,
        ),
    )
    return {
        "secure_url": result["secure_url"],
        "public_id": result["public_id"],
        "resource_type": result["resource_type"],
    }


async def upload_from_url(url: str, issue_id: str, resource_type: str = "auto") -> dict:
    """Upload to Cloudinary from a remote URL (e.g., Telegram file URL)."""
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None,
        partial(
            cloudinary.uploader.upload,
            url,
            folder=f"qc-cs-ai/{issue_id}",
            resource_type=resource_type,
            overwrite=False,
        ),
    )
    return {
        "secure_url": result["secure_url"],
        "public_id": result["public_id"],
        "resource_type": result["resource_type"],
    }
