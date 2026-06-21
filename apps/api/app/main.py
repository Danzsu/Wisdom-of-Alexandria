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


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    yield
    await engine.dispose()


app = FastAPI(
    title="ForgeWriter AI API",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for truly unhandled exceptions.

    FastAPI's own ``HTTPException`` and ``RequestValidationError`` handlers are
    registered first and keep their normal behaviour (intentional, safe detail) —
    only exceptions that reach the bottom of the stack hit this handler. The full
    exception (with traceback) is logged server-side; the client gets a fixed,
    GENERIC message. We deliberately do NOT echo ``str(exc)`` (even sanitized):
    arbitrary internal exception text can embed a secret in its first chars,
    which truncation alone would not strip — so no traceback, raw internal text,
    or secret can leak out.
    """
    logger.exception("Unhandled exception during %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})


app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "version": "0.1.0"}
