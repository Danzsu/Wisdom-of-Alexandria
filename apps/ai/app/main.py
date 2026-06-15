import logging
from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from alexandria_core.core.config import settings
from alexandria_core.db.session import engine
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.v1.router import api_router
from app.core.errors import safe_error

logger = logging.getLogger(__name__)


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
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """Catch-all for truly unhandled exceptions.

    FastAPI's own ``HTTPException`` and ``RequestValidationError`` handlers are
    registered first and keep their normal behaviour — only exceptions that
    reach the bottom of the stack hit this handler. The full exception (with
    traceback) is logged server-side; the client gets a sanitized, bounded 500
    body so no traceback, raw internal text, or secret leaks out, and no
    newline bleeds into the response.
    """
    logger.exception("Unhandled exception during %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": safe_error(exc)})


app.include_router(api_router, prefix="/api/v1")


@app.get("/health", tags=["system"])
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai", "version": "0.1.0"}
