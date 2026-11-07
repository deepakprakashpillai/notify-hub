import logging
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

async def send_email(
    to_email: str | None = None,
    subject: str = "",
    html_body: str = "",
    text_body: str = "",
    api_key: str = "mock_key",
    from_address: str = "noreply@notifyhub.dev",
    to_addresses: list[str] | None = None,
    **kwargs
) -> dict:
    """Send an email using Resend API."""
    recipients = to_addresses or ([to_email] if to_email else [])
    logger.info(f"Sending email via Resend to {recipients}")

    if api_key == "mock_key" or not api_key:
        if settings.ENVIRONMENT.lower() == "production":
            raise RuntimeError("Email provider API key is not configured")
        return {"status": "ok", "mock": True, "to": recipients}

    url = "https://api.resend.com/emails"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json"
    }
    payload = {
        "from": from_address,
        "to": recipients,
        "subject": subject,
    }

    if html_body:
        payload["html"] = html_body
    if text_body:
        payload["text"] = text_body

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, json=payload, timeout=10.0)
        response.raise_for_status()
        return response.json()

