"""add_sender_email_and_resend_api_key_to_environments

Revision ID: 4ce0a0468194
Revises: a1b2c3d4e5f6
Create Date: 2026-07-27 22:46:55.631527

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '4ce0a0468194'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column(
        'application_environments',
        sa.Column('sender_email', sa.String(length=255), nullable=True)
    )
    op.add_column(
        'application_environments',
        sa.Column('resend_api_key', sa.String(length=255), nullable=True)
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('application_environments', 'resend_api_key')
    op.drop_column('application_environments', 'sender_email')
