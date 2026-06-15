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


_GENERATE_HINT = (
    'generate one with `python -c "from cryptography.fernet import Fernet; '
    'print(Fernet.generate_key().decode())"` and set it in the environment'
)


@lru_cache(maxsize=1)
def _get_fernet() -> Fernet:
    """Build the Fernet instance from the configured key.

    Cached so we validate the key once.

    Fails loudly (never silently swallowed, never auto-generates an ephemeral
    key — that would make previously-stored ciphertext undecryptable):

    * If ``provider_encryption_key`` is unset/empty, raises ``RuntimeError``
      with an actionable hint on how to generate one. The key itself is never
      included in any error message.
    * If the key is set but malformed (not urlsafe base64, wrong length),
      raises ``RuntimeError`` with a clear shape error rather than letting a
      cryptic low-level ``ValueError``/``binascii`` error propagate.
    """
    key = settings.provider_encryption_key
    if not key:
        raise RuntimeError(f"PROVIDER_ENCRYPTION_KEY is not set — {_GENERATE_HINT}")
    try:
        # Fernet validates the key shape (urlsafe base64, 32 bytes) and raises
        # ValueError on a bad key.
        return Fernet(key.encode("utf-8"))
    except (ValueError, TypeError) as exc:
        # Re-raise as a clear, actionable error WITHOUT echoing the key value.
        raise RuntimeError(
            f"PROVIDER_ENCRYPTION_KEY is malformed (must be a urlsafe-base64, "
            f"32-byte key) — {_GENERATE_HINT}"
        ) from exc


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
