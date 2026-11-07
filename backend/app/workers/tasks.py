import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.adapters.email import send_email
from app.adapters.in_app import send_in_app
from app.core.celery_app import celery_app
from app.core.templating import render_template
from app.db.session import async_session_maker
from app.models.application import ApplicationEnvironment
from app.models.delivery import DeliveryAttempt, NotificationJob
from app.models.workflow import Workflow, WorkflowVersion, AudienceRule

logger = logging.getLogger(__name__)


def to_uuid(val: Any) -> uuid.UUID:
    if isinstance(val, uuid.UUID):
        return val
    return uuid.UUID(str(val))


async def async_process_notification_job(job_id: str, event_data: dict, db: AsyncSession | None = None) -> dict:
    """Async execution logic for processing a NotificationJob."""
    if db is not None:
        return await _execute_job(job_id, event_data, db)

    async with async_session_maker() as session:
        return await _execute_job(job_id, event_data, session)


async def _execute_job(job_id: str, event_data: dict, db: AsyncSession) -> dict:
    # a) Fetch NotificationJob by job_id
    job_uuid = to_uuid(job_id)
    stmt = select(NotificationJob).where(NotificationJob.id == job_uuid)
    res = await db.execute(stmt)
    job = res.scalar_one_or_none()

    if not job:
        logger.error(f"Job {job_id} not found")
        return {"status": "failed", "reason": "job_not_found"}

    job.status = "processing"
    await db.commit()

    env_uuid = to_uuid(job.environment_id)

    # b) Fetch target Workflow + published version with audience_rules and templates
    wf_stmt = (
        select(Workflow)
        .options(
            selectinload(Workflow.versions).selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates)
        )
        .where(
            Workflow.environment_id == env_uuid,
            Workflow.key == job.workflow_key
        )
    )
    wf_res = await db.execute(wf_stmt)
    workflow = wf_res.scalar_one_or_none()

    published_version = None
    if workflow:
        published_version = next((v for v in workflow.versions if v.status == "published"), None)

    if not workflow or not published_version:
        logger.error(f"Published workflow for key {job.workflow_key} not found")
        job.status = "failed"
        await db.commit()
        return {"status": "failed", "reason": "workflow_not_found"}

    # Fetch ApplicationEnvironment for webhook credentials and application metadata
    env_stmt = (
        select(ApplicationEnvironment)
        .where(ApplicationEnvironment.id == env_uuid)
    )
    env_res = await db.execute(env_stmt)
    env = env_res.scalar_one_or_none()

    webhook_url = env.webhook_url if env else None
    webhook_secret = env.webhook_secret if env else None
    app_key = str(env.application_id) if env else "unknown"
    env_name = env.name if env else "unknown"

    occurred_at_str = (
        job.occurred_at.isoformat() if job.occurred_at
        else datetime.now(tz=timezone.utc).isoformat()
    )

    job_failed = False
    global_data = event_data.get("data", {}) or {}

    # f) Process each audience
    audiences = event_data.get("audiences", {})
    if not audiences:
        # Fallback to legacy recipients mapped to "default" audience, should be handled in API but fallback here just in case
        legacy_recipients = event_data.get("recipients", [])
        if legacy_recipients:
            audiences = {"default": legacy_recipients}

    for audience_key, recipients in audiences.items():
        # Find matching rule
        rule = next((r for r in published_version.audience_rules if r.audience_key == audience_key), None)
        if not rule:
            logger.warning(f"No audience rule found for key '{audience_key}' in workflow '{job.workflow_key}'")
            job_failed = True
            for recipient in recipients:
                recip_id = recipient.get("user_id") or recipient.get("recipient_id") or "unknown"
                delivery = DeliveryAttempt(
                    id=uuid.uuid4(),
                    job_id=job_uuid,
                    recipient_id=recip_id,
                    channel="unknown",
                    status="failed",
                    error_message=f"Configuration Error: No audience rule configured for audience '{audience_key}'",
                    attempt_count=1,
                    payload_data={}
                )
                db.add(delivery)
            continue

        enabled_channels: set[str] = set(rule.channels or [])
        if not enabled_channels:
            enabled_channels = {t.channel for t in rule.templates}

        email_tmpl = next((t for t in rule.templates if t.channel == "email"), None)
        in_app_tmpl = next((t for t in rule.templates if t.channel == "in_app"), None)

        for recipient in recipients:
            recip_data = recipient.get("data", {}) or {}
            context = {**global_data, **recip_data}

            recip_id = recipient.get("user_id") or recipient.get("recipient_id") or "unknown"
            to_email = recipient.get("email") or recip_id

            context.setdefault("user_id", recip_id)
            context.setdefault("recipient_id", recip_id)
            context.setdefault("email", to_email)

            delivery_uuid = uuid.uuid4()
            delivery_id_str = str(delivery_uuid)

            # ── EMAIL CHANNEL ────────────────────────────────────────────────────
            if "email" in enabled_channels and email_tmpl:
                subject = ""
                html_body = ""
                try:
                    subject = render_template(email_tmpl.subject or "", context)
                    html_body = render_template(email_tmpl.html_body or "", context)
                    text_body = render_template(email_tmpl.text_body or "", context)

                    from_addr = (env.sender_email if env and env.sender_email else "noreply@notifyhub.dev")
                    email_key = (env.resend_api_key if env and env.resend_api_key else "mock_key")

                    await send_email(
                        to_email=to_email,
                        subject=subject,
                        html_body=html_body,
                        text_body=text_body,
                        from_address=from_addr,
                        api_key=email_key,
                    )

                    delivery = DeliveryAttempt(
                        id=uuid.uuid4(),
                        job_id=job_uuid,
                        recipient_id=recip_id,
                        channel="email",
                        status="success",
                        attempt_count=1,
                        payload_data={"subject": subject, "body": html_body}
                    )
                except Exception as exc:
                    job_failed = True
                    logger.exception(f"Failed email delivery for {recip_id} (audience {audience_key}): {exc}")
                    delivery = DeliveryAttempt(
                        id=uuid.uuid4(),
                        job_id=job_uuid,
                        recipient_id=recip_id,
                        channel="email",
                        status="failed",
                        error_message=str(exc),
                        attempt_count=1,
                        payload_data={"subject": subject, "body": html_body}
                    )
                db.add(delivery)

            # ── IN-APP CHANNEL ───────────────────────────────────────────────────
            if "in_app" in enabled_channels and in_app_tmpl:
                title = ""
                body = ""
                try:
                    title = render_template(in_app_tmpl.in_app_title or "", context)
                    body = render_template(in_app_tmpl.in_app_body or "", context)
                    action_label = render_template(in_app_tmpl.action_label or "", context)
                    action_url = render_template(in_app_tmpl.action_url or "", context)

                    webhook_payload = {
                        "delivery_id": delivery_id_str,
                        "event_id": job.event_id,
                        "application_key": app_key,
                        "environment": env_name,
                        "workflow_key": job.workflow_key,
                        "recipient": {
                            "user_id": recip_id
                        },
                        "occurred_at": occurred_at_str,
                        "content": {
                            "title": title,
                            "body": body,
                            # Keep presentation in the consuming app.  This structured context
                            # lets it localise dates/times and style fields without parsing text.
                            "data": context,
                            "action_label": action_label or None,
                            "action_url": action_url or None,
                        }
                    }

                    await send_in_app(
                        webhook_url=webhook_url,
                        secret=webhook_secret,
                        payload=webhook_payload,
                    )

                    delivery = DeliveryAttempt(
                        id=uuid.uuid4(),
                        job_id=job_uuid,
                        recipient_id=recip_id,
                        channel="in_app",
                        status="success",
                        attempt_count=1,
                        payload_data={"title": title, "body": body, "action_label": action_label}
                    )
                except Exception as exc:
                    job_failed = True
                    logger.exception(f"Failed in-app delivery for {recip_id} (audience {audience_key}): {exc}")
                    delivery = DeliveryAttempt(
                        id=uuid.uuid4(),
                        job_id=job_uuid,
                        recipient_id=recip_id,
                        channel="in_app",
                        status="failed",
                        error_message=str(exc),
                        attempt_count=1,
                        payload_data={"title": title, "body": body}
                    )
                db.add(delivery)

    # g) Mark job complete/failed
    job.status = "failed" if job_failed else "completed"
    await db.commit()

    return {"status": job.status, "job_id": str(job.id)}


@celery_app.task(bind=True, max_retries=5, acks_late=True)
def process_notification_job(self, job_id: str, event_data: dict, db: AsyncSession | None = None):
    """
    Celery task wrapper around async_process_notification_job.

    Channel gating: Only delivers to channels listed in `published_version.channels`.
    Recipient identity: Uses `user_id` from the recipient object.
    Webhook contract: Full delivery contract payload with delivery_id, event_id, etc.
    """
    logger.info(f"Processing notification job {job_id} for workflow {event_data.get('workflow')}")

    try:
        loop = asyncio.get_running_loop()
    except RuntimeError:
        loop = None

    if loop and loop.is_running():
        import concurrent.futures
        with concurrent.futures.ThreadPoolExecutor() as executor:
            future = executor.submit(asyncio.run, async_process_notification_job(job_id, event_data, db=db))
            return future.result()
    else:
        return asyncio.run(async_process_notification_job(job_id, event_data, db=db))
