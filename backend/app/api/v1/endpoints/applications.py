import secrets
from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.security import get_api_key_hash
from app.db.session import get_db
from app.models.application import Application, ApplicationEnvironment
from app.schemas.application import (
    ApiKeyCreateResponse,
    ApplicationCreate,
    ApplicationResponse,
    ApplicationUpdate,
    EnvironmentCreate,
    EnvironmentResponse,
    EnvironmentUpdate,
)

router = APIRouter()


@router.post("/applications", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    payload: ApplicationCreate,
    db: AsyncSession = Depends(get_db),
):
    existing_stmt = select(Application).where(Application.name == payload.name)
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Application with name '{payload.name}' already exists",
        )

    app_obj = Application(
        name=payload.name,
        description=payload.description,
    )
    db.add(app_obj)
    await db.flush()

    live_env = ApplicationEnvironment(
        application_id=app_obj.id,
        name="live",
        is_active=True,
    )
    test_env = ApplicationEnvironment(
        application_id=app_obj.id,
        name="test",
        is_active=True,
    )
    db.add_all([live_env, test_env])
    await db.commit()

    stmt = (
        select(Application)
        .options(selectinload(Application.environments))
        .where(Application.id == app_obj.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.get("/applications", response_model=list[ApplicationResponse])
async def list_applications(
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Application)
        .options(selectinload(Application.environments))
        .order_by(Application.created_at.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/applications/{id}", response_model=ApplicationResponse)
async def get_application(
    id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Application)
        .options(selectinload(Application.environments))
        .where(Application.id == id)
    )
    result = await db.execute(stmt)
    app_obj = result.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )
    return app_obj


@router.put("/applications/{id}", response_model=ApplicationResponse)
async def update_application(
    id: UUID,
    payload: ApplicationUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Application)
        .options(selectinload(Application.environments))
        .where(Application.id == id)
    )
    result = await db.execute(stmt)
    app_obj = result.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    update_data = payload.model_dump(exclude_unset=True)

    if "name" in update_data and update_data["name"] is not None:
        new_name = update_data["name"]
        if new_name != app_obj.name:
            dup_stmt = select(Application).where(Application.name == new_name)
            dup = (await db.execute(dup_stmt)).scalar_one_or_none()
            if dup:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=f"Application with name '{new_name}' already exists",
                )
        app_obj.name = new_name

    if "description" in update_data:
        app_obj.description = update_data["description"]

    await db.commit()
    
    stmt = (
        select(Application)
        .options(selectinload(Application.environments))
        .where(Application.id == app_obj.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete("/applications/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_application(
    id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Application).where(Application.id == id)
    result = await db.execute(stmt)
    app_obj = result.scalar_one_or_none()
    if not app_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    await db.delete(app_obj)
    await db.commit()
    return None


@router.post("/applications/{id}/environments", response_model=EnvironmentResponse, status_code=status.HTTP_201_CREATED)
async def create_environment(
    id: UUID,
    payload: EnvironmentCreate,
    db: AsyncSession = Depends(get_db),
):
    app_stmt = select(Application).where(Application.id == id)
    app_obj = (await db.execute(app_stmt)).scalar_one_or_none()
    if not app_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application not found",
        )

    env_obj = ApplicationEnvironment(
        application_id=id,
        name=payload.name,
        webhook_url=payload.webhook_url,
        webhook_secret=payload.webhook_secret,
        sender_email=payload.sender_email,
        resend_api_key=payload.resend_api_key,
        is_active=True,
    )
    db.add(env_obj)
    await db.commit()
    await db.refresh(env_obj)
    return env_obj


@router.put("/environments/{env_id}", response_model=EnvironmentResponse)
async def update_environment(
    env_id: UUID,
    payload: EnvironmentUpdate,
    db: AsyncSession = Depends(get_db),
):
    """Update an existing environment's settings, webhook URL, sender email, or provider keys."""
    env_stmt = select(ApplicationEnvironment).where(ApplicationEnvironment.id == env_id)
    env_obj = (await db.execute(env_stmt)).scalar_one_or_none()
    if not env_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(env_obj, field, value)

    await db.commit()
    await db.refresh(env_obj)
    return env_obj


@router.post("/environments/{env_id}/api-keys", response_model=ApiKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def generate_api_key(
    env_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    env_stmt = select(ApplicationEnvironment).where(ApplicationEnvironment.id == env_id)
    env_obj = (await db.execute(env_stmt)).scalar_one_or_none()
    if not env_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Environment not found",
        )

    secret = secrets.token_urlsafe(32)
    key_hash = get_api_key_hash(secret)
    env_obj.api_key_hash = key_hash
    await db.commit()

    raw_key = f"{env_id}.{secret}"
    now = datetime.now(timezone.utc)
    return ApiKeyCreateResponse(
        raw_key=raw_key,
        environment_id=env_id,
        created_at=now,
    )
