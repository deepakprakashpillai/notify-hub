from sqlalchemy import Boolean, ForeignKey, Integer, JSON, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDPrimaryKeyMixin


class WorkflowGroup(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workflow_groups"

    environment_id: Mapped[str] = mapped_column(
        ForeignKey("application_environments.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    workflows: Mapped[list["Workflow"]] = relationship(
        back_populates="group"
    )


class Workflow(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workflows"

    environment_id: Mapped[str] = mapped_column(
        ForeignKey("application_environments.id", ondelete="CASCADE"), nullable=False
    )
    group_id: Mapped[str | None] = mapped_column(
        ForeignKey("workflow_groups.id", ondelete="SET NULL"), nullable=True
    )
    key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)  # e.g., 'student.class_rescheduled'
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    # Delivery priority: 'high', 'default', 'low' — determines which Celery queue is used.
    # Source apps may suggest a priority per-event, but it is capped at this value.
    priority: Mapped[str] = mapped_column(String(16), nullable=False, default="default")

    group: Mapped["WorkflowGroup | None"] = relationship(back_populates="workflows")

    versions: Mapped[list["WorkflowVersion"]] = relationship(
        back_populates="workflow", cascade="all, delete-orphan"
    )


class WorkflowVersion(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "workflow_versions"

    workflow_id: Mapped[str] = mapped_column(
        ForeignKey("workflows.id", ondelete="CASCADE"), nullable=False
    )
    version_number: Mapped[int] = mapped_column(nullable=False)
    status: Mapped[str] = mapped_column(String(32), nullable=False, default="draft")  # 'draft', 'published', 'archived'
    variables_schema: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    workflow: Mapped["Workflow"] = relationship(back_populates="versions")
    audience_rules: Mapped[list["AudienceRule"]] = relationship(
        back_populates="workflow_version", cascade="all, delete-orphan"
    )


class AudienceRule(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audience_rules"

    version_id: Mapped[str] = mapped_column(
        ForeignKey("workflow_versions.id", ondelete="CASCADE"), nullable=False
    )
    audience_key: Mapped[str] = mapped_column(String(120), nullable=False, default="default")
    channels: Mapped[list | None] = mapped_column(JSON, nullable=True)
    priority: Mapped[str | None] = mapped_column(String(16), nullable=True)

    workflow_version: Mapped["WorkflowVersion"] = relationship(back_populates="audience_rules")
    templates: Mapped[list["Template"]] = relationship(
        back_populates="audience_rule", cascade="all, delete-orphan"
    )


class Template(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "templates"

    audience_rule_id: Mapped[str] = mapped_column(
        ForeignKey("audience_rules.id", ondelete="CASCADE"), nullable=False
    )
    channel: Mapped[str] = mapped_column(String(64), nullable=False)  # 'email', 'in_app'

    # Email specific
    subject: Mapped[str | None] = mapped_column(String(255), nullable=True)
    html_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    text_body: Mapped[str | None] = mapped_column(Text, nullable=True)

    # In-App specific
    in_app_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    in_app_body: Mapped[str | None] = mapped_column(Text, nullable=True)
    action_label: Mapped[str | None] = mapped_column(String(120), nullable=True)   # CTA button label, e.g. "View Classes"
    action_url: Mapped[str | None] = mapped_column(String(500), nullable=True)

    audience_rule: Mapped["AudienceRule"] = relationship(back_populates="templates")
