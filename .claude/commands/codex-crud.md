Generate or extend Codex CRUD for a ForgeWriter entity type.

Entity: $ARGUMENTS

ForgeWriter Codex entities:
- character — name, role, description, traits, relationships, tegezés/magázás preference
- location — name, type, description, atmosphere, connected_scenes
- worldbuilding — category (magic/history/culture/tech), title, content, tags
- timeline_event — date, title, description, related_characters, related_locations
- plotline — title, type (main/sub), status, arc_structure, scenes

For each entity generate:
1. SQLAlchemy model in apps/api/app/models/<entity>.py
2. Pydantic schema (Create/Update/Response) in apps/api/app/schemas/<entity>.py
3. FastAPI router in apps/api/app/api/v1/<entity>.py (CRUD + search + list by project)
4. pgvector embedding model in apps/api/app/models/embeddings.py
5. React component in apps/web/src/features/codex/components/<Entity>Card.tsx
6. Codex panel list+detail view in apps/web/src/features/codex/pages/<entity>/
