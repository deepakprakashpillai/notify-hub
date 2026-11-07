"""Persist notification dispatch intent for broker outage recovery.

Revision ID: b23f4a610001
Revises: a70af1d07118
"""
from alembic import op
import sqlalchemy as sa

revision = "b23f4a610001"
down_revision = "a70af1d07118"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("notification_jobs", sa.Column("event_payload", sa.JSON(), nullable=True))
    op.add_column("notification_jobs", sa.Column("routing_key", sa.String(length=160), nullable=True))
    op.add_column("notification_jobs", sa.Column("dispatched_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_notification_jobs_dispatch", "notification_jobs", ["dispatched_at", "created_at"])


def downgrade() -> None:
    op.drop_index("ix_notification_jobs_dispatch", table_name="notification_jobs")
    op.drop_column("notification_jobs", "dispatched_at")
    op.drop_column("notification_jobs", "routing_key")
    op.drop_column("notification_jobs", "event_payload")
