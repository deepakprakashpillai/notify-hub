import pytest
import pytest_asyncio
from fastapi import HTTPException
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.db.base import Base
from app.db.session import get_db
from app.main import app

from tests.conftest import TestingSessionLocal



@pytest.mark.asyncio
async def test_applications_crud_and_api_keys():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # 1. Create Application
        res = await client.post(
            "/v1/applications",
            json={"name": "App Alpha", "description": "Test app description"},
        )
        assert res.status_code == 201, res.text
        data = res.json()
        app_id = data["id"]
        assert data["name"] == "App Alpha"
        assert len(data["environments"]) == 2
        env_names = {env["name"] for env in data["environments"]}
        assert env_names == {"live", "test"}
        live_env_id = next(e["id"] for e in data["environments"] if e["name"] == "live")

        # 2. List Applications
        res = await client.get("/v1/applications")
        assert res.status_code == 200
        apps = res.json()
        assert len(apps) == 1
        assert apps[0]["id"] == app_id

        # 3. Get Single Application
        res = await client.get(f"/v1/applications/{app_id}")
        assert res.status_code == 200
        assert res.json()["name"] == "App Alpha"

        # 4. Update Application
        res = await client.put(
            f"/v1/applications/{app_id}",
            json={"name": "App Alpha Updated", "description": "New description"},
        )
        assert res.status_code == 200
        assert res.json()["name"] == "App Alpha Updated"

        # 5. Create Custom Environment
        res = await client.post(
            f"/v1/applications/{app_id}/environments",
            json={"name": "staging"},
        )
        assert res.status_code == 201
        staging_env = res.json()
        assert staging_env["name"] == "staging"

        # 6. Generate API Key
        res = await client.post(f"/v1/environments/{live_env_id}/api-keys")
        assert res.status_code == 201
        key_data = res.json()
        assert "raw_key" in key_data
        assert key_data["raw_key"].startswith(f"{live_env_id}.")
        assert key_data["environment_id"] == live_env_id

        # 7. Delete Application
        res = await client.delete(f"/v1/applications/{app_id}")
        assert res.status_code == 204

        # 8. Verify Deleted
        res = await client.get(f"/v1/applications/{app_id}")
        assert res.status_code == 404


@pytest.mark.asyncio
async def test_workflows_versions_templates_crud():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create App to get an environment_id
        res = await client.post(
            "/v1/applications",
            json={"name": "Workflow Test App"},
        )
        assert res.status_code == 201
        app_data = res.json()
        env_id = app_data["environments"][0]["id"]

        # 1. Create Workflow
        res = await client.post(
            "/v1/workflows",
            json={
                "environment_id": env_id,
                "key": "user-welcome",
                "name": "User Welcome Workflow",
            },
        )
        assert res.status_code == 201, res.text
        wf_data = res.json()
        wf_id = wf_data["id"]
        assert wf_data["key"] == "user-welcome"
        assert len(wf_data["versions"]) == 1
        assert wf_data["versions"][0]["version_number"] == 1
        assert wf_data["versions"][0]["status"] == "draft"
        v1_id = wf_data["versions"][0]["id"]

        # 2. List Workflows (filtered)
        res = await client.get(f"/v1/workflows?environment_id={env_id}")
        assert res.status_code == 200
        wfs = res.json()
        assert len(wfs) == 1

        # 3. Get Workflow
        res = await client.get(f"/v1/workflows/{wf_id}")
        assert res.status_code == 200
        assert res.json()["name"] == "User Welcome Workflow"

        # 4. Update Workflow
        res = await client.put(
            f"/v1/workflows/{wf_id}",
            json={"name": "Updated Welcome Workflow"},
        )
        assert res.status_code == 200
        assert res.json()["name"] == "Updated Welcome Workflow"

        # 4.5. Assert 0 audience rules initially, and create one
        assert len(wf_data["versions"][0]["audience_rules"]) == 0
        version_id = wf_data["versions"][0]["id"]
        res = await client.post(
            f"/v1/versions/{version_id}/audiences",
            json={"audience_key": "student", "channels": ["email"], "priority": "default"}
        )
        assert res.status_code == 201
        audience_id = res.json()["id"]

        # 5. Create Template for the student audience
        res = await client.post(
            f"/v1/audiences/{audience_id}/templates",
            json={
                "channel": "email",
                "subject": "Welcome {{ name }}!",
                "html_body": "<h1>Welcome</h1>",
            },
        )
        assert res.status_code == 201
        tmpl_data = res.json()
        tmpl_id = tmpl_data["id"]
        assert tmpl_data["channel"] == "email"
        assert tmpl_data["subject"] == "Welcome {{ name }}!"

        # 6. Update Template
        res = await client.put(
            f"/v1/templates/{tmpl_id}",
            json={"subject": "Updated Welcome {{ name }}!"},
        )
        assert res.status_code == 200
        assert res.json()["subject"] == "Updated Welcome {{ name }}!"

        # 7. List Templates for Audience
        res = await client.get(f"/v1/audiences/{audience_id}/templates")
        assert res.status_code == 200
        templates = res.json()
        assert len(templates) == 1

        # 8. Publish v1
        res = await client.post(f"/v1/versions/{v1_id}/publish")
        assert res.status_code == 200
        assert res.json()["status"] == "published"

        # 9. Create New Draft Version (v2)
        res = await client.post(
            f"/v1/workflows/{wf_id}/versions",
            json={"variables_schema": [{"name": "test_var", "required": True}]},
        )
        assert res.status_code == 201
        v2_data = res.json()
        v2_id = v2_data["id"]
        assert v2_data["version_number"] == 2
        assert v2_data["status"] == "draft"

        # 10. Publish v2 (should archive v1)
        res = await client.post(f"/v1/versions/{v2_id}/publish")
        assert res.status_code == 200
        assert res.json()["status"] == "published"

        # Check v1 status is now archived
        res = await client.get(f"/v1/workflows/{wf_id}/versions")
        assert res.status_code == 200
        versions = res.json()
        v1_check = next(v for v in versions if v["id"] == v1_id)
        assert v1_check["status"] == "archived"

        # 11. Delete Workflow
        res = await client.delete(f"/v1/workflows/{wf_id}")
        assert res.status_code == 204


@pytest.mark.asyncio
async def test_api_key_authentication():
    from unittest.mock import patch
    from app.api.dependencies import get_current_environment

    with patch("app.workers.dispatcher.celery_app.send_task"):
        async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
            # a) Create app, create environment, generate API key (POST /environments/{env_id}/api-keys)
            res = await client.post(
                "/v1/applications",
                json={"name": "Auth Test App"},
            )
            assert res.status_code == 201
            app_data = res.json()
            env_id = app_data["environments"][0]["id"]

            res = await client.post(f"/v1/environments/{env_id}/api-keys")
            assert res.status_code == 201
            raw_key = res.json()["raw_key"]

            # Create workflow & publish version so event ingestion succeeds
            wf_res = await client.post(
                "/v1/workflows",
                json={"environment_id": env_id, "key": "welcome", "name": "Welcome Workflow"},
            )
            assert wf_res.status_code == 201
            v1_id = wf_res.json()["versions"][0]["id"]
            await client.post(f"/v1/versions/{v1_id}/publish")

            # b) Call get_current_environment with valid generated key, verifying authentication succeeds
            res = await client.post(
                "/v1/events",
                json={
                    "event_id": "evt-123",
                    "workflow": "welcome",
                    "recipients": [{"user_id": "user-1", "email": "user@example.com"}],
                },
                headers={"Authorization": f"Bearer {raw_key}"},
            )
            assert res.status_code == 202


            # Direct call verification
            async with TestingSessionLocal() as db_session:
                env = await get_current_environment(api_key_header=raw_key, db=db_session)
                assert str(env.id) == env_id

            # c) Call with invalid format key ("not-a-uuid" or "foo.bar"), verifying HTTP 401
            for invalid_key in ["not-a-uuid", "foo.bar"]:
                res = await client.post(
                    "/v1/events",
                    json={
                        "event_id": "evt-123",
                        "workflow": "welcome",
                        "recipients": [{"user_id": "user-1", "email": "user@example.com"}],
                    },
                    headers={"Authorization": f"Bearer {invalid_key}"},
                )
                assert res.status_code == 401
                assert res.json()["detail"] == "Invalid API key format"

                async with TestingSessionLocal() as db_session:
                    with pytest.raises(HTTPException) as exc_info:
                        await get_current_environment(api_key_header=invalid_key, db=db_session)
                    assert exc_info.value.status_code == 401
                    assert exc_info.value.detail == "Invalid API key format"

            # d) Call with valid UUID but wrong secret, verifying HTTP 401
            wrong_secret_key = f"{env_id}.wrongsecret"
            res = await client.post(
                "/v1/events",
                json={
                    "event_id": "evt-123",
                    "workflow": "welcome",
                    "recipients": [{"user_id": "user-1", "email": "user@example.com"}],
                },
                headers={"Authorization": f"Bearer {wrong_secret_key}"},
            )
            assert res.status_code == 401
            assert res.json()["detail"] == "Invalid API key"

            async with TestingSessionLocal() as db_session:
                with pytest.raises(HTTPException) as exc_info:
                    await get_current_environment(api_key_header=wrong_secret_key, db=db_session)
                assert exc_info.value.status_code == 401
                assert exc_info.value.detail == "Invalid API key"


@pytest.mark.asyncio
async def test_template_channel_validation_and_partial_updates():
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as client:
        # Create App & Workflow & Template
        res = await client.post(
            "/v1/applications",
            json={"name": "Partial Update App", "description": "Initial description"},
        )
        assert res.status_code == 201
        app_id = res.json()["id"]
        env_id = res.json()["environments"][0]["id"]

        # Partial update to clear description (set to None)
        res = await client.put(
            f"/v1/applications/{app_id}",
            json={"description": None},
        )
        assert res.status_code == 200
        assert res.json()["description"] is None

        # Workflow creation & template
        res = await client.post(
            "/v1/workflows",
            json={"environment_id": env_id, "key": "tmpl-wf", "name": "Template Workflow"},
        )
        assert res.status_code == 201
        wf_data = res.json()
        v1_id = wf_data["versions"][0]["id"]
        res = await client.post(
            f"/v1/versions/{v1_id}/audiences",
            json={"audience_key": "admin", "channels": ["email"], "priority": "default"}
        )
        audience_id = res.json()["id"]

        res = await client.post(
            f"/v1/audiences/{audience_id}/templates",
            json={"channel": "email", "subject": "Subject"},
        )
        assert res.status_code == 201
        tmpl_id = res.json()["id"]

        # Invalid channel update
        res = await client.put(
            f"/v1/templates/{tmpl_id}",
            json={"channel": "invalid_channel"},
        )
        assert res.status_code == 400
        assert res.json()["detail"] == "Invalid template channel"

        # Valid channel update
        res = await client.put(
            f"/v1/templates/{tmpl_id}",
            json={"channel": "in_app"},
        )
        assert res.status_code == 200
        assert res.json()["channel"] == "in_app"

