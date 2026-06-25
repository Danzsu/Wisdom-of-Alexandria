import json
import uuid
from collections.abc import AsyncIterator

from alexandria_core.core.deps import get_current_user, get_db
from alexandria_core.models.provider import Provider
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.schemas.provider import (
    ProviderCreate,
    ProviderModelsResult,
    ProviderPullRequest,
    ProviderRead,
    ProviderTestResult,
    ProviderUpdate,
)
from app.services.crud_provider import (
    create_provider,
    delete_provider,
    get_provider,
    list_providers,
    to_read,
    update_provider,
)
from app.services.provider_service import (
    PullModelError,
    check_provider,
    list_provider_models,
    pull_model,
)

router = APIRouter(prefix="/providers", tags=["providers"])


async def _get_provider_or_404(provider_id: uuid.UUID, db: AsyncSession) -> Provider:
    provider = await get_provider(db, provider_id)
    if provider is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Provider not found")
    return provider


@router.post("", response_model=ProviderRead, status_code=status.HTTP_201_CREATED)
async def create(
    data: ProviderCreate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderRead:
    provider = await create_provider(db, data)
    return to_read(provider)


@router.get("", response_model=list[ProviderRead])
async def list_all(
    enabled_only: bool = False,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> list[ProviderRead]:
    providers = await list_providers(db, enabled_only=enabled_only)
    return [to_read(p) for p in providers]


@router.get("/{provider_id}", response_model=ProviderRead)
async def get_one(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderRead:
    provider = await _get_provider_or_404(provider_id, db)
    return to_read(provider)


@router.patch("/{provider_id}", response_model=ProviderRead)
async def update(
    provider_id: uuid.UUID,
    data: ProviderUpdate,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderRead:
    provider = await _get_provider_or_404(provider_id, db)
    provider = await update_provider(db, provider, data)
    return to_read(provider)


@router.delete("/{provider_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> None:
    provider = await _get_provider_or_404(provider_id, db)
    await delete_provider(db, provider)


@router.post("/{provider_id}/test", response_model=ProviderTestResult)
async def test_connection(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderTestResult:
    provider = await _get_provider_or_404(provider_id, db)
    return await check_provider(provider)


@router.get("/{provider_id}/models", response_model=ProviderModelsResult)
async def models(
    provider_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> ProviderModelsResult:
    provider = await _get_provider_or_404(provider_id, db)
    found = await list_provider_models(provider)
    return ProviderModelsResult(models=found)


@router.post("/{provider_id}/models/pull")
async def pull(
    provider_id: uuid.UUID,
    body: ProviderPullRequest,
    db: AsyncSession = Depends(get_db),
    _: str = Depends(get_current_user),
) -> StreamingResponse:
    """Download (pull) an Ollama model, streaming NDJSON progress to the client.

    Only valid for a local Ollama provider (others → 400). Progress is streamed
    verbatim from Ollama: one JSON object per line, ending with
    ``{"status": "success"}``. If Ollama is unreachable / errors before the
    first byte, an actionable 502/503 is returned instead of a broken stream.
    """
    provider = await _get_provider_or_404(provider_id, db)
    if provider.type != "ollama":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A modell letöltése csak Ollama (lokális) providerhez érhető el.",
        )

    source = pull_model(provider, body.model)

    # Peek the first chunk so a startup failure (Ollama down / non-2xx) surfaces
    # as a clean 5xx BEFORE we commit to a 200 StreamingResponse — a half-open
    # stream that errors out would otherwise look like a success to the client.
    try:
        first = await anext(source, None)
    except PullModelError as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=(
                f"Nem sikerült letölteni a modellt az Ollama-tól: {exc}. "
                "Ellenőrizd, hogy az Ollama fut és elérhető-e."
            ),
        ) from exc

    async def _ndjson() -> AsyncIterator[bytes]:
        if first is not None:
            yield (json.dumps(first) + "\n").encode("utf-8")
        try:
            async for chunk in source:
                yield (json.dumps(chunk) + "\n").encode("utf-8")
        except PullModelError as exc:
            # A mid-stream failure: we already sent 200, so signal it in-band as
            # a final error line the client can detect (never a silent stop).
            yield (json.dumps({"error": str(exc)}) + "\n").encode("utf-8")

    return StreamingResponse(_ndjson(), media_type="application/x-ndjson")
