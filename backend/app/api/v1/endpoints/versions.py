from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.workflow import Workflow, WorkflowVersion, AudienceRule
from app.schemas.workflow import WorkflowVersionCreate, WorkflowVersionResponse

router = APIRouter()


@router.post(
    "/workflows/{workflow_id}/versions",
    response_model=WorkflowVersionResponse,
    status_code=status.HTTP_201_CREATED
)
async def create_workflow_version(
    workflow_id: UUID,
    payload: WorkflowVersionCreate,
    db: AsyncSession = Depends(get_db),
):
    wf_stmt = select(Workflow).where(Workflow.id == workflow_id)
    wf_obj = (await db.execute(wf_stmt)).scalar_one_or_none()
    if not wf_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    max_stmt = select(func.max(WorkflowVersion.version_number)).where(
        WorkflowVersion.workflow_id == workflow_id
    )
    max_res = await db.execute(max_stmt)
    current_max = max_res.scalar() or 0
    new_version_number = current_max + 1

    # Serialize variables_schema to list of dicts for JSON storage
    variables_schema_data = None
    if payload.variables_schema is not None:
        variables_schema_data = [v.model_dump() for v in payload.variables_schema]

    new_version = WorkflowVersion(
        workflow_id=workflow_id,
        version_number=new_version_number,
        status="draft",
        variables_schema=variables_schema_data,
    )
    db.add(new_version)
    await db.commit()

    stmt = (
        select(WorkflowVersion)
        .options(selectinload(WorkflowVersion.audience_rules))
        .where(WorkflowVersion.id == new_version.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.get("/workflows/{workflow_id}/versions", response_model=list[WorkflowVersionResponse])
async def list_workflow_versions(
    workflow_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    wf_stmt = select(Workflow).where(Workflow.id == workflow_id)
    wf_obj = (await db.execute(wf_stmt)).scalar_one_or_none()
    if not wf_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow not found",
        )

    stmt = (
        select(WorkflowVersion)
        .options(selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates))
        .where(WorkflowVersion.workflow_id == workflow_id)
        .order_by(WorkflowVersion.version_number.asc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch(
    "/versions/{version_id}",
    response_model=WorkflowVersionResponse
)
async def update_workflow_version(
    version_id: UUID,
    payload: WorkflowVersionCreate,
    db: AsyncSession = Depends(get_db),
):
    """Update channels and variables_schema on a draft version."""
    stmt = (
        select(WorkflowVersion)
        .options(selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates))
        .where(WorkflowVersion.id == version_id)
    )
    result = await db.execute(stmt)
    version = result.scalar_one_or_none()
    if not version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow version not found",
        )
    if version.status == "published":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot modify a published version. Create a new draft instead.",
        )

    if payload.channels is not None:
        version.channels = payload.channels

    if payload.variables_schema is not None:
        version.variables_schema = [v.model_dump() for v in payload.variables_schema]

    await db.commit()

    stmt = (
        select(WorkflowVersion)
        .options(selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates))
        .where(WorkflowVersion.id == version.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()


@router.post("/versions/{version_id}/publish", response_model=WorkflowVersionResponse)
async def publish_workflow_version(
    version_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(WorkflowVersion)
        .options(selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates))
        .where(WorkflowVersion.id == version_id)
    )
    result = await db.execute(stmt)
    target_version = result.scalar_one_or_none()
    if not target_version:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Workflow version not found",
        )

    # Archive any currently published version
    pub_stmt = select(WorkflowVersion).where(
        WorkflowVersion.workflow_id == target_version.workflow_id,
        WorkflowVersion.status == "published",
        WorkflowVersion.id != target_version.id,
    )
    pub_res = await db.execute(pub_stmt)
    currently_published = pub_res.scalars().all()

    for old_pub in currently_published:
        old_pub.status = "archived"

    target_version.status = "published"
    await db.commit()

    stmt = (
        select(WorkflowVersion)
        .options(selectinload(WorkflowVersion.audience_rules).selectinload(AudienceRule.templates))
        .where(WorkflowVersion.id == target_version.id)
    )
    res = await db.execute(stmt)
    return res.scalar_one()
