from alexandria_core.core.config import settings
from alexandria_core.core.security import create_access_token
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from pydantic import BaseModel

from app.core.deps import get_current_user

router = APIRouter(prefix="/auth", tags=["auth"])


class Token(BaseModel):
    access_token: str
    token_type: str


class MeRead(BaseModel):
    """Identity of the authenticated single-user account.

    There is no explicit display-name/author setting in config, so
    ``display_name`` is derived from the username (title-cased, with
    ``_``/``.`` treated as word separators) and ``initials`` is the uppercase
    first letter of each display-name word (capped at two).
    """

    username: str
    display_name: str
    initials: str


def _derive_identity(username: str) -> MeRead:
    words = [w for w in username.replace("_", " ").replace(".", " ").split() if w]
    if not words:
        words = [username]
    display_name = " ".join(w[:1].upper() + w[1:] for w in words)
    initials = "".join(w[0].upper() for w in words[:2]) or username[:1].upper()
    return MeRead(username=username, display_name=display_name, initials=initials)


@router.post("/token", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> Token:
    if (
        form_data.username != settings.admin_username
        or form_data.password != settings.admin_password
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = create_access_token(subject=form_data.username)
    return Token(access_token=token, token_type="bearer")


@router.get("/me", response_model=MeRead)
async def me(username: str = Depends(get_current_user)) -> MeRead:
    """Return the authenticated user's identity (username + derived fields)."""
    return _derive_identity(username)
