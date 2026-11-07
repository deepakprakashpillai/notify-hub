from fastapi import APIRouter

from .endpoints import applications, events, monitoring, templates, versions, workflows, audiences

router = APIRouter()
router.include_router(applications.router, tags=["applications"])
router.include_router(workflows.router, tags=["workflows"])
router.include_router(versions.router, tags=["versions"])
router.include_router(audiences.router, tags=["audiences"])
router.include_router(templates.router, tags=["templates"])
router.include_router(events.router, prefix="/events", tags=["events"])
router.include_router(monitoring.router, tags=["monitoring"])
