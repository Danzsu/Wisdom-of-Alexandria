import uuid

from alexandria_core.models.plotline import Plotline
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.schemas.plotline import (
    PlotlineCreate,
    PlotlineRead,
    PlotlineSceneCreate,
    PlotlineSceneRead,
    PlotlineUpdate,
)
from app.services.crud_plotline import (
    PlotlineScopeError,
    attach_scene,
    create_plotline,
    delete_plotline,
    detach_scene,
    get_plotline,
    list_plotline_scenes,
    list_plotlines,
    update_plotline,
)
from app.services.crud_project import get_project

# Project-nested CRUD.
router = APIRouter(prefix="/projects/{project_id}/plotlines", tags=["plotlines"])

# Scene attach/detach/list is NOT naturally project-nested (a plotline already
# pins its project), so it lives under a flat ``/plotlines/{id}/scenes`` router
# (mirroring the scene-actions / revisions pattern). Registered separately.
scene_links_router = APIRouter(prefix="/plotlines", tags=["plotlines"])


async def _get_project_or_404(project_id: uuid.UUID, db: AsyncSession):
    project = await get_project(db, project_id)
    if project is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Project not found"
        )
    return project


async def _get_plotline_or_404(
    project_id: uuid.UUID, plotline_id: uuid.UUID, db: AsyncSession
):
    plotline = await get_plotline(db, project_id, plotline_id)
    if plotline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plotline not found"
        )
    return plotline


async def _get_plotline_global_or_404(plotline_id: uuid.UUID, db: AsyncSession):
    """Fetch a plotline by id without a project prefix (flat scene routes)."""
    result = await db.execute(select(Plotline).where(Plotline.id == plotline_id))
    plotline = result.scalar_one_or_none()
    if plotline is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Plotline not found"
        )
    return plotline


@router.post("", response_model=PlotlineRead, status_code=status.HTTP_201_CREATED)
async def create(
    project_id: uuid.UUID,
    data: PlotlineCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> PlotlineRead:
    await _get_project_or_404(project_id, db)
    try:
        return await create_plotline(db, project_id, data)
    except PlotlineScopeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.get("", response_model=list[PlotlineRead])
async def list_all(
    project_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[PlotlineRead]:
    await _get_project_or_404(project_id, db)
    return await list_plotlines(db, project_id)


@router.get("/{plotline_id}", response_model=PlotlineRead)
async def get_one(
    project_id: uuid.UUID,
    plotline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> PlotlineRead:
    await _get_project_or_404(project_id, db)
    return await _get_plotline_or_404(project_id, plotline_id, db)


@router.patch("/{plotline_id}", response_model=PlotlineRead)
async def update(
    project_id: uuid.UUID,
    plotline_id: uuid.UUID,
    data: PlotlineUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> PlotlineRead:
    await _get_project_or_404(project_id, db)
    plotline = await _get_plotline_or_404(project_id, plotline_id, db)
    try:
        return await update_plotline(db, plotline, data)
    except PlotlineScopeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@router.delete("/{plotline_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    project_id: uuid.UUID,
    plotline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    await _get_project_or_404(project_id, db)
    plotline = await _get_plotline_or_404(project_id, plotline_id, db)
    await delete_plotline(db, plotline)


# ------------------------- scene attach / detach / list ----------------------


@scene_links_router.get(
    "/{plotline_id}/scenes", response_model=list[PlotlineSceneRead]
)
async def list_scenes(
    plotline_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[PlotlineSceneRead]:
    await _get_plotline_global_or_404(plotline_id, db)
    return await list_plotline_scenes(db, plotline_id)


@scene_links_router.post(
    "/{plotline_id}/scenes",
    response_model=PlotlineSceneRead,
    status_code=status.HTTP_201_CREATED,
)
async def attach(
    plotline_id: uuid.UUID,
    data: PlotlineSceneCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> PlotlineSceneRead:
    plotline = await _get_plotline_global_or_404(plotline_id, db)
    try:
        return await attach_scene(db, plotline, data)
    except PlotlineScopeError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)
        ) from exc


@scene_links_router.delete(
    "/{plotline_id}/scenes/{scene_id}", status_code=status.HTTP_204_NO_CONTENT
)
async def detach(
    plotline_id: uuid.UUID,
    scene_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    plotline = await _get_plotline_global_or_404(plotline_id, db)
    removed = await detach_scene(db, plotline, scene_id)
    if not removed:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Scene is not attached to this plotline",
        )
