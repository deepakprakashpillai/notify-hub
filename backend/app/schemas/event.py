from datetime import datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, Field


class RecipientSchema(BaseModel):
    # user_id is the canonical identifier — opaque from Notify Hub's perspective.
    # The source application owns user identity; this is just a reference key.
    user_id: str = Field(..., description="Opaque user identifier from the source application")
    email: str | None = Field(None, description="Email address — required for email channel delivery")
    phone: str | None = Field(None, description="Phone number (E.164 format) — reserved for future SMS/WhatsApp channel")
    locale: str | None = Field(None, description="BCP-47 locale tag, e.g. 'en-IN' — reserved for future locale-aware rendering")
    timezone: str | None = Field(None, description="IANA timezone string, e.g. 'Asia/Kolkata' — reserved for quiet-hours scheduling")
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Per-recipient personalization variables merged into the Jinja context"
    )


class EventIngestionRequest(BaseModel):
    event_id: str = Field(..., description="Unique source event ID — used for idempotency deduplication")
    workflow: str = Field(..., description="Workflow key to trigger, e.g. 'student.class_rescheduled'")
    recipients: list[RecipientSchema] | None = Field(None, description="Legacy: flat list of recipients (mapped to 'default' audience)")
    audiences: dict[str, list[RecipientSchema]] | None = Field(None, description="Recipients grouped by audience key")
    data: dict[str, Any] = Field(
        default_factory=dict,
        description="Global event-level variables merged into the Jinja context (recipient data takes precedence)"
    )
    # Optional priority override. Capped at the workflow's own priority level.
    # e.g. if workflow is 'default', sending 'high' here will be treated as 'default'.
    priority: Literal["high", "default", "low"] | None = Field(
        None,
        description="Suggested delivery priority. Capped by the workflow's configured priority."
    )
    occurred_at: datetime | None = Field(
        None,
        description="When the source business event occurred. Defaults to ingestion time if omitted."
    )


class EventIngestionResponse(BaseModel):
    job_id: str | UUID | None = None
    status: str = "accepted"
    message: str | None = None
    event_id: str | None = None
