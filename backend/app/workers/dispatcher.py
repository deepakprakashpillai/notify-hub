"""Publish saved notification jobs, retrying broker outages without losing intent."""
import asyncio
import logging
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.celery_app import celery_app
from app.db.session import async_session_maker
from app.models.delivery import NotificationJob

logger = logging.getLogger(__name__)


async def dispatch_pending(session: AsyncSession, job_id: UUID | None = None) -> int:
    statement = select(NotificationJob).where(
        NotificationJob.status == "pending",
        NotificationJob.event_payload.is_not(None),
        NotificationJob.dispatched_at.is_(None),
    )
    if job_id is not None:
        statement = statement.where(NotificationJob.id == job_id)
    statement = statement.order_by(NotificationJob.created_at).limit(50).with_for_update(skip_locked=True)
    jobs = (await session.execute(statement)).scalars().all()
    sent = 0
    for job in jobs:
        try:
            celery_app.send_task(
                "app.workers.tasks.process_notification_job",
                args=[str(job.id), job.event_payload],
                routing_key=job.routing_key,
                task_id=str(job.id),
                retry=False,
            )
        except Exception:
            logger.exception("Could not publish notification job %s; it will be retried", job.id)
            break
        job.dispatched_at = datetime.now(timezone.utc)
        sent += 1
    await session.commit()
    return sent


async def run() -> None:
    while True:
        try:
            async with async_session_maker() as session:
                await dispatch_pending(session)
        except Exception:
            logger.exception("Notification dispatch failed; retrying")
        await asyncio.sleep(5)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run())
