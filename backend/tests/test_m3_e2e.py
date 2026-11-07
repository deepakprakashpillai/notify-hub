from unittest.mock import patch
import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app
from app.models.delivery import DeliveryAttempt, NotificationJob
from app.workers.tasks import async_process_notification_job, process_notification_job

from tests.conftest import TestingSessionLocal



@pytest.mark.asyncio
async def test_event_ingestion_and_idempotency():
    with patch("app.api.v1.endpoints.events.celery_app.send_task"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Setup application and environment
            res = await client.post("/v1/applications", json={"name": "E2E Ingestion App"})
            assert res.status_code == 201
            app_data = res.json()
            env_id = app_data["environments"][0]["id"]

            # 2. Setup API Key
            res = await client.post(f"/v1/environments/{env_id}/api-keys")
            assert res.status_code == 201
            raw_key = res.json()["raw_key"]

            # 3. Create workflow
            res = await client.post(
                "/v1/workflows",
                json={"environment_id": env_id, "key": "order-shipped", "name": "Order Shipped Workflow"}
            )
            assert res.status_code == 201
            wf_data = res.json()
            v1_id = wf_data["versions"][0]["id"]
            res = await client.post(f"/v1/versions/{v1_id}/audiences", json={"audience_key": "default", "channels": ["email", "in_app"], "priority": "default"})
            assert res.status_code == 201, res.text
            audience_id = res.json()["id"]

            # 4. Create templates (email and in_app)
            res = await client.post(
                f"/v1/audiences/{audience_id}/templates",
                json={
                    "channel": "email",
                    "subject": "Order {{ order_id }} shipped!",
                    "html_body": "<p>Hello {{ name }}, order {{ order_id }} is on its way!</p>"
                }
            )
            assert res.status_code == 201

            res = await client.post(
                f"/v1/audiences/{audience_id}/templates",
                json={
                    "channel": "in_app",
                    "in_app_title": "Order {{ order_id }} Update",
                    "in_app_body": "Your order {{ order_id }} has shipped.",
                    "action_url": "https://app.com/orders/{{ order_id }}"
                }
            )
            assert res.status_code == 201

            # 5. Publish workflow version
            res = await client.post(f"/v1/versions/{v1_id}/publish")
            assert res.status_code == 200
            assert res.json()["status"] == "published"

            # 6. Post POST /v1/events -> expects 200, returns job_id
            event_payload = {
                "event_id": "evt-order-1001",
                "workflow": "order-shipped",
                "data": {"order_id": "1001"},
                "recipients": [
                    {
                        "user_id": "user-42",
                        "email": "user42@example.com",
                        "data": {"name": "Bob"}
                    }
                ]
            }

            headers = {"Authorization": f"Bearer {raw_key}"}

            res1 = await client.post("/v1/events", json=event_payload, headers=headers)
            assert res1.status_code == 202, res1.text
            data1 = res1.json()
            assert data1["status"] == "accepted"
            assert "job_id" in data1
            job_id = data1["job_id"]
            assert job_id is not None

            # 7. Post duplicate event -> expects 202, duplicate status, same job_id
            res2 = await client.post("/v1/events", json=event_payload, headers=headers)
            assert res2.status_code == 200, res2.text
            data2 = res2.json()
            assert data2["status"] == "duplicate_ingested"
            assert data2["job_id"] == job_id
            assert data2["message"] == "Event already ingested — returning existing job"


@pytest.mark.asyncio
async def test_celery_worker_task_execution():
    with patch("app.adapters.email.send_email") as mock_send_email, \
         patch("app.adapters.in_app.send_in_app") as mock_send_in_app:

        mock_send_email.return_value = {"status": "ok"}
        mock_send_in_app.return_value = {"status": "ok"}

        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # 1. Setup app, env, API key, workflow, published version and templates
            res = await client.post("/v1/applications", json={"name": "E2E Worker Execution App"})
            assert res.status_code == 201
            app_data = res.json()
            env_id = app_data["environments"][0]["id"]

            res = await client.post(f"/v1/environments/{env_id}/api-keys")
            assert res.status_code == 201
            raw_key = res.json()["raw_key"]

            res = await client.post(
                "/v1/workflows",
                json={"environment_id": env_id, "key": "password-reset", "name": "Password Reset Workflow"}
            )
            assert res.status_code == 201
            wf_data = res.json()
            v1_id = wf_data["versions"][0]["id"]
            res = await client.post(f"/v1/versions/{v1_id}/audiences", json={"audience_key": "default", "channels": ["email", "in_app"], "priority": "default"})
            assert res.status_code == 201, res.text
            audience_id = res.json()["id"]

            res = await client.post(
                f"/v1/audiences/{audience_id}/templates",
                json={
                    "channel": "email",
                    "subject": "Reset Password for {{ user_name }}",
                    "html_body": "<h1>Reset Code: {{ code }}</h1>",
                    "text_body": "Reset Code: {{ code }}"
                }
            )
            assert res.status_code == 201

            res = await client.post(
                f"/v1/audiences/{audience_id}/templates",
                json={
                    "channel": "in_app",
                    "in_app_title": "Security Alert for {{ user_name }}",
                    "in_app_body": "Password reset requested for {{ user_name }}.",
                    "action_url": "https://example.com/reset?code={{ code }}"
                }
            )
            assert res.status_code == 201

            res = await client.post(f"/v1/versions/{v1_id}/publish")
            assert res.status_code == 200

            # 2. Ingest event
            event_payload = {
                "event_id": "evt-pwd-001",
                "workflow": "password-reset",
                "data": {"user_name": "Alice"},
                "recipients": [
                    {
                        "user_id": "user-alice",
                        "email": "alice@example.com",
                        "data": {"code": "123456"}
                    }
                ]
            }

            headers = {"Authorization": f"Bearer {raw_key}"}

            with patch("app.api.v1.endpoints.events.celery_app.send_task"):
                res_event = await client.post("/v1/events", json=event_payload, headers=headers)
                assert res_event.status_code == 202
                job_id = res_event.json()["job_id"]

            # 3. Execute Celery worker task execution on created job_id
            async with TestingSessionLocal() as session:
                result = await async_process_notification_job(str(job_id), event_payload, db=session)
                assert result["status"] == "completed"

            # 4. Query DB to verify NotificationJob.status == "completed" and DeliveryAttempts records
            import uuid as _uuid
            async with TestingSessionLocal() as session:
                job = await session.get(NotificationJob, _uuid.UUID(str(job_id)))
                assert job is not None
                assert job.status == "completed"


                # Verify 2 DeliveryAttempt DB records created (email and in_app) with properly rendered Jinja2 template outputs
                stmt = select(DeliveryAttempt).where(DeliveryAttempt.job_id == _uuid.UUID(str(job_id)))
                attempts_res = await session.execute(stmt)

                attempts = attempts_res.scalars().all()

                assert len(attempts) == 2

                email_attempt = next(a for a in attempts if a.channel == "email")
                assert email_attempt.status == "success"
                assert email_attempt.recipient_id == "user-alice"
                assert email_attempt.payload_data["subject"] == "Reset Password for Alice"
                assert email_attempt.payload_data["body"] == "<h1>Reset Code: 123456</h1>"

                in_app_attempt = next(a for a in attempts if a.channel == "in_app")
                assert in_app_attempt.status == "success"
                assert in_app_attempt.recipient_id == "user-alice"
                assert in_app_attempt.payload_data["title"] == "Security Alert for Alice"
                assert in_app_attempt.payload_data["body"] == "Password reset requested for Alice."
