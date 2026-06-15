from fastapi import APIRouter

from app.api.v1.auth import router as auth_router
from app.api.v1.beats import router as beats_router
from app.api.v1.books import router as books_router
from app.api.v1.chapters import router as chapters_router
from app.api.v1.characters import router as characters_router
from app.api.v1.codex import router as codex_router
from app.api.v1.codex_progressions import router as codex_progressions_router
from app.api.v1.codex_relations import router as codex_relations_router
from app.api.v1.exports import router as exports_router
from app.api.v1.locations import router as locations_router
from app.api.v1.projects import router as projects_router
from app.api.v1.revisions import router as revisions_router
from app.api.v1.scenes import router as scenes_router
from app.api.v1.scenes import scene_actions_router
from app.api.v1.snippets import router as snippets_router
from app.api.v1.style_guide import router as style_guide_router
from app.api.v1.worldbuilding import router as worldbuilding_router

# NOTE: the AI generation (``/ai``), provider config (``/providers``) and
# generation-job status (``/jobs``) routers moved to the dedicated AI service
# (``apps/ai``, on :8001). This service is domain-CRUD-only. The human-in-the-
# loop revision approve/reject (``/revisions``) stays here because it mutates
# the domain Scene.
api_router = APIRouter()
api_router.include_router(auth_router)
api_router.include_router(projects_router)
api_router.include_router(books_router)
api_router.include_router(chapters_router)
api_router.include_router(scenes_router)
api_router.include_router(scene_actions_router)
api_router.include_router(beats_router)
api_router.include_router(characters_router)
api_router.include_router(locations_router)
api_router.include_router(worldbuilding_router)
api_router.include_router(codex_router)
api_router.include_router(codex_relations_router)
api_router.include_router(codex_progressions_router)
api_router.include_router(snippets_router)
api_router.include_router(style_guide_router)
api_router.include_router(revisions_router)
api_router.include_router(exports_router)
