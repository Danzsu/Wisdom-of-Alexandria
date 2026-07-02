import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.prompt_template import (
    PromptTemplateCreate,
    PromptTemplateRead,
    PromptTemplateUpdate,
    PromptTemplateUseResult,
)
from app.services.crud_prompt_template import (
    create_prompt_template,
    delete_prompt_template,
    get_prompt_template,
    increment_prompt_template_uses,
    list_prompt_templates,
    update_prompt_template,
)

# GLOBAL (workspace-wide) router — no project scope in the URL.
router = APIRouter(prefix="/prompt-templates", tags=["prompt_templates"])

_NOT_FOUND = "Prompt template not found"
_BUILTIN_PROTECTED = "Built-in prompt templates cannot be edited or deleted"


@router.get("", response_model=list[PromptTemplateRead])
async def list_all(
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[PromptTemplateRead]:
    return await list_prompt_templates(db, category=category)


@router.get("/{template_id}", response_model=PromptTemplateRead)
async def get_one(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> PromptTemplateRead:
    template = await get_prompt_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)
    return template


@router.post("", response_model=PromptTemplateRead, status_code=status.HTTP_201_CREATED)
async def create(
    data: PromptTemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> PromptTemplateRead:
    return await create_prompt_template(db, data)


@router.patch("/{template_id}", response_model=PromptTemplateRead)
async def update(
    template_id: uuid.UUID,
    data: PromptTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> PromptTemplateRead:
    template = await get_prompt_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)
    if template.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_BUILTIN_PROTECTED
        )
    return await update_prompt_template(db, template, data)


@router.post("/{template_id}/use", response_model=PromptTemplateUseResult)
async def use(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> PromptTemplateUseResult:
    """Register one application of the template (applied/copied in the UI).

    Atomically increments ``uses`` and returns the new count. Works for
    builtins too — usage tracking is not an edit, so the builtin write
    protection (403 on PATCH/DELETE) deliberately does not apply here.
    """
    new_uses = await increment_prompt_template_uses(db, template_id)
    if new_uses is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)
    return PromptTemplateUseResult(uses=new_uses)


@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    template_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    template = await get_prompt_template(db, template_id)
    if template is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=_NOT_FOUND)
    if template.is_builtin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN, detail=_BUILTIN_PROTECTED
        )
    await delete_prompt_template(db, template)
