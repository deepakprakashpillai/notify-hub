"""add audience rules

Revision ID: 3a0e7104ee42
Revises: 4ce0a0468194
Create Date: 2026-07-28 22:10:15.847454

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '3a0e7104ee42'
down_revision: Union[str, Sequence[str], None] = '4ce0a0468194'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 1. Create audience_rules table
    op.create_table(
        'audience_rules',
        sa.Column('id', sa.UUID(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('version_id', sa.UUID(), nullable=False),
        sa.Column('audience_key', sa.String(length=120), nullable=False, server_default='default'),
        sa.Column('channels', sa.JSON(), nullable=True),
        sa.Column('priority', sa.String(length=16), nullable=True),
        sa.ForeignKeyConstraint(['version_id'], ['workflow_versions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id')
    )

    # 2. Add audience_rule_id to templates
    op.add_column('templates', sa.Column('audience_rule_id', sa.UUID(), nullable=True))
    op.create_foreign_key('fk_templates_audience_rule_id', 'templates', 'audience_rules', ['audience_rule_id'], ['id'], ondelete='CASCADE')

    # 3. Data migration
    conn = op.get_bind()
    import uuid
    from datetime import datetime, timezone
    
    # Get all workflow versions
    versions = conn.execute(sa.text("SELECT id, channels FROM workflow_versions")).fetchall()
    
    for version_id, channels in versions:
        rule_id = uuid.uuid4()
        now = datetime.now(timezone.utc)
        
        # Insert a default audience rule
        conn.execute(
            sa.text("""
                INSERT INTO audience_rules (id, created_at, updated_at, version_id, audience_key, channels)
                VALUES (:id, :created_at, :updated_at, :version_id, :audience_key, :channels)
            """),
            {
                "id": rule_id,
                "created_at": now,
                "updated_at": now,
                "version_id": version_id,
                "audience_key": "default",
                "channels": channels
            }
        )
        
        # Link templates to the new audience rule
        conn.execute(
            sa.text("UPDATE templates SET audience_rule_id = :rule_id WHERE version_id = :version_id"),
            {"rule_id": rule_id, "version_id": version_id}
        )

    # 4. Make audience_rule_id non-nullable, drop version_id
    # Note: sqlite requires careful dropping, but assuming we can just alter column (if postgres) or use batch_alter_table for sqlite.
    with op.batch_alter_table('templates') as batch_op:
        batch_op.alter_column('audience_rule_id', nullable=False)
        batch_op.drop_constraint('templates_version_id_fkey', type_='foreignkey')
        batch_op.drop_column('version_id')

    # 5. Drop channels from workflow_versions
    with op.batch_alter_table('workflow_versions') as batch_op:
        batch_op.drop_column('channels')


def downgrade() -> None:
    # 1. Add version_id back to templates and channels back to workflow_versions
    op.add_column('templates', sa.Column('version_id', sa.UUID(), nullable=True))
    op.add_column('workflow_versions', sa.Column('channels', sa.JSON(), nullable=True))
    
    conn = op.get_bind()
    
    # 2. Data migration (reverse)
    # Get all default audience rules
    rules = conn.execute(sa.text("SELECT id, version_id, channels FROM audience_rules WHERE audience_key = 'default'")).fetchall()
    
    for rule_id, version_id, channels in rules:
        conn.execute(
            sa.text("UPDATE workflow_versions SET channels = :channels WHERE id = :version_id"),
            {"channels": channels, "version_id": version_id}
        )
        conn.execute(
            sa.text("UPDATE templates SET version_id = :version_id WHERE audience_rule_id = :rule_id"),
            {"version_id": version_id, "rule_id": rule_id}
        )

    with op.batch_alter_table('templates') as batch_op:
        batch_op.create_foreign_key('templates_version_id_fkey', 'workflow_versions', ['version_id'], ['id'], ondelete='CASCADE')
        batch_op.alter_column('version_id', nullable=False)
        batch_op.drop_constraint('fk_templates_audience_rule_id', type_='foreignkey')
        batch_op.drop_column('audience_rule_id')

    op.drop_table('audience_rules')
