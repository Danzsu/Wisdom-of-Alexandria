import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.crypto import DecryptionError, decrypt_secret, encrypt_secret, mask_secret
from app.models.provider import Provider
from app.schemas.provider import ProviderCreate, ProviderRead, ProviderUpdate


async def create_provider(db: AsyncSession, data: ProviderCreate) -> Provider:
    api_key_encrypted = encrypt_secret(data.api_key) if data.api_key else None
    provider = Provider(
        type=data.type,
        label=data.label,
        api_key_encrypted=api_key_encrypted,
        base_url=data.base_url,
        default_model=data.default_model,
        enabled=data.enabled,
    )
    db.add(provider)
    await db.commit()
    await db.refresh(provider)
    return provider


async def get_provider(db: AsyncSession, provider_id: uuid.UUID) -> Provider | None:
    result = await db.execute(select(Provider).where(Provider.id == provider_id))
    return result.scalar_one_or_none()


async def list_providers(db: AsyncSession, *, enabled_only: bool = False) -> list[Provider]:
    stmt = select(Provider).order_by(Provider.created_at)
    if enabled_only:
        stmt = stmt.where(Provider.enabled.is_(True))
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def update_provider(db: AsyncSession, provider: Provider, data: ProviderUpdate) -> Provider:
    payload = data.model_dump(exclude_unset=True)
    # api_key is special: re-encrypt only when explicitly provided.
    if "api_key" in payload:
        api_key = payload.pop("api_key")
        provider.api_key_encrypted = encrypt_secret(api_key) if api_key else None
    for field, value in payload.items():
        setattr(provider, field, value)
    await db.commit()
    await db.refresh(provider)
    return provider


async def delete_provider(db: AsyncSession, provider: Provider) -> None:
    await db.delete(provider)
    await db.commit()


def to_read(provider: Provider) -> ProviderRead:
    """Map a Provider ORM row to the safe ProviderRead view.

    Decrypts the key only to compute the masked display value; the plaintext and
    the ciphertext are never placed on the returned schema.
    """
    masked: str | None = None
    if provider.api_key_encrypted:
        try:
            masked = mask_secret(decrypt_secret(provider.api_key_encrypted))
        except DecryptionError:
            # Key rotated / token invalid: we still report that a key exists,
            # but cannot show the tail. Never raise here — read must not break.
            masked = "••••"
    return ProviderRead(
        id=provider.id,
        type=provider.type,
        label=provider.label,
        api_key_masked=masked,
        has_key=provider.api_key_encrypted is not None,
        base_url=provider.base_url,
        default_model=provider.default_model,
        enabled=provider.enabled,
        created_at=provider.created_at,
        updated_at=provider.updated_at,
    )
