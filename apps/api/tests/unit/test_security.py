from datetime import UTC, datetime, timedelta

from alexandria_core.core.config import settings
from alexandria_core.core.security import create_access_token, decode_token
from jose import jwt


def test_create_access_token_returns_string():
    token = create_access_token("admin")
    assert isinstance(token, str)
    assert len(token) > 10


def test_create_access_token_is_valid_jwt():
    token = create_access_token("admin")
    # JWT has 3 parts separated by dots
    parts = token.split(".")
    assert len(parts) == 3


def test_decode_token_returns_subject():
    token = create_access_token("admin")
    subject = decode_token(token)
    assert subject == "admin"


def test_decode_token_different_subjects():
    t1 = create_access_token("user1")
    t2 = create_access_token("user2")
    assert decode_token(t1) == "user1"
    assert decode_token(t2) == "user2"


def test_decode_token_invalid_returns_none():
    assert decode_token("not.a.valid.token") is None


def test_decode_token_empty_returns_none():
    assert decode_token("") is None


def test_decode_token_wrong_secret_returns_none():
    # Create token with wrong secret
    bad_token = jwt.encode({"sub": "admin"}, "wrong-secret", algorithm=settings.algorithm)
    assert decode_token(bad_token) is None


def test_decode_token_expired_returns_none():
    # Create a token that expired 1 hour ago
    expired = datetime.now(UTC) - timedelta(hours=1)
    expired_token = jwt.encode(
        {"sub": "admin", "exp": expired},
        settings.secret_key,
        algorithm=settings.algorithm,
    )
    assert decode_token(expired_token) is None


def test_token_payload_contains_sub():
    token = create_access_token("testuser")
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    assert payload["sub"] == "testuser"


def test_token_payload_contains_exp():
    token = create_access_token("admin")
    payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
    assert "exp" in payload
    assert payload["exp"] > datetime.now(UTC).timestamp()
