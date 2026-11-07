import os
from typing import Literal
from pydantic import model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    PROJECT_NAME: str = "Notify Hub"
    ENVIRONMENT: Literal["development", "test", "production"] = "development"
    ADMIN_USERNAME: str = ""
    ADMIN_PASSWORD: str = ""

    @model_validator(mode="after")
    def require_admin_credentials(self):
        if self.ENVIRONMENT == "production" and (
            not self.ADMIN_USERNAME or len(self.ADMIN_PASSWORD) < 32
        ):
            raise ValueError("Production requires an admin username and a password of at least 32 characters")
        return self
    
    # DB
    POSTGRES_SERVER: str = os.getenv("POSTGRES_SERVER", "localhost")
    POSTGRES_USER: str = os.getenv("POSTGRES_USER", "notifyhub")
    POSTGRES_PASSWORD: str = os.getenv("POSTGRES_PASSWORD", "notifyhub_password")
    POSTGRES_DB: str = os.getenv("POSTGRES_DB", "notifyhub_db")
    POSTGRES_PORT: str = os.getenv("POSTGRES_PORT", "5433")
    
    @property
    def sqlalchemy_database_uri(self) -> str:
        return f"postgresql+asyncpg://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
    
    @property
    def sync_sqlalchemy_database_uri(self) -> str:
        return f"postgresql://{self.POSTGRES_USER}:{self.POSTGRES_PASSWORD}@{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"

    # RabbitMQ
    RABBITMQ_URL: str = os.getenv("RABBITMQ_URL", "amqp://notifyhub:notifyhub_password@localhost:5672//")
    
    model_config = SettingsConfigDict(env_file=".env", case_sensitive=True)

settings = Settings()
