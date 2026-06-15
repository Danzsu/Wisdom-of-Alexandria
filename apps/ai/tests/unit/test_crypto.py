"""Unit tests for provider-secret encryption + masking."""

import pytest

from app.core import crypto
from app.core.crypto import (
    DecryptionError,
    _get_fernet,
    decrypt_secret,
    encrypt_secret,
    mask_secret,
)


@pytest.mark.unit
def test_encrypt_decrypt_round_trip():
    plaintext = "sk-test-1234567890abcdef"
    ciphertext = encrypt_secret(plaintext)
    assert ciphertext != plaintext  # actually encrypted
    assert decrypt_secret(ciphertext) == plaintext  # round-trips exactly


@pytest.mark.unit
def test_encrypt_is_non_deterministic_but_decrypts_same():
    plaintext = "my-secret-key"
    c1 = encrypt_secret(plaintext)
    c2 = encrypt_secret(plaintext)
    # Fernet embeds a random IV/timestamp, so ciphertexts differ...
    assert c1 != c2
    # ...but both decrypt to the original.
    assert decrypt_secret(c1) == plaintext
    assert decrypt_secret(c2) == plaintext


@pytest.mark.unit
def test_decrypt_invalid_token_raises_decryption_error():
    with pytest.raises(DecryptionError):
        decrypt_secret("not-a-valid-fernet-token")


@pytest.mark.unit
def test_decrypt_tampered_ciphertext_raises(_reset_fernet_cache):
    """A1/A6a: a VALID ciphertext whose bytes are mutated must fail loudly with
    DecryptionError (HMAC mismatch), never return garbled plaintext."""
    ciphertext = encrypt_secret("sk-real-secret-value")
    # Flip a character in the middle of the token to break the HMAC.
    mid = len(ciphertext) // 2
    flipped = "A" if ciphertext[mid] != "A" else "B"
    tampered = ciphertext[:mid] + flipped + ciphertext[mid + 1 :]
    with pytest.raises(DecryptionError):
        decrypt_secret(tampered)


@pytest.mark.unit
def test_decrypt_with_wrong_key_raises(monkeypatch, _reset_fernet_cache):
    """A6a: ciphertext from one key must not decrypt under a DIFFERENT key —
    it raises DecryptionError (key rotated/corrupted), never silently succeeds."""
    from cryptography.fernet import Fernet

    # Encrypt under the conftest key.
    ciphertext = encrypt_secret("sk-rotate-me")

    # Now swap in a DIFFERENT valid key and rebuild the cached Fernet.
    other_key = Fernet.generate_key().decode()
    monkeypatch.setattr(crypto.settings, "provider_encryption_key", other_key)
    _get_fernet.cache_clear()

    with pytest.raises(DecryptionError):
        decrypt_secret(ciphertext)


@pytest.mark.unit
def test_decrypt_error_does_not_leak_ciphertext():
    bogus = "totally-bogus-ciphertext-value"
    try:
        decrypt_secret(bogus)
    except DecryptionError as exc:
        assert bogus not in str(exc)
    else:  # pragma: no cover - defensive
        pytest.fail("expected DecryptionError")


@pytest.fixture
def _reset_fernet_cache():
    """Ensure ``_get_fernet`` rebuilds (and its lru_cache is clean) around a test.

    ``_get_fernet`` is ``lru_cache``-d, so a test that patches the key must clear
    the cache both before (to drop any cached instance) and after (to avoid
    leaking a bad/None-key state into other tests).
    """
    _get_fernet.cache_clear()
    yield
    _get_fernet.cache_clear()


@pytest.mark.unit
@pytest.mark.parametrize("bad_key", [None, ""])
def test_get_fernet_raises_clear_error_when_key_unset(
    monkeypatch, _reset_fernet_cache, bad_key
):
    """Unset/empty key must fail loudly with an actionable RuntimeError.

    It must NOT silently fall back to an ephemeral key (that would make stored
    ciphertext undecryptable) and must NOT echo any key value.
    """
    monkeypatch.setattr(crypto.settings, "provider_encryption_key", bad_key)
    with pytest.raises(RuntimeError) as excinfo:
        _get_fernet()
    msg = str(excinfo.value)
    assert "PROVIDER_ENCRYPTION_KEY" in msg
    # Actionable: tells the operator how to generate one.
    assert "Fernet.generate_key" in msg
    # The (valid, test) key configured by conftest must never leak into errors.
    assert "vxmdDzJKYCa9wvZok_7P_IRdJUGtJDRCHaFW1eaQ4Vk=" not in msg


@pytest.mark.unit
def test_get_fernet_raises_clear_error_on_malformed_key(
    monkeypatch, _reset_fernet_cache
):
    """A malformed (non-base64 / wrong-length) key raises a clear shape error,
    not a cryptic low-level exception, and never echoes the key value."""
    bad_value = "this-is-not-a-valid-fernet-key"
    monkeypatch.setattr(crypto.settings, "provider_encryption_key", bad_value)
    with pytest.raises(RuntimeError) as excinfo:
        _get_fernet()
    msg = str(excinfo.value)
    assert "PROVIDER_ENCRYPTION_KEY" in msg
    assert "malformed" in msg.lower()
    # The bad key value itself must never be echoed in the error message.
    assert bad_value not in msg


@pytest.mark.unit
def test_mask_secret_none_returns_none():
    assert mask_secret(None) is None
    assert mask_secret("") is None


@pytest.mark.unit
def test_mask_secret_short_is_fully_masked():
    assert mask_secret("abcd") == "••••"
    assert mask_secret("ab") == "••••"


@pytest.mark.unit
def test_mask_secret_reveals_only_last_four():
    masked = mask_secret("sk-supersecret-9f2a")
    assert masked == "••••9f2a"
    # The full secret must never appear in the masked form.
    assert "supersecret" not in masked
    assert masked.endswith("9f2a")
