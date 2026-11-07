from datetime import datetime
from uuid import UUID
from pydantic import BaseModel, ConfigDict, Field, computed_field


class EnvironmentCreate(BaseModel):
    name: str = Field(..., max_length=64, description="Environment name, e.g. 'live', 'test'")
    webhook_url: str | None = Field(None, max_length=500, description="Webhook URL for in-app delivery")
    webhook_secret: str | None = Field(None, max_length=255, description="Webhook HMAC secret key")
    sender_email: str | None = Field(None, max_length=255, description="From email address, e.g. notifications@cphub.com")
    resend_api_key: str | None = Field(None, max_length=255, description="Resend/SMTP Provider API key")


class EnvironmentUpdate(BaseModel):
    name: str | None = Field(None, max_length=64, description="Environment name")
    webhook_url: str | None = Field(None, max_length=500, description="Webhook URL")
    webhook_secret: str | None = Field(None, max_length=255, description="Webhook HMAC secret key")
    sender_email: str | None = Field(None, max_length=255, description="From email address")
    resend_api_key: str | None = Field(None, max_length=255, description="Resend/SMTP Provider API key")


class EnvironmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    application_id: UUID
    name: str
    api_key_hash: str | None = Field(default=None, exclude=True)
    webhook_url: str | None = None
    webhook_secret: str | None = Field(default=None, exclude=True)
    sender_email: str | None = None
    resend_api_key: str | None = Field(default=None, exclude=True)
    is_active: bool
    created_at: datetime
    updated_at: datetime

    @computed_field
    @property
    def has_api_key(self) -> bool:
        return bool(self.api_key_hash)

    @computed_field
    @property
    def has_webhook_secret(self) -> bool:
        return bool(self.webhook_secret)

    @computed_field
    @property
    def has_resend_api_key(self) -> bool:
        return bool(self.resend_api_key)


class ApplicationCreate(BaseModel):
    name: str = Field(..., max_length=120, description="Unique application name")
    description: str | None = Field(None, description="Application description")


class ApplicationUpdate(BaseModel):
    name: str | None = Field(None, max_length=120, description="Updated application name")
    description: str | None = Field(None, description="Updated application description")


class ApplicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: str | None = None
    environments: list[EnvironmentResponse] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime


class ApiKeyCreateResponse(BaseModel):
    raw_key: str = Field(..., description="Plaintext API key formatted as {env_id}.{secret}")
    environment_id: UUID
    created_at: datetime
