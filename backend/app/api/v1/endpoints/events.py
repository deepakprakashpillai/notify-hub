import uuid
from datetime import datetime, timezone
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.dependencies import get_current_environment
from app.db.session import get_db
from app.models.application import ApplicationEnvironment
from app.models.delivery import NotificationJob
from app.models.workflow import Workflow, WorkflowVersion
from app.schemas.event import EventIngestionRequest, EventIngestionResponse
from app.workers.dispatcher import dispatch_pending

router = APIRouter()

# Priority ordering for cap enforcement: lower index = higher priority
_PRIORITY_ORDER = {"high": 0, "default": 1, "low": 2}


def to_uuid(val: Any) -> uuid.UUID:
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


def _resolve_priority(workflow_priority: str, requested_priority: str | None) -> str:
    """
    Resolve final delivery priority.

    The workflow defines a default priority. A source app may suggest a priority
    per-event, but it is capped by the workflow's setting — the source app
    cannot escalate above the workflow's configured priority.
    """
    if requested_priority is None:
        return workflow_priority

    workflow_rank = _PRIORITY_ORDER.get(workflow_priority, 1)
    requested_rank = _PRIORITY_ORDER.get(requested_priority, 1)

    # Lower rank = higher priority. Clamp to at most the workflow's priority.
    if requested_rank < workflow_rank:
        # Source app tried to escalate — cap to workflow priority
        return workflow_priority
    return requested_priority


@router.post(
    "",
    status_code=status.HTTP_202_ACCEPTED,
    response_model=EventIngestionResponse
)
async def ingest_event(
    event: EventIngestionRequest,
    response: Response,
    env: ApplicationEnvironment = Depends(get_current_environment),
    db: AsyncSession = Depends(get_db)
):
    if not event.audiences and not event.recipients:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Either 'audiences' or 'recipients' must be provided"
        )
    
    if not event.audiences and event.recipients:
        event.audiences = {"default": event.recipients}

    env_uuid = to_uuid(env.id)

    # 1. Idempotency check: see if job already exists for (environment_id, event_id)
    stmt = select(NotificationJob).where(
        NotificationJob.environment_id == env_uuid,
        NotificationJob.event_id == event.event_id
    )
    existing_res = await db.execute(stmt)
    existing_job = existing_res.scalar_one_or_none()

    if existing_job:
        response.status_code = status.HTTP_200_OK
        return EventIngestionResponse(
            job_id=existing_job.id,
            status="duplicate_ingested",
            message="Event already ingested — returning existing job",
            event_id=event.event_id
        )

    # 2. Validate target workflow: must exist, be active, and have a published version
    wf_stmt = (
        select(Workflow)
        .options(selectinload(Workflow.versions))
        .where(
            Workflow.environment_id == env_uuid,
            Workflow.key == event.workflow
        )
    )
    wf_res = await db.execute(wf_stmt)
    workflow = wf_res.scalar_one_or_none()

    if not workflow or not workflow.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "invalid_workflow",
                "message": f"Workflow '{event.workflow}' not found or is inactive in this environment"
            }
        )

    has_published_version = any(v.status == "published" for v in workflow.versions)
    if not has_published_version:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "status": "invalid_workflow",
                "message": f"Workflow '{event.workflow}' has no published version"
            }
        )

    # 3. Resolve delivery priority (capped at workflow's configured priority)
    final_priority = _resolve_priority(workflow.priority, event.priority)

    # 4. Create NotificationJob
    occurred_at = event.occurred_at or datetime.now(tz=timezone.utc)
    job = NotificationJob(
        id=uuid.uuid4(),
        environment_id=env_uuid,
        event_id=event.event_id,
        workflow_key=event.workflow,
        status="pending",
        occurred_at=occurred_at,
        event_payload=event.model_dump(mode="json"),
        routing_key=f"{env.application_id}.{final_priority}",
    )
    db.add(job)
    await db.commit()

    # 5. Enqueue Celery task using the resolved priority queue
    # Routing key: "{app_id}.{priority}" — matches the topic exchange bindings
    await dispatch_pending(db, job.id)

    return EventIngestionResponse(
        job_id=job.id,
        status="accepted",
        message="Event accepted and queued for delivery",
        event_id=event.event_id
    )
