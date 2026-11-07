from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.workflow import AudienceRule, WorkflowVersion
from app.schemas.workflow import AudienceRuleCreate, AudienceRuleResponse, AudienceRuleUpdate

router = APIRouter()


@router.post("/versions/{version_id}/audiences", response_model=AudienceRuleResponse, status_code=status.HTTP_201_CREATED)
async def create_audience_rule(
    version_id: UUID,
    payload: AudienceRuleCreate,
    db: AsyncSession = Depends(get_db),
):
    version_stmt = select(WorkflowVersion).where(WorkflowVersion.id == version_id)
    version_obj = (await db.execute(version_stmt)).scalar_one_or_none()
    if not version_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow version not found",
        )

    # Check for existing audience rule with the same key in this version
    existing_stmt = select(AudienceRule).where(
        AudienceRule.version_id == version_id,
        AudienceRule.audience_key == payload.audience_key
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Audience rule with key '{payload.audience_key}' already exists for this version.",
        )

    rule = AudienceRule(
        version_id=version_id,
        audience_key=payload.audience_key,
        channels=payload.channels,
        priority=payload.priority,
    )
    db.add(rule)
    await db.commit()

    stmt = (
        select(AudienceRule)
        .options(selectinload(AudienceRule.templates))
        .where(AudienceRule.id == rule.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/versions/{version_id}/audiences", response_model=list[AudienceRuleResponse])
async def list_audiences_for_version(
    version_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    version_stmt = select(WorkflowVersion).where(WorkflowVersion.id == version_id)
    version_obj = (await db.execute(version_stmt)).scalar_one_or_none()
    if not version_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow version not found",
        )

    stmt = (
        select(AudienceRule)
        .options(selectinload(AudienceRule.templates))
        .where(AudienceRule.version_id == version_id)
        .order_by(AudienceRule.created_at.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/audiences/{audience_id}", response_model=AudienceRuleResponse)
async def update_audience_rule(
    audience_id: UUID,
    payload: AudienceRuleUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(AudienceRule)
        .options(selectinload(AudienceRule.templates))
        .where(AudienceRule.id == audience_id)
    )
    result = await db.execute(stmt)
    rule = result.scalar_one_or_none()
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audience rule not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    await db.commit()

    # Re-fetch to ensure relationships are loaded
    stmt = (
        select(AudienceRule)
        .options(selectinload(AudienceRule.templates))
        .where(AudienceRule.id == rule.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()
