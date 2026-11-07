import pytest

from app.adapters.email import send_email
from app.adapters.in_app import send_in_app
from app.core.config import settings


@pytest.mark.asyncio
async def test_production_rejects_mock_delivery(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    with pytest.raises(RuntimeError, match="Email provider"):
        await send_email(to_email="recipient@example.com")
    with pytest.raises(RuntimeError, match="webhook URL"):
        await send_in_app()
    with pytest.raises(RuntimeError, match="signing secret"):
        await send_in_app(webhook_url="https://example.com/webhook")
