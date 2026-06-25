"""base_url scheme/format validation on the provider schemas (P1, partial).

A provider's ``base_url`` is used as the outbound LiteLLM/HTTP endpoint, so it
must be a well-formed ``http(s)`` URL. A non-http scheme (``file://``, ``ftp://``)
or junk string must be rejected at the schema boundary (422). This app is
LOCAL-FIRST — loopback/localhost MUST stay allowed (Ollama runs at
``http://localhost:11434``); we do NOT block private ranges here.
"""

import pytest
from pydantic import ValidationError

from app.schemas.provider import ProviderCreate, ProviderUpdate


@pytest.mark.unit
@pytest.mark.parametrize(
    "bad_url",
    [
        "file:///etc/passwd",
        "ftp://example.com",
        "not a url",
        "ftp://x",
        "://missing-scheme",
        "localhost:11434",  # no scheme
    ],
)
def test_provider_create_rejects_non_http_base_url(bad_url):
    with pytest.raises(ValidationError):
        ProviderCreate(type="ollama", label="x", base_url=bad_url)


@pytest.mark.unit
@pytest.mark.parametrize(
    "good_url",
    [
        "http://localhost:11434",
        "http://127.0.0.1:11434",
        "https://api.openai.com/v1",
        "http://ollama:11434",
    ],
)
def test_provider_create_accepts_valid_http_base_url(good_url):
    p = ProviderCreate(type="ollama", label="x", base_url=good_url)
    assert p.base_url == good_url


@pytest.mark.unit
def test_provider_create_allows_none_base_url():
    p = ProviderCreate(type="ollama", label="x", base_url=None)
    assert p.base_url is None


@pytest.mark.unit
def test_provider_update_rejects_non_http_base_url():
    with pytest.raises(ValidationError):
        ProviderUpdate(base_url="file:///etc/passwd")


@pytest.mark.unit
def test_provider_update_accepts_valid_and_none():
    assert ProviderUpdate(base_url="https://api.openai.com/v1").base_url
    assert ProviderUpdate(base_url=None).base_url is None
