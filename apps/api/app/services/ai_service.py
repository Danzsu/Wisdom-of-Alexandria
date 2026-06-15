import uuid
from typing import Any

from alexandria_core.models.generation_job import GenerationJob
from alexandria_core.models.revision import Revision
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.errors import safe_error
from app.services.model_router import ModelRouter, model_router
from app.services.prompt_loader import PromptLoader, prompt_loader
from app.services.revision_service import RevisionService, revision_service

DESCRIBE_CHANNELS = ["Látás", "Hang", "Tapintás", "Szag", "Íz", "Metaforák"]
PROMPT_VERSION = "1.0"


def _gen_overrides(
    temperature: float | None = None,
    max_tokens: int | None = None,
    *,
    default_max_tokens: int | None = None,
) -> dict[str, Any]:
    """Build kwargs for ``ModelRouter.complete`` from optional generation params.

    Only includes a key when a caller-supplied value exists, so that omitted
    params fall through to the router's own defaults. ``default_max_tokens``
    preserves an action's hardcoded ``max_tokens`` (e.g. summarize=512) when the
    caller does not override it.
    """
    overrides: dict[str, Any] = {}
    if temperature is not None:
        overrides["temperature"] = temperature
    if max_tokens is not None:
        overrides["max_tokens"] = max_tokens
    elif default_max_tokens is not None:
        overrides["max_tokens"] = default_max_tokens
    return overrides


class AIService:
    """Orchestrates AI generation tasks using ModelRouter and PromptLoader."""

    def __init__(
        self,
        router: ModelRouter | None = None,
        loader: PromptLoader | None = None,
        svc: RevisionService | None = None,
    ):
        self.router = router or model_router
        self.loader = loader or prompt_loader
        self.svc = svc or revision_service

    async def rewrite(
        self,
        db: AsyncSession,
        *,
        selected_text: str,
        instruction: str,
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob]:
        job = await self.svc.create_job(
            db,
            job_type="rewrite",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"selected_text": selected_text, "instruction": instruction},
        )
        try:
            system = self.loader.load_system("rewrite")
            user = self.loader.load_user("rewrite", selected_text=selected_text, instruction=instruction)
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                **_gen_overrides(temperature, max_tokens),
            )
            revision = await self.svc.save_revision(
                db,
                content=response.content,
                revision_type="rewrite",
                scene_id=scene_id,
                job_id=job.id,
                model_name=response.model,
                prompt_version=PROMPT_VERSION,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def describe(
        self,
        db: AsyncSession,
        *,
        selected_text: str,
        channels: list[str] | None = None,
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[list[Revision], GenerationJob]:
        """Generate sensory description for each requested channel."""
        target_channels = channels or DESCRIBE_CHANNELS
        # Validate channels
        invalid = [c for c in target_channels if c not in DESCRIBE_CHANNELS]
        if invalid:
            raise ValueError(f"Invalid channels: {invalid}. Valid: {DESCRIBE_CHANNELS}")

        job = await self.svc.create_job(
            db,
            job_type="describe",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"selected_text": selected_text, "channels": target_channels},
        )
        try:
            system = self.loader.load_system("describe")
            revisions = []
            for channel in target_channels:
                user = self.loader.load_user("describe", selected_text=selected_text, channel=channel)
                response = await self.router.complete(
                    messages=self.router.build_messages(system, user),
                    model=model,
                    **_gen_overrides(temperature, max_tokens),
                )
                rev = await self.svc.save_revision(
                    db,
                    content=response.content,
                    revision_type="describe_channel",
                    scene_id=scene_id,
                    job_id=job.id,
                    model_name=response.model,
                    prompt_version=PROMPT_VERSION,
                )
                revisions.append(rev)
            await self.svc.complete_job(db, job, output_data={"revision_ids": [str(r.id) for r in revisions]})
            return revisions, job
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def write_continue(
        self,
        db: AsyncSession,
        *,
        scene_text: str,
        context: str = "",
        word_count_target: int = 300,
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob]:
        job = await self.svc.create_job(
            db,
            job_type="write_continue",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"scene_text": scene_text, "word_count_target": word_count_target},
        )
        try:
            system = self.loader.load_system("write_continue")
            user = self.loader.load_user(
                "write_continue",
                scene_text=scene_text,
                context=context,
                word_count_target=str(word_count_target),
            )
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                **_gen_overrides(temperature, max_tokens, default_max_tokens=word_count_target * 3),
            )
            revision = await self.svc.save_revision(
                db,
                content=response.content,
                revision_type="write_continue",
                scene_id=scene_id,
                job_id=job.id,
                model_name=response.model,
                prompt_version=PROMPT_VERSION,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def generate_scene(
        self,
        db: AsyncSession,
        *,
        beats: list[str],
        characters: str = "",
        location: str = "",
        style_notes: str = "",
        scene_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob]:
        beats_text = "\n".join(f"- {b}" for b in beats)
        job = await self.svc.create_job(
            db,
            job_type="generate_scene",
            scene_id=scene_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"beats": beats, "characters": characters, "location": location},
        )
        try:
            system = self.loader.load_system("generate_scene")
            user = self.loader.load_user(
                "generate_scene",
                beats=beats_text,
                characters=characters,
                location=location,
                style_notes=style_notes,
            )
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                **_gen_overrides(temperature, max_tokens, default_max_tokens=4096),
            )
            revision = await self.svc.save_revision(
                db,
                content=response.content,
                revision_type="generate_scene",
                scene_id=scene_id,
                job_id=job.id,
                model_name=response.model,
                prompt_version=PROMPT_VERSION,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise

    async def summarize(
        self,
        db: AsyncSession,
        *,
        content: str,
        content_type: str = "jelenet",
        scene_id: uuid.UUID | None = None,
        chapter_id: uuid.UUID | None = None,
        model: str | None = None,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> tuple[Revision, GenerationJob]:
        job = await self.svc.create_job(
            db,
            job_type="summarize",
            scene_id=scene_id,
            chapter_id=chapter_id,
            model_name=model,
            prompt_version=PROMPT_VERSION,
            input_data={"content_type": content_type},
        )
        try:
            system = self.loader.load_system("summarize")
            user = self.loader.load_user("summarize", content=content, content_type=content_type)
            response = await self.router.complete(
                messages=self.router.build_messages(system, user),
                model=model,
                **_gen_overrides(temperature, max_tokens, default_max_tokens=512),
            )
            revision = await self.svc.save_revision(
                db,
                content=response.content,
                revision_type="summarize",
                scene_id=scene_id,
                job_id=job.id,
                model_name=response.model,
                prompt_version=PROMPT_VERSION,
            )
            await self.svc.complete_job(db, job, output_data={"revision_id": str(revision.id)})
            return revision, job
        except Exception as e:
            # Roll back any partial / failed transaction so fail_job's commit
            # runs on a clean session (avoids PendingRollbackError masking the
            # original error). Then persist a sanitized, bounded error message.
            await db.rollback()
            await self.svc.fail_job(db, job, error_message=safe_error(e))
            raise


ai_service = AIService()
