import logging
import httpx
import hmac
import hashlib
import json
from app.core.config import settings

logger = logging.getLogger(__name__)

def generate_signature(secret: str, payload_bytes: bytes) -> str:
    """Generate HMAC SHA256 signature for the webhook payload."""
    secret_bytes = secret.encode("utf-8") if isinstance(secret, str) else b""
    return hmac.new(
        secret_bytes,
        payload_bytes,
        hashlib.sha256
    ).hexdigest()

async def send_in_app(
    webhook_url: str | None = None,
    secret: str | None = None,
    webhook_secret: str | None = None,
    payload: dict | None = None,
    delivery_id: str | None = None,
    event_id: str | None = None,
    recipient_id: str | None = None,
    workflow: str | None = None,
    priority: str | None = None,
    content: dict | None = None,
    occurred_at: str | None = None,
    **kwargs
) -> dict:
    """Send an in-app notification to the source application's webhook."""
    sec = secret or webhook_secret or ""
    url = webhook_url or ""

    logger.info(f"Sending in-app webhook to {url}")

    if not url or url.startswith("mock") or url == "http://localhost/mock-webhook":
        if settings.ENVIRONMENT.lower() == "production":
            raise RuntimeError("In-app webhook URL is not configured")
        return {"status": "ok", "mock": True}

    if settings.ENVIRONMENT.lower() == "production" and not sec:
        raise RuntimeError("In-app webhook signing secret is not configured")

    if payload is None:
        payload = {
            "delivery_id": delivery_id,
            "event_id": event_id,
            "recipient_id": recipient_id,
            "workflow": workflow,
            "priority": priority,
            "content": content or {},
            "occurred_at": occurred_at
        }

    payload_bytes = json.dumps(payload).encode("utf-8")
    signature = generate_signature(sec, payload_bytes)

    headers = {
        "Content-Type": "application/json",
        "X-Hub-Signature": f"sha256={signature}"
    }

    async with httpx.AsyncClient() as client:
        response = await client.post(url, headers=headers, content=payload_bytes, timeout=10.0)
        response.raise_for_status()
        try:
            return response.json()
        except Exception:
            return {"status": "ok", "status_code": response.status_code}

