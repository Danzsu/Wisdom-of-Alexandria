"""Integration test for Provider.image_model (AI image generation, Phase 1).

Mirrors the embedding_model contract: image_model is set on create, persisted,
and surfaced on the masked ProviderRead view (without leaking secrets).
"""

import pytest
from alexandria_core.models.provider import Provider
from sqlalchemy import delete

from app.schemas.provider import ProviderCreate
from app.services import crud_provider


@pytest.fixture(autouse=True)
async def _clean_providers(db_session):
    """Providers are global; clear the table around each test for isolation."""
    await db_session.execute(delete(Provider))
    await db_session.commit()
    yield
    await db_session.execute(delete(Provider))
    await db_session.commit()


async def test_image_model_persisted_and_surfaced_on_read(db_session):
    """A provider created with image_model exposes it via the masked read view,
    and embedding_model continues to work alongside it."""
    data = ProviderCreate(
        type="gemini",
        label="G",
        api_key="k",
        image_model="gemini/gemini-3.1-flash-image",
        embedding_model="openai/text-embedding-3-small",
    )
    created = await crud_provider.create_provider(db_session, data)

    read = crud_provider.to_read(created)
    assert read.image_model == "gemini/gemini-3.1-flash-image"
    # embedding_model still works.
    assert read.embedding_model == "openai/text-embedding-3-small"


async def test_image_model_defaults_to_none(db_session):
    """Omitting image_model leaves it null (providers may not serve images)."""
    data = ProviderCreate(type="gemini", label="G", api_key="k")
    created = await crud_provider.create_provider(db_session, data)
    read = crud_provider.to_read(created)
    assert read.image_model is None
