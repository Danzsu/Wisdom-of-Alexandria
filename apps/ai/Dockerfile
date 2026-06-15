FROM python:3.12-slim

# Build context is the REPOSITORY ROOT (see docker-compose build.context),
# because apps/ai depends on the workspace member packages/db (alexandria-db).
# A context scoped to apps/ai could not reach packages/db.
WORKDIR /workspace

# Install uv
RUN pip install uv

# Copy workspace manifests + lockfile first (better layer caching). The root
# pyproject declares the uv workspace; the lockfile is the single root lock.
COPY pyproject.toml uv.lock ./
COPY apps/ai/pyproject.toml ./apps/ai/pyproject.toml
COPY packages/db/pyproject.toml ./packages/db/pyproject.toml

# Copy the shared package source (needed: alexandria-db is an editable
# workspace member, so its source must exist for the build/install step).
COPY packages/db/ ./packages/db/

# Resolve + install the apps/ai project (and its alexandria-db workspace dep)
# from the locked workspace, without dev deps.
RUN uv sync --frozen --no-dev --package alexandria-ai

# Copy the AI application code last.
COPY apps/ai/ ./apps/ai/

# Run as a non-root user (defense in depth: a compromised process is unprivileged).
# Create the user AFTER all root-owned installs/copies, then hand the whole
# workspace to it — this includes the uv-managed venv at /workspace/.venv, which
# `uv run --no-sync` must READ at runtime (both the API command below and the RQ
# worker override `python -m app.worker`). Without the chown, appuser could not
# read the venv and the service / worker would fail to start.
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /workspace
USER appuser

WORKDIR /workspace/apps/ai

# Prompt templates are mounted at /app/prompts via docker-compose (volume
# ./packages/prompts:/app/prompts:ro) — the absolute path PromptLoader reads.
# Copy is intentionally omitted as a runtime mount.

EXPOSE 8001

# FastAPI app on :8001. The RQ worker uses the SAME image with a different
# command override (see the docker-compose ``worker`` service):
#   uv run --no-sync python -m app.worker
CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
