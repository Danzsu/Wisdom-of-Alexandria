#!/bin/sh
# Container entrypoint for the apps/api service (the SCHEMA OWNER).
#
# Runs the Alembic migrations before starting uvicorn so a fresh
# `docker compose up` boots against a fully migrated database. Previously
# `alembic upgrade head` was a separate manual/CI-only step and a brand-new
# compose stack came up schema-less.
#
# - Idempotent: `alembic upgrade head` is a no-op on an already-migrated DB,
#   so container restarts are safe.
# - Failure-loud: `set -eu` aborts the container (non-zero exit) if the
#   migration fails; compose `restart: unless-stopped` retries, and the
#   failure is visible in `docker compose logs api`.
# - No DB wait loop needed here: docker-compose gates this service on
#   `postgres: condition: service_healthy`, so Postgres accepts connections
#   by the time this script runs.
#
# Only the api service migrates. The ai/worker services share the schema but
# do NOT own it — they gate on the api healthcheck instead (see
# docker-compose.yml) so the schema exists before they serve anything.
set -eu

echo "[entrypoint] applying database migrations: alembic upgrade head"
uv run --no-sync alembic upgrade head
echo "[entrypoint] migrations up to date; starting uvicorn"

exec uv run --no-sync uvicorn app.main:app --host 0.0.0.0 --port 8000
