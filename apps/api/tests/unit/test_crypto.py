"""Unit tests for provider-secret encryption + masking."""

import pytest

from app.core.crypto import (
    DecryptionError,
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
def test_decrypt_error_does_not_leak_ciphertext():
    bogus = "totally-bogus-ciphertext-value"
    try:
        decrypt_secret(bogus)
    except DecryptionError as exc:
        assert bogus not in str(exc)
    else:  # pragma: no cover - defensive
        pytest.fail("expected DecryptionError")


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
