from uuid import UUID
from typing import Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.db.session import get_db
from app.models.delivery import DeliveryAttempt, NotificationJob
from app.schemas.monitoring import MonitoringListResponse, NotificationJobResponse

router = APIRouter()


@router.get("/monitoring/jobs", response_model=MonitoringListResponse)
async def list_notification_jobs(
    environment_id: Optional[UUID] = Query(None, description="Filter by environment"),
    workflow_key: Optional[str] = Query(None, description="Filter by workflow key"),
    status: Optional[str] = Query(None, description="Filter by job status: pending, processing, completed, failed"),
    event_id: Optional[str] = Query(None, description="Search by exact event_id"),
    limit: int = Query(50, ge=1, le=200, description="Number of results to return"),
    offset: int = Query(0, ge=0, description="Pagination offset"),
    db: AsyncSession = Depends(get_db),
):
    """List notification jobs with optional filters and delivery attempts nested."""
    base_stmt = (
        select(NotificationJob)
        .options(selectinload(NotificationJob.deliveries))
        .order_by(NotificationJob.created_at.desc())
    )

    # Apply filters
    if environment_id is not None:
        base_stmt = base_stmt.where(NotificationJob.environment_id == environment_id)
    if workflow_key:
        base_stmt = base_stmt.where(NotificationJob.workflow_key == workflow_key)
    if status:
        base_stmt = base_stmt.where(NotificationJob.status == status)
    if event_id:
        base_stmt = base_stmt.where(NotificationJob.event_id == event_id)

    # Count total for pagination metadata
    count_stmt = select(func.count()).select_from(base_stmt.subquery())
    total = (await db.execute(count_stmt)).scalar() or 0

    # Paginate
    paginated_stmt = base_stmt.offset(offset).limit(limit)
    result = await db.execute(paginated_stmt)
    jobs = result.scalars().all()

    return MonitoringListResponse(total=total, items=jobs)
