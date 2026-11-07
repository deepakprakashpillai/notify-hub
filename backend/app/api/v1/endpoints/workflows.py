from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.application import ApplicationEnvironment
from app.models.workflow import Workflow, WorkflowVersion, AudienceRule
from app.schemas.workflow import WorkflowCreate, WorkflowResponse, WorkflowUpdate

router = APIRouter()


@router.post("/workflows", response_model=WorkflowResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow(
    payload: WorkflowCreate,
    db: AsyncSession = Depends(get_db),
):
    env_stmt = select(ApplicationEnvironment).where(ApplicationEnvironment.id == payload.environment_id)
    env_obj = (await db.execute(env_stmt)).scalar_one_or_none()
    if not env_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application environment not found",
        )

    existing_stmt = select(Workflow).where(
        Workflow.environment_id == payload.environment_id,
        Workflow.key == payload.key,
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Workflow with key '{payload.key}' already exists in this environment",
        )

    workflow = Workflow(
        environment_id=payload.environment_id,
        group_id=payload.group_id,
        key=payload.key,
        name=payload.name,
        is_active=payload.is_active,
        priority=payload.priority,
    )
    db.add(workflow)
    await db.flush()

    # Create an initial draft version
    initial_version = WorkflowVersion(
        workflow_id=workflow.id,
        version_number=1,
        status="draft",
    )
    db.add(initial_version)
    await db.flush()

    await db.commit()

    stmt = (
        select(Workflow)
        .options(selectinload(Workflow.versions).selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates))
        .where(Workflow.id == workflow.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/workflows", response_model=list[WorkflowResponse])
async def list_workflows(
    environment_id: UUID | None = Query(None, description="Optional environment filter"),
    group_id: UUID | None = Query(None, description="Optional group filter"),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workflow).options(
        selectinload(Workflow.versions).selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates)
    ).order_by(Workflow.created_at.desc())

    if environment_id is not None:
        stmt = stmt.where(Workflow.environment_id == environment_id)
    if group_id is not None:
        stmt = stmt.where(Workflow.group_id == group_id)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/workflows/{id}", response_model=WorkflowResponse)
async def get_workflow(
    id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Workflow)
        .options(selectinload(Workflow.versions).selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates))
        .where(Workflow.id == id)
    )
    result = await db.execute(stmt)
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )
    return wf


@router.put("/workflows/{id}", response_model=WorkflowResponse)
async def update_workflow(
    id: UUID,
    payload: WorkflowUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(Workflow)
        .options(selectinload(Workflow.versions).selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates))
        .where(Workflow.id == id)
    )
    result = await db.execute(stmt)
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(wf, field, value)

    await db.commit()

    stmt = (
        select(Workflow)
        .options(selectinload(Workflow.versions).selectinload(WorkflowVersion.audience_rules))
        .where(Workflow.id == wf.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.delete("/workflows/{id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow(
    id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Workflow).where(Workflow.id == id)
    result = await db.execute(stmt)
    wf = result.scalar_one_or_none()
    if not wf:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    await db.delete(wf)
    await db.commit()
    return None

from app.models.workflow import WorkflowGroup
from app.schemas.workflow import WorkflowGroupCreate, WorkflowGroupUpdate, WorkflowGroupResponse

@router.post("/environments/{environment_id}/groups", response_model=WorkflowGroupResponse, status_code=status.HTTP_201_CREATED)
async def create_workflow_group(
    environment_id: UUID,
    payload: WorkflowGroupCreate,
    db: AsyncSession = Depends(get_db),
):
    env_stmt = select(ApplicationEnvironment).where(ApplicationEnvironment.id == environment_id)
    env_obj = (await db.execute(env_stmt)).scalar_one_or_none()
    if not env_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Application environment not found",
        )

    # Check uniqueness
    existing_stmt = select(WorkflowGroup).where(
        WorkflowGroup.environment_id == environment_id,
        WorkflowGroup.name == payload.name,
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Workflow group '{payload.name}' already exists in this environment",
        )

    group = WorkflowGroup(
        environment_id=environment_id,
        name=payload.name,
        description=payload.description,
        sort_order=payload.sort_order,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)
    return group

@router.get("/environments/{environment_id}/groups", response_model=list[WorkflowGroupResponse])
async def list_workflow_groups(
    environment_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WorkflowGroup).where(
        WorkflowGroup.environment_id == environment_id
    ).order_by(WorkflowGroup.sort_order.asc(), WorkflowGroup.created_at.asc())
    
    result = await db.execute(stmt)
    return result.scalars().all()

@router.patch("/groups/{group_id}", response_model=WorkflowGroupResponse)
async def update_workflow_group(
    group_id: UUID,
    payload: WorkflowGroupUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WorkflowGroup).where(WorkflowGroup.id == group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow group not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "name" in update_data and update_data["name"] != group.name:
        existing_stmt = select(WorkflowGroup).where(
            WorkflowGroup.environment_id == group.environment_id,
            WorkflowGroup.name == update_data["name"],
        )
        if (await db.execute(existing_stmt)).scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Workflow group '{update_data['name']}' already exists in this environment",
            )

    for field, value in update_data.items():
        setattr(group, field, value)

    await db.commit()
    await db.refresh(group)
    return group

@router.delete("/groups/{group_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_workflow_group(
    group_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(WorkflowGroup).where(WorkflowGroup.id == group_id)
    result = await db.execute(stmt)
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow group not found",
        )

    await db.delete(group)
    await db.commit()
    return None

