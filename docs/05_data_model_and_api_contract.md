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

Use Qdrant for semantic retrieval over Codex and manuscript summaries.

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
        ├── Series
        ├── Book
        │     └── Chapter
        │           └── Scene
        │                 └── Beat
        ├── Character
        │     └── CharacterArc
        ├── Location
        ├── WorldbuildingEntry
        ├── TimelineEvent
        ├── Plotline
        ├── Relationship
        ├── StyleGuide
        ├── GenerationJob
        ├── Revision
        └── AIComment
```

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

## Series

### Purpose

Groups multiple books into a shared universe.

### Fields

```txt
id
project_id
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

## Location

### Purpose

Codex entity for places.

### Fields

```txt
id
project_id
name
type
short_description
long_description
sensory_details
mood
rules
associated_characters UUID[]
tags TEXT[]
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
category
short_description
content
rules
contradictions_to_avoid
related_characters UUID[]
related_locations UUID[]
tags TEXT[]
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

## Plotline

### Purpose

Tracks main plot, subplot, romance arc, mystery thread, etc.

### Fields

```txt
id
project_id
book_id nullable
title
description
type
status
related_characters UUID[]
related_scenes UUID[]
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

## CodexEntry

### Purpose

Generic searchable Codex abstraction.

Use this as an indexed/search layer if Character, Location and WorldbuildingEntry remain separate tables.

### Fields

```txt
id
project_id
entity_type
entity_id
title
content
summary
tags TEXT[]
embedding_status
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
POST /api/v1/ai/brainstorm
POST /api/v1/ai/generate-scene
POST /api/v1/ai/check-continuity
POST /api/v1/ai/polish-hungarian
GET /api/v1/generation-jobs/{job_id}
POST /api/v1/generation-jobs/{job_id}/accept
POST /api/v1/generation-jobs/{job_id}/reject
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
