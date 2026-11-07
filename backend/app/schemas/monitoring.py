from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


class DeliveryAttemptResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    job_id: UUID
    recipient_id: str
    channel: str
    status: str
    error_message: str | None = None
    attempt_count: int
    created_at: datetime
    updated_at: datetime


class NotificationJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    environment_id: UUID
    event_id: str
    workflow_key: str
    status: str
    occurred_at: datetime | None = None
    deliveries: list[DeliveryAttemptResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class MonitoringListResponse(BaseModel):
    total: int
    items: list[NotificationJobResponse]
