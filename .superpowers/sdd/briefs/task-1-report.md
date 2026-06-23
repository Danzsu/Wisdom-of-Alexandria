# Task 1 Report — `Book.author` field

**Date:** 2026-06-23
**Branch:** feat/alexandria-ui
**Status:** DONE

---

## Files Changed

| File | Change |
|------|--------|
| `packages/db/alexandria_core/models/book.py` | Added `author: Mapped[str | None]` column after `title` |
| `apps/api/app/schemas/book.py` | Added `author: str | None = Field(default=None, max_length=255)` to `BookCreate` and `BookUpdate`; `author: str | None` to `BookRead` |
| `apps/api/alembic/versions/a7b3c1d2e4f5_add_book_author.py` | New migration: `op.add_column("books", sa.Column("author", ...))` / `op.drop_column` |
| `apps/api/alembic/versions/91516a452442_initial_schema.py` | Added `"author"` to `_COLUMNS_ADDED_LATER["books"]` so the dynamic initial-schema migration does not include it (preventing duplicate column on SQLite full migration run) |
| `apps/api/tests/integration/test_books.py` | Added `test_book_author_round_trips`; moved `import pytest` to top |

---

## Migration

- **Revision ID:** `a7b3c1d2e4f5`
- **down_revision:** `f6a1b2c3d4e5` (was the head before this task)

### Non-obvious detail

`91516a452442_initial_schema.py` dynamically derives the initial schema from `Base.metadata`. Since the ORM model now has `author`, the initial migration would emit `author` in the `CREATE TABLE books` DDL — then our `a7b3c1d2e4f5` migration would fail with `duplicate column name: author` on a fresh SQLite run. Fixed by adding `"author"` to `_COLUMNS_ADDED_LATER["books"]` (exactly the same pattern used for `"series_id"` -> `c3a1b2c3d4e5`).

---

## Test Commands and Results

### Step 2 — Confirm fail (before implementation)

```
uv run --directory apps/api pytest -q -p no:cacheprovider tests/integration/test_books.py::test_book_author_round_trips
```

Result:
```
FAILED tests/integration/test_books.py::test_book_author_round_trips - KeyError: 'author'
1 failed in 0.24s
```

### Step 6 — Confirm pass (after implementation)

```
uv run --directory apps/api pytest -q -p no:cacheprovider tests/integration/test_books.py::test_book_author_round_trips
```

Result:
```
1 passed in 0.11s
```

### Full test_books.py suite

```
uv run --directory apps/api pytest -q -p no:cacheprovider tests/integration/test_books.py
```

Result:
```
18 passed in 0.25s
```

---

## Migration Up/Down/Up Check

```
DATABASE_URL="sqlite+aiosqlite:///./alembic_test.db" uv run --directory apps/api alembic upgrade head
DATABASE_URL="sqlite+aiosqlite:///./alembic_test.db" uv run --directory apps/api alembic downgrade -1
DATABASE_URL="sqlite+aiosqlite:///./alembic_test.db" uv run --directory apps/api alembic upgrade head
```

Result: All three ran clean. Upgrade applied revision `a7b3c1d2e4f5`; downgrade reverted it; upgrade re-applied it with no errors.

---

## Ruff Result

```
uv run --directory apps/api ruff check <all 5 changed files>
All checks passed!
```

---

## Concerns

None. The implementation is straightforward. The `91516a452442_initial_schema.py` fix is essential for any future CI/CD that runs `alembic upgrade head` from scratch on PostgreSQL — it would hit the same duplicate-column issue without it. This pattern is already established in the codebase for `series_id`, `aliases`, `role`, `project_id`, and others.
