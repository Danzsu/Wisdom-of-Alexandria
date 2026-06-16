#!/usr/bin/env bash
#
# Regenerate the FE↔BE type contract in `packages/shared` from the backend
# FastAPI OpenAPI documents. The backend OpenAPI is the SINGLE SOURCE OF TRUTH;
# the generated `packages/shared/src/{api,ai}.ts` are committed artifacts that
# CI validates with `git diff --exit-code` (a stale checkout fails CI).
#
# Pipeline:
#   1. Dump each app's OpenAPI to JSON in a SEPARATE Python process. Both apps
#      use the top-level package name `app`, so they CANNOT be imported in one
#      process — hence two `uv run` invocations from each app directory.
#   2. Run `openapi-typescript` on each JSON to (re)generate the TS types.
#
# Reproducible: running it twice produces no git diff.
#
# Usage (from anywhere): scripts/gen-shared-types.sh
set -euo pipefail

# Repo root = parent of this script's dir, regardless of caller cwd.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
SHARED="$ROOT/packages/shared"
OPENAPI_DIR="$SHARED/openapi"
SRC_DIR="$SHARED/src"

mkdir -p "$OPENAPI_DIR" "$SRC_DIR"

DUMP='import json,app.main; print(json.dumps(app.main.app.openapi(), sort_keys=True))'

echo "==> Dumping apps/api OpenAPI -> openapi/api.json"
(cd "$ROOT/apps/api" && uv run python -c "$DUMP") > "$OPENAPI_DIR/api.json"

echo "==> Dumping apps/ai OpenAPI  -> openapi/ai.json"
(cd "$ROOT/apps/ai" && uv run python -c "$DUMP") > "$OPENAPI_DIR/ai.json"

echo "==> Generating TS types with openapi-typescript"
# Use the workspace-pinned openapi-typescript (root devDependency). Pass
# REPO-RELATIVE paths from the repo root: openapi-typescript URL-encodes
# absolute paths, which corrupts non-ASCII path segments on some systems.
(cd "$ROOT" && corepack pnpm exec openapi-typescript \
  packages/shared/openapi/api.json -o packages/shared/src/api.ts)
(cd "$ROOT" && corepack pnpm exec openapi-typescript \
  packages/shared/openapi/ai.json -o packages/shared/src/ai.ts)

echo "==> Done. Generated:"
echo "      packages/shared/openapi/api.json + src/api.ts"
echo "      packages/shared/openapi/ai.json  + src/ai.ts"
