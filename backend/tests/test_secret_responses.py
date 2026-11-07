import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_environment_reads_do_not_return_secret_values():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/v1/applications", json={"name": "Secret response test"})
        environment = created.json()["environments"][0]
        environment_id = environment["id"]
        updated = await client.put(
            f"/v1/environments/{environment_id}",
            json={"webhook_secret": "private-webhook", "resend_api_key": "private-email"},
        )
        assert updated.status_code == 200
        key = await client.post(f"/v1/environments/{environment_id}/api-keys")
        assert key.status_code == 201
        read = await client.get(f"/v1/applications/{created.json()['id']}")
        result = read.json()["environments"][0]
        assert result["has_api_key"] is True
        assert result["has_webhook_secret"] is True
        assert result["has_resend_api_key"] is True
        assert "api_key_hash" not in result
        assert "webhook_secret" not in result
        assert "resend_api_key" not in result
        assert "private-webhook" not in read.text
        assert "private-email" not in read.text
