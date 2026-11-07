from unittest.mock import patch
from uuid import UUID

import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.models.delivery import NotificationJob
from app.workers.dispatcher import dispatch_pending
from tests.conftest import TestingSessionLocal


@pytest.mark.asyncio
async def test_broker_failure_retains_job_and_retries_later():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        created = await client.post("/v1/applications", json={"name": "Dispatch recovery"})
        env_id = created.json()["environments"][0]["id"]
        raw_key = (await client.post(f"/v1/environments/{env_id}/api-keys")).json()["raw_key"]
        workflow = await client.post("/v1/workflows", json={
            "environment_id": env_id, "key": "recovery", "name": "Recovery"
        })
        version_id = workflow.json()["versions"][0]["id"]
        assert (await client.post(f"/v1/versions/{version_id}/publish")).status_code == 200
        payload = {"event_id": "outage-test", "workflow": "recovery", "recipients": [{"user_id": "student"}]}
        with patch("app.workers.dispatcher.celery_app.send_task", side_effect=OSError("broker down")):
            response = await client.post("/v1/events", json=payload, headers={"Authorization": f"Bearer {raw_key}"})
        assert response.status_code == 202
        job_id = UUID(response.json()["job_id"])
        async with TestingSessionLocal() as session:
            job = await session.get(NotificationJob, job_id)
            assert job.dispatched_at is None
            assert job.event_payload["event_id"] == "outage-test"
            with patch("app.workers.dispatcher.celery_app.send_task") as publish:
                assert await dispatch_pending(session) == 1
                assert publish.call_count == 1
            await session.refresh(job)
            assert job.dispatched_at is not None
            with patch("app.workers.dispatcher.celery_app.send_task") as publish:
                assert await dispatch_pending(session) == 0
                publish.assert_not_called()
