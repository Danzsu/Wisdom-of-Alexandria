"""Unit/integration tests for ModelRouter.generate_image (AI image gen, Phase 1).

The real ``google-genai`` SDK is never imported: generate_image takes an
injectable ``client_factory`` so the test passes a fake client whose
``.models.generate_content(...)`` returns a fake response. We assert the
resolved api_key reaches the factory (proving resolve_provider ran via the
threaded db), that the prompt + reference images + aspect_ratio flow through,
that the first inline image is extracted, and that failures are loud (no image
part -> ValueError; undecryptable stored key -> RuntimeError).
"""

from unittest.mock import MagicMock

import pytest
from alexandria_core.models.provider import Provider
from sqlalchemy import delete

from app.schemas.provider import ProviderCreate
from app.services.crud_provider import create_provider
from app.services.model_router import ImageResult, ModelRouter


@pytest.fixture(autouse=True)
async def _clean_providers(db_session):
    await db_session.execute(delete(Provider))
    await db_session.commit()
    yield
    await db_session.execute(delete(Provider))
    await db_session.commit()


def _image_response(data: bytes, mime: str = "image/png"):
    """Build a google-genai-shaped response holding one inline image part.

    Shape: resp.candidates[0].content.parts[i].inline_data.{data, mime_type}.
    """
    inline = MagicMock()
    inline.data = data
    inline.mime_type = mime
    part = MagicMock()
    part.inline_data = inline
    content = MagicMock()
    content.parts = [part]
    candidate = MagicMock()
    candidate.content = content
    resp = MagicMock()
    resp.candidates = [candidate]
    return resp


def _no_image_response():
    """A response whose only part is text — no inline image present."""
    part = MagicMock()
    part.inline_data = None
    part.text = "sajnálom, nem tudok képet generálni"
    content = MagicMock()
    content.parts = [part]
    candidate = MagicMock()
    candidate.content = content
    resp = MagicMock()
    resp.candidates = [candidate]
    return resp


def _fake_client(resp, recorder: dict):
    """A fake genai client recording the generate_content call."""
    client = MagicMock()

    def _generate_content(*, model, contents, config):
        recorder["model"] = model
        recorder["contents"] = contents
        recorder["config"] = config
        return resp

    client.models.generate_content = MagicMock(side_effect=_generate_content)
    return client


@pytest.mark.unit
async def test_generate_image_returns_image_result(db_session):
    """A configured gemini provider + a gemini image model -> the decrypted key
    reaches the factory and the first inline image is returned with mime + the
    model id (the part after the prefix)."""
    await create_provider(
        db_session,
        ProviderCreate(
            type="gemini",
            label="Gemini Image",
            api_key="gm-image-secret-abc",
            image_model="gemini/gemini-3.1-flash-image",
        ),
    )
    recorder: dict = {}
    factory_keys: list = []
    png = b"\x89PNG\r\n\x1a\n fake image bytes"
    resp = _image_response(png, "image/png")

    def factory(api_key):
        factory_keys.append(api_key)
        return _fake_client(resp, recorder)

    router = ModelRouter()
    ref = b"reference-image-bytes"
    result = await router.generate_image(
        "egy kódexlap rajza",
        model="gemini/gemini-3.1-flash-image",
        db=db_session,
        reference_images=[ref],
        aspect_ratio="2:3",
        client_factory=factory,
    )

    assert isinstance(result, ImageResult)
    assert result.data == png
    assert result.mime == "image/png"
    # model id is the part after the prefix
    assert result.model == "gemini-3.1-flash-image"
    # decrypted key reached the factory (resolve_provider ran via the db)
    assert factory_keys == ["gm-image-secret-abc"]
    # prompt + reference images flow into contents (prompt first)
    assert recorder["contents"][0] == "egy kódexlap rajza"
    assert ref in recorder["contents"]
    # aspect ratio flows into config
    assert recorder["config"]["image_config"]["aspect_ratio"] == "2:3"
    assert recorder["config"]["response_modalities"] == ["Image"]


@pytest.mark.unit
async def test_generate_image_raises_when_no_image_part(db_session):
    """A response carrying no inline image must RAISE loudly rather than return
    an empty/None payload that would later be persisted as a broken asset."""
    recorder: dict = {}
    resp = _no_image_response()
    router = ModelRouter()
    with pytest.raises(ValueError, match="no image"):
        await router.generate_image(
            "kép",
            model="gemini/gemini-3.1-flash-image",
            db=db_session,
            client_factory=lambda api_key: _fake_client(resp, recorder),
        )


@pytest.mark.unit
async def test_generate_image_no_provider_passes_none_key(db_session):
    """With no configured provider, resolve_provider yields api_key=None; the
    factory must still be called with api_key=None (not skipped)."""
    recorder: dict = {}
    factory_keys: list = []
    png = b"\x89PNG fake"
    resp = _image_response(png)

    def factory(api_key):
        factory_keys.append(api_key)
        return _fake_client(resp, recorder)

    router = ModelRouter()
    result = await router.generate_image(
        "kép",
        model="gemini/gemini-3.1-flash-image",
        db=db_session,
        client_factory=factory,
    )
    assert factory_keys == [None]
    assert result.data == png


@pytest.mark.unit
async def test_generate_image_undecryptable_key_raises(db_session):
    """An undecryptable stored key must fail loudly (RuntimeError from
    resolve_provider), never call the image client with a bad/None key."""
    provider = Provider(
        type="gemini",
        label="Corrupted Key",
        api_key_encrypted="not-a-valid-fernet-token",
        enabled=True,
    )
    db_session.add(provider)
    await db_session.commit()

    called = {"n": 0}

    def factory(api_key):
        called["n"] += 1
        return _fake_client(_image_response(b"x"), {})

    router = ModelRouter()
    with pytest.raises(RuntimeError, match="could not be decrypted"):
        await router.generate_image(
            "kép",
            model="gemini/gemini-3.1-flash-image",
            db=db_session,
            client_factory=factory,
        )
    assert called["n"] == 0
