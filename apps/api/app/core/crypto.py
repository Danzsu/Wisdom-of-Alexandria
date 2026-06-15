"""Symmetric encryption for provider secrets (API keys) at rest.

Uses :mod:`cryptography`'s Fernet (AES-128-CBC + HMAC). The key is supplied via
``settings.provider_encryption_key`` (env-driven). This module NEVER logs the
key or any plaintext/ciphertext secret.
"""

from functools import lru_cache

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


class DecryptionError(Exception):
    """Raised when a ciphertext cannot be decrypted (wrong/rotated key or tampering)."""


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    """Build the Fernet instance from the configured key.

    Cached so we validate the key once. A malformed key raises immediately
    (ValueError) — never silently swallowed.
    """
    key = settings.provider_encryption_key
    # Fernet validates the key shape (urlsafe base64, 32 bytes) and raises
    # ValueError on a bad key. We let that propagate — a misconfigured key is a
    # hard startup error, not something to mask.
    return Fernet(key.encode("utf-8"))


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a plaintext secret, returning urlsafe-base64 ciphertext."""
    token = _get_fernet().encrypt(plaintext.encode("utf-8"))
    return token.decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt ciphertext produced by :func:`encrypt_secret`.

    Raises :class:`DecryptionError` if the token is invalid (e.g. key rotated).
    """
    try:
        plaintext = _get_fernet().decrypt(ciphertext.encode("utf-8"))
    except InvalidToken as exc:
        # Do not leak the ciphertext/key in the error message.
        raise DecryptionError("Stored secret could not be decrypted") from exc
    return plaintext.decode("utf-8")


def mask_secret(plaintext_or_none: str | None) -> str | None:
    """Return a masked representation of a secret for safe display.

    ``None`` -> ``None``. A short/empty secret is fully masked. Otherwise the
    last 4 characters are revealed behind bullets, e.g. ``"••••sk-9f2a"``.
    The full secret is never returned.
    """
    if not plaintext_or_none:
        return None
    if len(plaintext_or_none) <= 4:
        return "••••"
    return "••••" + plaintext_or_none[-4:]
