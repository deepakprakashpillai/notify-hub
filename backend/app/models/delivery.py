from datetime import datetime
from sqlalchemy import ForeignKey, Integer, JSON, String, Text, DateTime
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class NotificationJob(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notification_jobs"

    environment_id: Mapped[str] = mapped_column(
        ForeignKey("application_environments.id", ondelete="CASCADE"), nullable=False
    )
    event_id: Mapped[str] = mapped_column(String(120), nullable=False)
    workflow_key: Mapped[str] = mapped_column(String(120), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending"
    )  # 'pending', 'processing', 'completed', 'failed'
    # When the source business event actually occurred (supplied by source app).
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    deliveries: Mapped[list["DeliveryAttempt"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class DeliveryAttempt(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "delivery_attempts"

    job_id: Mapped[str] = mapped_column(
        ForeignKey("notification_jobs.id", ondelete="CASCADE"), nullable=False
    )
    recipient_id: Mapped[str] = mapped_column(String(120), nullable=False)  # user_id from source app
    channel: Mapped[str] = mapped_column(String(64), nullable=False)
    status: Mapped[str] = mapped_column(
        String(32), nullable=False, default="pending"
    )  # 'pending', 'success', 'failed', 'dead_letter'
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    attempt_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    next_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    payload_data: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    job: Mapped["NotificationJob"] = relationship(back_populates="deliveries")
