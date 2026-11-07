"""Add priority, channels, action_label, occurred_at

Revision ID: a1b2c3d4e5f6
Revises: dc0a1a77bbb8
Create Date: 2026-07-27 21:56:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, Sequence[str], None] = 'dc0a1a77bbb8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Add new columns for Phase 2: workflow customizability."""
    # workflows.priority — delivery queue priority, defaults to 'default'
    op.add_column(
        'workflows',
        sa.Column('priority', sa.String(length=16), nullable=False, server_default='default')
    )

    # workflow_versions.channels — JSON list of enabled channels, e.g. ["email", "in_app"]
    op.add_column(
        'workflow_versions',
        sa.Column('channels', sa.JSON(), nullable=True)
    )

    # templates.action_label — CTA button label for in-app notifications
    op.add_column(
        'templates',
        sa.Column('action_label', sa.String(length=120), nullable=True)
    )

    # notification_jobs.occurred_at — when the source business event occurred
    op.add_column(
        'notification_jobs',
        sa.Column('occurred_at', sa.DateTime(timezone=True), nullable=True)
    )


def downgrade() -> None:
    """Reverse Phase 2 column additions."""
    op.drop_column('notification_jobs', 'occurred_at')
    op.drop_column('templates', 'action_label')
    op.drop_column('workflow_versions', 'channels')
    op.drop_column('workflows', 'priority')
