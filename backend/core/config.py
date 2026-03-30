from functools import lru_cache
from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://localhost/qccsai"

    # Telegram
    telegram_bot_token: str = ""
    telegram_webhook_secret: str = ""
    telegram_monitored_group_ids: str = ""   # Comma-separated group IDs
    telegram_announcement_group_id: str = ""

    # Anthropic
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-4-6"

    # Cloudinary
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""
    cloudinary_upload_preset: str = ""

    # Jira
    jira_domain: str = ""
    jira_email: str = ""
    jira_api_token: str = ""
    jira_webhook_secret: str = ""

    # Access control
    pm_qc_emails: str = ""  # Comma-separated

    # App
    backend_base_url: str = ""
    frontend_url: str = "http://localhost:3000"

    @property
    def monitored_group_ids(self) -> list[int]:
        if not self.telegram_monitored_group_ids:
            return []
        return [int(g.strip()) for g in self.telegram_monitored_group_ids.split(",") if g.strip()]

    @property
    def pm_qc_email_list(self) -> list[str]:
        if not self.pm_qc_emails:
            return []
        return [e.strip().lower() for e in self.pm_qc_emails.split(",") if e.strip()]

    def normalize_db_url(self) -> str:
        """Railway injects postgres:// — normalize to postgresql+asyncpg://"""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+asyncpg://", 1)
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()
