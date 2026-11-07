from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.workflow import Template, AudienceRule
from app.schemas.workflow import TemplateCreate, TemplateResponse, TemplateUpdate

router = APIRouter()


@router.post("/audiences/{audience_id}/templates", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_or_update_template(
    audience_id: UUID,
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
):
    rule_stmt = select(AudienceRule).where(AudienceRule.id == audience_id)
    rule_obj = (await db.execute(rule_stmt)).scalar_one_or_none()
    if not rule_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audience rule not found",
        )

    if payload.channel not in ("email", "in_app"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported channel '{payload.channel}'. Allowed channels: 'email', 'in_app'",
        )

    existing_stmt = select(Template).where(
        Template.audience_rule_id == audience_id,
        Template.channel == payload.channel,
    )
    existing = (await db.execute(existing_stmt)).scalar_one_or_none()

    if existing:
        update_data = payload.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            if field != "channel":
                setattr(existing, field, value)
        tmpl = existing
    else:
        tmpl = Template(
            audience_rule_id=audience_id,
            channel=payload.channel,
            subject=payload.subject,
            html_body=payload.html_body,
            text_body=payload.text_body,
            in_app_title=payload.in_app_title,
            in_app_body=payload.in_app_body,
            action_label=payload.action_label,
            action_url=payload.action_url,
        )
        db.add(tmpl)

    await db.commit()
    await db.refresh(tmpl)
    return tmpl


@router.get("/audiences/{audience_id}/templates", response_model=list[TemplateResponse])
async def list_templates_for_audience(
    audience_id: UUID,
    db: AsyncSession = Depends(get_db),
):
    rule_stmt = select(AudienceRule).where(AudienceRule.id == audience_id)
    rule_obj = (await db.execute(rule_stmt)).scalar_one_or_none()
    if not rule_obj:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Audience rule not found",
        )

    stmt = select(Template).where(Template.audience_rule_id == audience_id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.put("/templates/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: UUID,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Template).where(Template.id == template_id)
    result = await db.execute(stmt)
    tmpl = result.scalar_one_or_none()
    if not tmpl:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Template not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    if "channel" in update_data and update_data["channel"] is not None:
        if update_data["channel"] not in ("email", "in_app"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Invalid template channel",
            )

    for field, value in update_data.items():
        setattr(tmpl, field, value)

    await db.commit()
    await db.refresh(tmpl)
    return tmpl

