import os
from dataclasses import dataclass

from dotenv import load_dotenv

load_dotenv()


@dataclass
class Settings:
    """Lightweight settings container; expand as secrets and config are wired."""

    app_name: str = "Astrology Guidance Platform API"
    environment: str = os.environ.get("APP_ENV", "local")
    sharepoint_site: str = os.environ.get("SHAREPOINT_SITE", "https://tenant.sharepoint.com/sites/horos")
    sharepoint_mode: str = os.environ.get("SHAREPOINT_MODE", "stub")
    sharepoint_tenant_id: str = os.environ.get("SHAREPOINT_TENANT_ID", "")
    sharepoint_client_id: str = os.environ.get("SHAREPOINT_CLIENT_ID", "")
    sharepoint_client_secret: str = os.environ.get("SHAREPOINT_CLIENT_SECRET", "")
    sharepoint_site_id: str = os.environ.get("SHAREPOINT_SITE_ID", "")
    sharepoint_zodiac_list_id: str = os.environ.get("SHAREPOINT_ZODIAC_LIST_ID", "")
    sharepoint_prompt_list_id: str = os.environ.get(
        "SHAREPOINT_PROMPT_LIST_ID", "{5635A4ED-CDC7-453D-B2E2-36F0E71BCF8A}"
    )
    sharepoint_cache_list_id: str = os.environ.get("SHAREPOINT_CACHE_LIST_ID", "{00ba0c35-37c0-422f-878f-639d45e9816a}")
    openai_model: str = os.environ.get("OPENAI_MODEL", "gpt-4.1")
    openai_api_key: str = os.environ.get("OPENAI_API_KEY", "")
    openai_base_url: str = os.environ.get("OPENAI_BASE_URL", "https://api.openai.com/v1")
    otp_ttl_seconds: int = int(os.environ.get("OTP_TTL_SECONDS", 600))


settings = Settings()
