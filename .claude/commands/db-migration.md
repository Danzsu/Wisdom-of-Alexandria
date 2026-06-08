Generate an Alembic database migration for ForgeWriter AI.

What changed: $ARGUMENTS

Migration rules:
- Models live in apps/api/app/models/
- All models inherit from Base (apps/api/app/db/base.py)
- Always use UUID primary keys
- All tables need: id, created_at, updated_at
- project_id FK must be on all content entities (scene, chapter, character, etc.)
- pgvector columns: use Vector(1536) for OpenAI embeddings or Vector(768) for smaller models
- Use explicit status Enums, not raw strings

Generate migration:
  cd apps/api && alembic revision --autogenerate -m "$ARGUMENTS"

Then review the generated file in apps/api/alembic/versions/ before running:
  cd apps/api && alembic upgrade head
