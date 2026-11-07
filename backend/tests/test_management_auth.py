import base64

import pytest
from httpx import ASGITransport, AsyncClient

from app.core.config import settings
from app.main import app


@pytest.mark.asyncio
async def test_production_management_requires_valid_basic_auth(monkeypatch):
    monkeypatch.setattr(settings, "ENVIRONMENT", "production")
    monkeypatch.setattr(settings, "ADMIN_USERNAME", "operator")
    monkeypatch.setattr(settings, "ADMIN_PASSWORD", "a-long-enough-test-password-with-32-characters")
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        assert (await client.get("/health")).status_code == 200
        unauthenticated = await client.get("/v1/applications")
        assert unauthenticated.status_code == 401
        assert unauthenticated.headers["www-authenticate"].startswith("Basic")
        bad = base64.b64encode(b"operator:wrong").decode()
        assert (await client.get("/v1/applications", headers={"Authorization": f"Basic {bad}"})).status_code == 401
        token = base64.b64encode(b"operator:a-long-enough-test-password-with-32-characters").decode()
        assert (await client.get("/v1/applications", headers={"Authorization": f"Basic {token}"})).status_code == 200
        # The ingestion endpoint continues to use its own environment API key.
        response = await client.post("/v1/events", json={})
        assert response.status_code == 401
        assert response.json()["detail"] == "API Key missing"
