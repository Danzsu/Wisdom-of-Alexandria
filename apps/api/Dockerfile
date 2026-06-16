FROM python:3.12-slim

# Build context is the REPOSITORY ROOT (see docker-compose build.context),
# because apps/api now depends on the workspace member packages/db
# (alexandria-db). A context scoped to apps/api could not reach packages/db.
WORKDIR /workspace

# Install pandoc (DOCX/EPUB export converts Markdown via the pandoc CLI). Done
# as root, before the USER switch, so the binary is on PATH for appuser at
# runtime. Clean apt lists to keep the image lean.
RUN apt-get update \
    && apt-get install -y --no-install-recommends pandoc \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install uv

# Copy workspace manifests + lockfile first (better layer caching). The root
# pyproject declares the uv workspace; the lockfile is the single root lock.
COPY pyproject.toml uv.lock ./
COPY apps/api/pyproject.toml ./apps/api/pyproject.toml
COPY packages/db/pyproject.toml ./packages/db/pyproject.toml

# Copy the shared package source (needed: alexandria-db is an editable
# workspace member, so its source must exist for the build/install step).
COPY packages/db/ ./packages/db/

# Resolve + install the apps/api project (and its alexandria-db workspace dep)
# from the locked workspace, without dev deps.
RUN uv sync --frozen --no-dev --package forgewriter-api

# Copy the API application code last.
COPY apps/api/ ./apps/api/

# Run as a non-root user (defense in depth: a compromised process is unprivileged).
# Create the user AFTER all root-owned installs/copies, then hand the whole
# workspace to it — this includes the uv-managed venv at /workspace/.venv, which
# `uv run --no-sync` must READ at runtime. Without the chown, appuser could not
# read the venv and the app would fail to start.
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /workspace
USER appuser

WORKDIR /workspace/apps/api

# Prompt templates are mounted at /workspace/apps/api/prompts via docker-compose
# (volume ./packages/prompts). Copy is intentionally omitted as a runtime mount.

EXPOSE 8000

CMD ["uv", "run", "--no-sync", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
