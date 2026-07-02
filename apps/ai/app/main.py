import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from alexandria_core.core.config import settings
from alexandria_core.db.session import engine
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router

logger = logging.getLogger(__name__)

# Generic body for the catch-all 500. An UNHANDLED exception's message is
# attacker-influenceable and may embed a secret (e.g. a provider error echoing a
# key, or a config value in a KeyError), so it is NEVER echoed to the client —
# only logged server-side. Controlled, known-safe messages (job error_message,
# provider failures the caller deliberately raises) still go through
# ``safe_error`` at their own call sites.
_GENERIC_500_DETAIL = "Internal server error"


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    yield
    await engine.dispose()


app = FastAPI(
    title="Alexandria AI Service",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    # Explicit allowlist instead of "*": the service only serves these verbs,
    # and an explicit list keeps CORS preflight responses from advertising
    # methods (TRACE/CONNECT/…) that no route implements.
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for truly unhandled exceptions.

    FastAPI's own ``HTTPException`` and ``RequestValidationError`` handlers are
    registered first and keep their normal behaviour — only exceptions that
    reach the bottom of the stack hit this handler. The full exception (with
    traceback) is logged server-side; the client gets a FIXED generic 500 body.
    The raw message is NOT echoed (not even sanitized): an unhandled exception's
    text is attacker-influenceable and may embed a secret, so nothing about the
    internal failure leaks out.
    """
    logger.exception("Unhandled exception during %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": _GENERIC_500_DETAIL})


app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai", "version": "0.1.0"}
