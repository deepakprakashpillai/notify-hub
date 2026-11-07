from datetime import datetime
from typing import Any, Literal
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field


# ─── Template Schemas ───────────────────────────────────────────────────────

class TemplateCreate(BaseModel):
    channel: str = Field(..., max_length=64, description="Channel type: 'email' or 'in_app'")
    # Email fields
    subject: str | None = Field(None, max_length=255, description="Email subject Jinja2 template")
    html_body: str | None = Field(None, description="Email HTML body Jinja2 template")
    text_body: str | None = Field(None, description="Email plain-text body Jinja2 template")
    # In-App fields
    in_app_title: str | None = Field(None, max_length=255, description="In-app notification title Jinja2 template")
    in_app_body: str | None = Field(None, description="In-app notification body Jinja2 template")
    action_label: str | None = Field(None, max_length=120, description="In-app CTA button label, e.g. 'View Classes'")
    action_url: str | None = Field(None, max_length=500, description="In-app CTA action URL Jinja2 template")


class TemplateUpdate(BaseModel):
    channel: str | None = Field(None, max_length=64)
    subject: str | None = Field(None, max_length=255)
    html_body: str | None = None
    text_body: str | None = None
    in_app_title: str | None = Field(None, max_length=255)
    in_app_body: str | None = None
    action_label: str | None = Field(None, max_length=120)
    action_url: str | None = Field(None, max_length=500)


class TemplateResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    audience_rule_id: UUID
    channel: str
    subject: str | None = None
    html_body: str | None = None
    text_body: str | None = None
    in_app_title: str | None = None
    in_app_body: str | None = None
    action_label: str | None = None
    action_url: str | None = None
    created_at: datetime
    updated_at: datetime

# ─── Audience Rule Schemas ───────────────────────────────────────────────────

class AudienceRuleCreate(BaseModel):
    audience_key: str = Field(..., max_length=120, description="Target audience key, e.g. 'student', 'teacher'")
    channels: list[str] = Field(
        default_factory=lambda: ["in_app"],
        description="Enabled delivery channels for this audience: e.g. ['email', 'in_app']"
    )
    priority: Literal["high", "default", "low"] | None = Field(
        None, description="Optional delivery priority override for this audience"
    )

class AudienceRuleUpdate(BaseModel):
    channels: list[str] | None = None
    priority: Literal["high", "default", "low"] | None = None

class AudienceRuleResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    version_id: UUID
    audience_key: str
    channels: list[str] | None = None
    priority: str | None = None
    templates: list[TemplateResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ─── Workflow Version Schemas ────────────────────────────────────────────────

class VariableDefinition(BaseModel):
    """A single declared variable for a workflow version's schema."""
    name: str = Field(..., description="Variable name as used in Jinja templates, e.g. 'student_name'")
    description: str | None = Field(None, description="Human-readable explanation of this variable")
    required: bool = Field(True, description="Whether this variable must be present in the event payload")
    example: str | None = Field(None, description="Example value — used to auto-generate the test preview payload")


class WorkflowVersionCreate(BaseModel):
    variables_schema: list[VariableDefinition] | None = Field(
        None,
        description="Declared variables for this workflow version. Extra payload fields are accepted but not validated."
    )


class WorkflowVersionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    workflow_id: UUID
    version_number: int
    status: str
    variables_schema: list[dict[str, Any]] | None = None
    audience_rules: list[AudienceRuleResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


# ─── Workflow Group Schemas ──────────────────────────────────────────────────

class WorkflowGroupCreate(BaseModel):
    name: str = Field(..., max_length=255, description="Group name, e.g. 'Classes'")
    description: str | None = Field(None, description="Optional description of the group")
    sort_order: int = Field(0, description="Order index for UI sorting")

class WorkflowGroupUpdate(BaseModel):
    name: str | None = Field(None, max_length=255)
    description: str | None = None
    sort_order: int | None = None

class WorkflowGroupResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    environment_id: UUID
    name: str
    description: str | None = None
    sort_order: int
    created_at: datetime
    updated_at: datetime


# ─── Workflow Schemas ────────────────────────────────────────────────────────

_VALID_PRIORITIES = {"high", "default", "low"}


class WorkflowCreate(BaseModel):
    environment_id: UUID = Field(..., description="ID of target application environment")
    group_id: UUID | None = Field(None, description="ID of the workflow group this belongs to")
    key: str = Field(..., max_length=120, description="Workflow identifier key, e.g. 'student.class_rescheduled'")
    name: str = Field(..., max_length=255, description="Human-readable workflow name")
    is_active: bool = Field(True, description="Whether workflow is active")
    priority: Literal["high", "default", "low"] = Field(
        "default",
        description="Delivery priority controlling which Celery queue is used"
    )


class WorkflowUpdate(BaseModel):
    group_id: UUID | None = Field(None, description="ID of the workflow group this belongs to")
    name: str | None = Field(None, max_length=255)
    is_active: bool | None = None
    priority: Literal["high", "default", "low"] | None = None


class WorkflowResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    environment_id: UUID
    group_id: UUID | None = None
    key: str
    name: str
    is_active: bool
    priority: str
    versions: list[WorkflowVersionResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime
