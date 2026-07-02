FROM python:3.12-slim

# Build context is the REPOSITORY ROOT (see docker-compose build.context),
# because apps/api now depends on the workspace member packages/db
# (alexandria-db). A context scoped to apps/api could not reach packages/db.
WORKDIR /workspace

# Install pandoc (DOCX/EPUB/PDF export converts Markdown via the pandoc CLI).
# PDF goes through pandoc's --pdf-engine=weasyprint; WeasyPrint itself is a
# Python dependency (see apps/api/pyproject.toml) but needs these native libs at
# runtime (Pango / Cairo / GDK-Pixbuf / HarfBuzz). Done as root, before the USER
# switch, so the binaries/libs are on PATH for appuser at runtime. Clean apt
# lists to keep the image lean.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        pandoc \
        libpango-1.0-0 \
        libpangocairo-1.0-0 \
        libgdk-pixbuf-2.0-0 \
        libffi-dev \
        libharfbuzz0b \
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
# read the venv and the app would fail to start. The chmod covers the
# migrate-then-serve entrypoint (apps/api/docker-entrypoint.sh): a Windows
# checkout's unreliable git exec bit must not yield an unexecutable script.
RUN useradd -m -u 1000 appuser \
    && chown -R appuser:appuser /workspace \
    && chmod +x /workspace/apps/api/docker-entrypoint.sh
USER appuser

WORKDIR /workspace/apps/api

# Prompt templates are mounted at /workspace/apps/api/prompts via docker-compose
# (volume ./packages/prompts). Copy is intentionally omitted as a runtime mount.

EXPOSE 8000

# Migrate-then-serve: docker-entrypoint.sh runs `alembic upgrade head` and then
# exec's uvicorn (exec replaces the shell, so uvicorn receives signals
# directly). Invoked via `sh` explicitly as a second layer of defense against a
# lost exec bit.
CMD ["sh", "docker-entrypoint.sh"]
