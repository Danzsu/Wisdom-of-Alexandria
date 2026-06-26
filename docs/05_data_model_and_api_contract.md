# 05 — Data Model and API Contract

## Purpose

This document defines the core data model and API contract for the agentic AI novel-writing platform.

The system should support a structured NovelCrafter-like workspace with:

- books
- chapters
- scenes
- beats
- Codex entries
- characters
- locations
- worldbuilding
- AI generation jobs
- revision history
- review comments

## Database choice

Use PostgreSQL for structured data.

Use pgvector (PostgreSQL extension) for semantic retrieval over Codex and manuscript summaries. No separate Qdrant service in MVP/V1.

Use Redis for background job queues.

## Global conventions

Every table should include:

```sql
id UUID PRIMARY KEY
created_at TIMESTAMP WITH TIME ZONE NOT NULL
updated_at TIMESTAMP WITH TIME ZONE NOT NULL
```

Most content tables should include:

```sql
project_id UUID
tags TEXT[]
metadata JSONB
```

Prefer explicit columns for important queryable fields. Use JSONB only for flexible metadata.

## Entity overview

```txt
User
  └── Project
        ├── Series               ← IMPLEMENTED: sorozat/al-univerzum (Book + Codex scope)
        ├── Book                 (Book.series_id → Series, nullable)
        │     └── Chapter
        │           └── Scene
        │                 └── Beat
        ├── Character
        │     └── CharacterArc
        ├── Location
        ├── WorldbuildingEntry
        ├── TimelineEvent
        ├── Plotline             ← IMPLEMENTED: cselekményszál (subplot)
        │     └── PlotlineScene  ← IMPLEMENTED: Plotline↔Scene link (related_scenes[])
        ├── Relationship
        ├── CodexRelation        ← kapcsolatok Codex entryk között
        ├── CodexProgression     ← temporális Codex változások (CRUD + AI szűr: „állapot az N. jelenetnél")
        ├── CodexEntry           (search/index layer; + aliases/role/series_id oszlopok)
        ├── Snippet              ← félretett szövegek, töredékek
        ├── StyleGuide
        ├── Provider             ← IMPLEMENTED: AI-provider config (titkosított API-kulcs)
        ├── Embedding            ← IMPLEMENTED: pgvector RAG index (project/book/series scope)
        ├── GenerationJob
        ├── Revision
        └── AIComment
```

> **Megvalósítási megjegyzés (frissítve 2026-06-25):** az élő állapot- és roadmap-leírás a [`docs/17_status_and_roadmap.md`](17_status_and_roadmap.md). Az alábbi tábla-definíciók közül a `Provider`, `Embedding`, `Series` (+ `Book.series_id`), `Plotline`, `PlotlineScene` és a `CodexEntry` `aliases`/`role`/`series_id` oszlopai **megvalósultak** (`packages/db` / `alexandria_core`). A `CodexProgression` immár **nem csak CRUD**: az AI-réteg join-alapú „állapot az N. jelenetnél" linearizációval szűri a progresszió-jegyzeteket az AI-kontextusba (horgony nélkül projekt-globális baseline, horgonyzott = könyv+pozíció-scope). Külön, **workspace-globális** `PromptTemplate` entitás is megvalósult — ez a **felhasználói prompt-könyvtár** (modell + migráció `b3c5d7e9f1a2` + 6 beépített seed + teljes CRUD API, builtin = immutable + létrehozó/szerkesztő/törlő UI). **Megkülönböztetendő** a belső `packages/prompts` rendszer-sablonoktól (a kód által betöltött, verziózott prompt-fájloktól) — a `PromptTemplate` user-facing, DB-ben tárolt, UI-ból szerkeszthető. Lásd `docs/17`.

## Tables

## User

### Purpose

Represents an app user. For local-first MVP, there may be a default local user.

### Fields

```txt
id
email
display_name
created_at
updated_at
settings_json
```

## Project

### Purpose

Top-level writing workspace. A project can contain one or more books and a shared Codex.

### Fields

```txt
id
owner_user_id
title
description
language
genre
target_audience
status
created_at
updated_at
```

### Status enum

```txt
planning
drafting
revision
completed
archived
```

## Series ✅ IMPLEMENTED

### Purpose

Egy Project alatti al-univerzum, amely Bookokat csoportosít és a Codexet scope-olja. `project_id` CASCADE (a projekt törlése törli a sorozatait). A `Book.series_id` és a `CodexEntry.series_id` OPCIONÁLIS és `ON DELETE SET NULL` — a sorozat törlése NEM törli a könyveit/entryjeit, azok projekt-only scope-ra esnek vissza.

### Fields

```txt
id
project_id          (FK projects, CASCADE)
title
description
order_index
created_at
updated_at
```

## Book

### Purpose

Represents a novel or manuscript.

### Fields

```txt
id
project_id
series_id nullable
title
subtitle
logline
synopsis
genre
language
target_word_count
current_word_count
status
order_index
created_at
updated_at
```

### Status enum

```txt
idea
planning
outlining
drafting
reviewing
revising
final
archived
```

## Chapter

### Purpose

Container for scenes.

### Fields

```txt
id
book_id
title
summary
chapter_goal
chapter_conflict
chapter_outcome
order_index
status
target_word_count
current_word_count
created_at
updated_at
```

### Status enum

```txt
idea
outlined
drafting
drafted
reviewing
revised
final
```

## Scene

### Purpose

Smallest primary writing unit.

### Fields

```txt
id
chapter_id
book_id
project_id
title
summary
pov_character_id nullable
location_id nullable
time_marker
order_index
status
text_json
text_markdown
target_word_count
current_word_count
emotional_tone
scene_goal
scene_conflict
scene_outcome
archived_at TIMESTAMP nullable
created_at
updated_at
```

### Status enum

```txt
idea
outlined
drafting
drafted
reviewing
revised
final
```

### Notes

- `text_json` stores editor document structure from Tiptap.
- `text_markdown` stores derived Markdown for export and search.
- Never overwrite scene text from AI without creating a Revision.

## Beat

### Purpose

Structured plot beat inside a scene.

### Fields

```txt
id
scene_id
order_index
goal
conflict
key_reveal
emotional_turn
outcome
required_characters UUID[]
required_codex_entries UUID[]
forbidden_outcomes TEXT[]
created_at
updated_at
```

## Character

### Purpose

Codex entity for fictional characters.

### Fields

```txt
id
project_id
name
aliases TEXT[]
role
short_description
long_description
motivation
goal
fear
internal_conflict
external_conflict
voice_notes
speech_patterns
arc_summary
backstory
appearance
tags TEXT[]
ai_visible BOOLEAN DEFAULT true
created_at
updated_at
```

## CharacterArc

### Purpose

Tracks character development over time.

### Fields

```txt
id
character_id
project_id
title
starting_state
ending_state
key_turning_points JSONB
related_chapters UUID[]
related_scenes UUID[]
created_at
updated_at
```

## Relationship

### Purpose

Character relationship map.

### Fields

```txt
id
project_id
source_character_id
target_character_id
relationship_type
description
status
conflict
history
created_at
updated_at
```

## CodexRelation

### Purpose

Defines relationships between any two Codex entities (Character, Location, WorldbuildingEntry). When the AI retrieves one entity, related entities are candidates for automatic context expansion.

### Fields

```txt
id
project_id
source_type         (character / location / worldbuilding)
source_id
target_type         (character / location / worldbuilding)
target_id
relation_type       (related / connected / requires / excludes / influences)
description nullable
auto_include_in_context BOOLEAN DEFAULT true
created_at
updated_at
```

Bidirectional: A→B implies B→A for context expansion unless excluded. `auto_include_in_context` controls whether the Saliency Engine pulls the related entry when the source is relevant.

---

## CodexProgression

### Purpose

Tracks time-based changes to a Codex entry. An AI generating a scene only receives the Codex state valid up to that scene's point in the narrative — preventing spoilers and maintaining consistency.

### Fields

```txt
id
project_id
codex_entry_type    (character / location / worldbuilding)
codex_entry_id
title               (e.g. "Loses right hand", "True identity revealed")
description         (what changed and why)
override_field nullable   (which field is overridden, e.g. "appearance")
override_value TEXT nullable  (the new value after this progression activates)
activation_type     (after_scene / after_chapter / after_timeline_event)
activates_after_scene_id UUID nullable
activates_after_chapter_id UUID nullable
activates_after_chapter_order INT nullable
is_spoiler BOOLEAN DEFAULT true
created_at
updated_at
```

MVP: schema and CRUD only. **V1 (megvalósítva, 2026-06-25):** the AI layer now filters by progressions via a join-based "state as of scene N" linearization — anchorless progressions form a project-global baseline, anchored ones are book+position scoped, and future states are excluded when building AI context for a given scene. See `docs/17`.

---

## Snippet

### Purpose

Short-form notes, saved text fragments, to-dos, research notes, and discarded drafts. Not part of the manuscript but stored in the project.

### Fields

```txt
id
project_id
book_id nullable
chapter_id nullable
scene_id nullable
title nullable
content TEXT
content_type        (note / todo / saved_draft / research / idea / reference / describe_result)
source_sense nullable  (sight / sound / touch / smell / taste / metaphor / emotional_atmosphere)
tags TEXT[]
created_at
updated_at
```

---

## Location

### Purpose

Codex entity for places.

### Fields

```txt
id
project_id
name
aliases TEXT[]
type
short_description
long_description
sensory_details
mood
rules
associated_characters UUID[]
tags TEXT[]
ai_visible BOOLEAN DEFAULT true
created_at
updated_at
```

## WorldbuildingEntry

### Purpose

Codex entry for lore, systems, organizations, rules, history.

### Fields

```txt
id
project_id
title
aliases TEXT[]
category
short_description
content
rules
contradictions_to_avoid
related_characters UUID[]
related_locations UUID[]
tags TEXT[]
ai_visible BOOLEAN DEFAULT true
created_at
updated_at
```

### Category examples

```txt
magic_system
technology
organization
history
culture
politics
economy
religion
law
object
other
```

## TimelineEvent

### Purpose

Chronological or narrative event tracking.

### Fields

```txt
id
project_id
title
description
timeline_date nullable
relative_order
related_characters UUID[]
related_locations UUID[]
related_chapters UUID[]
related_scenes UUID[]
created_at
updated_at
```

## Plotline ✅ IMPLEMENTED

### Purpose

Cselekményszál (subplot / narratív szál) egy Projecten belül. `project_id` CASCADE; opcionális `book_id` `ON DELETE SET NULL` (egy szál átfoghatja a teljes projektet — `book_id` NULL — vagy egy könyvet; a könyv törlése a szálat projekt-szintre ejti vissza, nem törli). A jelenetek a `PlotlineScene` asszociáción át kapcsolódnak (a `related_scenes[]` link), a szállal együtt CASCADE-törölve.

### Fields

```txt
id
project_id          (FK projects, CASCADE)
book_id nullable    (FK books, SET NULL)
title
description
plotline_type       (str; az engedélyezett halmazt a séma-réteg validálja — lásd Type enum)
status
order_index
created_at
updated_at
```

### Type enum

```txt
main_plot
subplot
character_arc
romance
mystery
antagonist_plan
world_conflict
other
```

## PlotlineScene ✅ IMPLEMENTED

### Purpose

Asszociációs sor, amely egy Scene-t egy Plotline-hoz kapcsol (a `related_scenes[]` link). Mindkét FK CASCADE: a Plotline VAGY a Scene törlése törli a linket (a másik oldalt sosem). Egy jelenet egy adott szálhoz legfeljebb egyszer kapcsolódhat — `UniqueConstraint(plotline_id, scene_id)`.

### Fields

```txt
id
plotline_id         (FK plotlines, CASCADE)
scene_id            (FK scenes, CASCADE)
order_index
created_at
updated_at
```

## CodexEntry

### Purpose

Generic searchable Codex abstraction.

Use this as an indexed/search layer if Character, Location and WorldbuildingEntry remain separate tables.

> **Megvalósítási megjegyzés (2026-06-16):** a `CodexEntry` immár valódi `aliases` (lista, recognition-nevek a kézirat név-szkenjéhez — a `Character.aliases` mintájára), `role` (egyetlen story-role, a `Character.role` mintájára) és `series_id` (opcionális sorozat-scope, FK `series`, `ON DELETE SET NULL`; NULL = projekt-globális) oszlopokkal rendelkezik. Ezek leváltották a korábbi namespace-elt `tags`-kodek interim workaroundot.

### Fields

```txt
id
project_id          (FK projects, CASCADE)
series_id nullable  (FK series, SET NULL; NULL = projekt-globális)
entity_type         (alias az implementációban: entry_type, default "custom")
title
content
aliases             (recognition-nevek; lista)
role nullable       (egyetlen story-role)
ai_visible BOOLEAN DEFAULT true
tags TEXT[]
created_at
updated_at
```

## StyleGuide

### Purpose

Defines stylistic and language rules for the book.

### Fields

```txt
id
project_id
book_id nullable
title
narrative_pov
tense
tone
style_description
dialogue_rules
hungarian_language_rules
forbidden_phrases TEXT[]
preferred_phrases TEXT[]
examples_good TEXT[]
examples_bad TEXT[]
created_at
updated_at
```

## Provider ✅ IMPLEMENTED

### Purpose

Egy AI-provider konfigurációja (lokális Ollama vagy felhős LLM-provider). Az API-kulcs **titkosítva nyugalmi állapotban** (`api_key_encrypted`, Fernet) tárolódik; a plaintext kulcs sosem perzisztálódik, sosem kerül logba, és a Read-séma maszkolt értéket ad vissza (sosem a teljeset). A `ModelRouter` innen olvassa a kulcsokat/base URL-eket. Az `apps/ai` szolgáltatás tulajdona.

### Fields

```txt
id
type                (ollama | gemini | anthropic | openai | openrouter | custom)
label
api_key_encrypted nullable   (Fernet-ciphertext; lokális Ollamánál NULL)
base_url nullable            (egyedi / OpenAI-kompatibilis végponthoz)
default_model nullable
embedding_model nullable     (RAG embedding-modell; felhős default text-embedding-3-small / 1536-dim)
enabled
created_at
updated_at
```

## Embedding ✅ IMPLEMENTED

### Purpose

Egy RAG-indexelhető entitás eltárolt embedding-vektora (codex / character / location / worldbuilding / scene / chapter / styleguide). A `content_hash` engedi átugrani a változatlan tartalom újra-embeddelését; az `(entity_type, entity_id)` egyediség pontosan egy aktuális vektort tart entitásonként (újra-embeddeléskor a sor in-place frissül).

**Scope:** a RAG **PROJEKT-szinten** működik — `project_id` a NEM-null elsődleges retrieval-scope minden soron. A `book_id` NULLABLE, csak kézirat-entitásoknál (scene/chapter) van kitöltve (provenance + jövőbeli per-könyv szűrő); projekt-globális entitásoknál (codex/character/location/worldbuilding/styleguide) NULL. A `series_id` NULLABLE (B3b sorozat-tudatosság): NULL = projekt-globális (minden könyv látja), kitöltve = sorozat-scope (csak az adott sorozat könyvei húzzák be); `ON DELETE SET NULL`. A retrieval `series_id IS NULL OR series_id == <aktív sorozat>` szerint szűr, így más sorozat codexe/kézirata sosem szivárog be.

**Dialektus-tudatos `Vector` típus:** PostgreSQL-en valódi `vector(1536)` oszlop **hnsw** ANN-indexszel (cosine-distance), a SQLite teszt-DB-n `JSON` tömb — így a modell mindkét backenden betöltődik `Base.metadata.create_all` alatt. `EMBEDDING_DIM = 1536`.

### Fields

```txt
id
project_id          (FK projects, CASCADE; NOT NULL — elsődleges retrieval-scope)
book_id nullable    (FK books, CASCADE; csak scene/chapter soroknál)
series_id nullable  (FK series, SET NULL; NULL = projekt-globális)
entity_type         (codex | character | location | worldbuilding | scene | chapter | styleguide)
entity_id
content_hash        (a forrásszöveg hash-e — változatlan tartalom kihagyásához)
embedding nullable  (Vector(1536) pgvectoron / JSON SQLite-on)
model_name          (az embedding-modell neve)
dim                 (a tárolt vektor-szélesség; EMBEDDING_DIM-et tükrözi)
created_at
updated_at
```

### Constraints

```txt
UNIQUE (entity_type, entity_id)   — pontosan egy aktuális vektor entitásonként
```

## GenerationJob

### Purpose

Tracks long-running AI tasks.

### Fields

```txt
id
project_id
book_id nullable
chapter_id nullable
scene_id nullable
job_type
status
model_provider
model_name
prompt_version
input_json
output_json
error_message nullable
created_by_user_id
created_at
updated_at
started_at nullable
completed_at nullable
```

### Job type enum

```txt
brainstorm
rewrite
describe
quick_edit
expand
compress
scene_draft
chapter_plan
chapter_draft
continuity_check
style_polish
hungarian_polish
developmental_edit
export
embedding_refresh
```

### Status enum

```txt
queued
running
requires_review
completed
failed
cancelled
accepted
rejected
```

## Revision

### Purpose

Version history for manuscript and Codex changes.

### Fields

```txt
id
project_id
entity_type
entity_id
revision_type
before_json
after_json
change_summary
created_by
generation_job_id nullable
created_at
```

### Revision type enum

```txt
manual_edit
ai_rewrite
ai_generation
ai_polish
restore
import
```

## AIComment

### Purpose

Stores AI review comments and warnings.

### Fields

```txt
id
project_id
book_id nullable
chapter_id nullable
scene_id nullable
target_entity_type
target_entity_id
comment_type
severity
message
suggestion
related_codex_entry_ids UUID[]
status
generation_job_id nullable
created_at
updated_at
```

### Comment type enum

```txt
continuity
lore_conflict
character_voice
style
hungarian_language
plot_logic
pacing
dialogue
show_dont_tell
```

### Severity enum

```txt
info
warning
major
critical
```

### Status enum

```txt
open
accepted
dismissed
fixed
```

## API conventions

Base path:

```txt
/api/v1
```

All responses should use JSON.

All list endpoints should support:

```txt
limit
offset
search
sort
```

## Project endpoints

```http
GET /api/v1/projects
POST /api/v1/projects
GET /api/v1/projects/{project_id}
PATCH /api/v1/projects/{project_id}
DELETE /api/v1/projects/{project_id}
```

### Create project request

```json
{
  "title": "The Glass City",
  "description": "A Hungarian fantasy novel project.",
  "language": "hu",
  "genre": "fantasy"
}
```

## Book endpoints

```http
GET /api/v1/projects/{project_id}/books
POST /api/v1/projects/{project_id}/books
GET /api/v1/books/{book_id}
PATCH /api/v1/books/{book_id}
DELETE /api/v1/books/{book_id}
```

## Chapter endpoints

```http
GET /api/v1/books/{book_id}/chapters
POST /api/v1/books/{book_id}/chapters
GET /api/v1/chapters/{chapter_id}
PATCH /api/v1/chapters/{chapter_id}
DELETE /api/v1/chapters/{chapter_id}
POST /api/v1/books/{book_id}/chapters/reorder
```

### Reorder chapters request

```json
{
  "chapter_ids": [
    "uuid-1",
    "uuid-2",
    "uuid-3"
  ]
}
```

## Scene endpoints

```http
GET /api/v1/chapters/{chapter_id}/scenes
POST /api/v1/chapters/{chapter_id}/scenes
GET /api/v1/scenes/{scene_id}
PATCH /api/v1/scenes/{scene_id}
DELETE /api/v1/scenes/{scene_id}
POST /api/v1/chapters/{chapter_id}/scenes/reorder
```

### Update scene text request

```json
{
  "text_json": {},
  "text_markdown": "Scene text in markdown",
  "current_word_count": 1280
}
```

## Beat endpoints

```http
GET /api/v1/scenes/{scene_id}/beats
POST /api/v1/scenes/{scene_id}/beats
PATCH /api/v1/beats/{beat_id}
DELETE /api/v1/beats/{beat_id}
POST /api/v1/scenes/{scene_id}/beats/reorder
```

## Codex endpoints

```http
GET /api/v1/projects/{project_id}/characters
POST /api/v1/projects/{project_id}/characters
GET /api/v1/characters/{character_id}
PATCH /api/v1/characters/{character_id}
DELETE /api/v1/characters/{character_id}

GET /api/v1/projects/{project_id}/locations
POST /api/v1/projects/{project_id}/locations
GET /api/v1/locations/{location_id}
PATCH /api/v1/locations/{location_id}
DELETE /api/v1/locations/{location_id}

GET /api/v1/projects/{project_id}/worldbuilding
POST /api/v1/projects/{project_id}/worldbuilding
GET /api/v1/worldbuilding/{entry_id}
PATCH /api/v1/worldbuilding/{entry_id}
DELETE /api/v1/worldbuilding/{entry_id}
```

## Search endpoints

```http
GET /api/v1/projects/{project_id}/search?q=
POST /api/v1/projects/{project_id}/semantic-search
```

### Semantic search request

```json
{
  "query": "What does Anna know about the forbidden city?",
  "entity_types": ["character", "location", "worldbuilding", "scene_summary"],
  "limit": 10
}
```

## AI endpoints

```http
POST /api/v1/ai/rewrite
POST /api/v1/ai/quick-edit
POST /api/v1/ai/write-continue
POST /api/v1/ai/write-guided
POST /api/v1/ai/brainstorm
POST /api/v1/ai/describe
POST /api/v1/ai/expand
POST /api/v1/ai/compress
POST /api/v1/ai/generate-scene
POST /api/v1/ai/check-continuity
POST /api/v1/ai/polish-hungarian
POST /api/v1/ai/feedback
GET /api/v1/generation-jobs/{job_id}
POST /api/v1/generation-jobs/{job_id}/accept
POST /api/v1/generation-jobs/{job_id}/reject
```

### Codex Relation endpoints

```http
GET /api/v1/projects/{project_id}/codex-relations
POST /api/v1/projects/{project_id}/codex-relations
PATCH /api/v1/codex-relations/{relation_id}
DELETE /api/v1/codex-relations/{relation_id}
```

### Codex Progression endpoints

```http
GET /api/v1/projects/{project_id}/codex-progressions
POST /api/v1/projects/{project_id}/codex-progressions
PATCH /api/v1/codex-progressions/{progression_id}
DELETE /api/v1/codex-progressions/{progression_id}
```

### Snippet endpoints

```http
GET /api/v1/projects/{project_id}/snippets
POST /api/v1/projects/{project_id}/snippets
PATCH /api/v1/snippets/{snippet_id}
DELETE /api/v1/snippets/{snippet_id}
```

### AI rewrite request

```json
{
  "project_id": "uuid",
  "scene_id": "uuid",
  "selected_text": "Original selected text",
  "action": "improve_hungarian_style",
  "instructions": "Make it more natural and less explanatory.",
  "model_preference": "local"
}
```

### AI rewrite response

```json
{
  "job_id": "uuid",
  "status": "requires_review",
  "result": {
    "rewritten_text": "Rewritten text",
    "explanation": "Short explanation",
    "warnings": []
  }
}
```

### AI describe request

```json
{
  "project_id": "uuid",
  "scene_id": "uuid",
  "selected_text": "a rozsdás kapupánt",
  "preceding_context": "Az utca végén megállt. Valami húzta visszafelé...",
  "senses": ["sight", "sound", "touch", "smell", "taste", "metaphor"],
  "model_preference": "local"
}
```

The `preceding_context` field should contain up to 200 words before the selection. The `senses` array controls which channels are generated — all six are included by default.

### AI describe response

```json
{
  "job_id": "uuid",
  "status": "requires_review",
  "results": [
    {
      "sense": "sight",
      "label": "Látás",
      "text": "A vas rozsdafoltjai barnásvörös virágként nyíltak szét a kapupánton..."
    },
    {
      "sense": "sound",
      "label": "Hang",
      "text": "A fém nyikorgása betört a csendbe, mint egy rekedt figyelmeztetés..."
    },
    {
      "sense": "touch",
      "label": "Tapintás",
      "text": "Ujjai hegyén a hideg fém szúrt, az egyenetlen felület mint megszáradt seb..."
    },
    {
      "sense": "smell",
      "label": "Szag",
      "text": "Vas, nedves kő és valami régi, savanyú szag — az elhagyatottság illata..."
    },
    {
      "sense": "taste",
      "label": "Íz",
      "text": "A száján érezte a rozsda kesernyés fémízét, mint amikor régi érmét szorít a nyelve alá..."
    },
    {
      "sense": "metaphor",
      "label": "Metaforák",
      "text": "A kapupánt olyan volt, mint egy megöregedett katonai kitüntetés — régen fényes, most már csak a sebek emléke maradt..."
    }
  ]
}
```

Each result card is shown independently in the AI panel. The user can select text within a card to insert it into the manuscript, or star the card to save it as a Snippet (`content_type: describe_result`, `source_sense: sight` etc.).

### Generate scene request

```json
{
  "project_id": "uuid",
  "scene_id": "uuid",
  "model_preference": "local",
  "target_word_count": 1800,
  "include_codex": true,
  "include_previous_scene_summary": true
}
```

### Generate scene response

```json
{
  "job_id": "uuid",
  "status": "requires_review",
  "result": {
    "draft_markdown": "Generated scene draft",
    "summary": "Short generated scene summary",
    "used_codex_entries": ["uuid"],
    "warnings": []
  }
}
```

## Export endpoints

```http
POST /api/v1/books/{book_id}/exports
GET /api/v1/export-jobs/{export_job_id}
GET /api/v1/export-jobs/{export_job_id}/download
```

### Export request

```json
{
  "format": "markdown",
  "include_front_matter": true,
  "include_scene_separators": true
}
```

## Frontend route map

```txt
/projects
/projects/:projectId
/projects/:projectId/books/:bookId/plan
/projects/:projectId/books/:bookId/write
/projects/:projectId/codex
/projects/:projectId/characters/:characterId
/projects/:projectId/locations/:locationId
/projects/:projectId/timeline
/projects/:projectId/relationships
/projects/:projectId/ai-jobs
/projects/:projectId/export
/settings/models
```

## Required seed data

Create a demo project with:

- one fantasy book
- three chapters
- seven scenes
- three characters
- two locations
- five worldbuilding entries
- one style guide
- one scene with beats
