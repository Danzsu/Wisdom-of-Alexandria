# 04 — MVP Implementation Plan

> **⚠️ HISTORICAL ARTIFACT — the MVP is shipped.**
> This document is the original MVP implementation plan, kept for historical context. The MVP described here has been built and delivered (CRUD, AI rewrite/describe/generate/continue, RAG, Markdown/DOCX/EPUB export, and more). It is **not** a live work tracker.
> **For current status and the live roadmap, see [`docs/17_status_and_roadmap.md`](17_status_and_roadmap.md).**

## Purpose

This document defines the first practical development plan for the local/self-hosted agentic novel-writing workspace.

The MVP should prove that the system can support a NovelCrafter-like writing flow:

1. Create a book project.
2. Build a Codex.
3. Plan chapters and scenes.
4. Write in a focused editor.
5. Use a local AI model to rewrite or draft scenes.
6. Export the manuscript.

## MVP success criteria

The MVP is successful when a writer can:

- create a project
- create a book inside the project
- create chapters
- create scenes under chapters
- create character and location Codex entries
- write text in a rich text editor
- select text and ask AI to rewrite it
- create beats for a scene
- generate a first-draft scene from beats
- view chapter/scene structure in a board
- export the book to Markdown
- run everything locally with Docker Compose and Ollama

## Non-goals for MVP

Do not implement these in MVP:

- full automatic book generation
- multi-user collaboration
- payment or subscription
- cloud SaaS hosting
- image generation
- real-time multiplayer editing
- advanced publishing templates
- mobile app
- plugin marketplace
- complete graph/timeline system

## Phase 0 — Repository scaffold

### Goal

Create the initial monorepo structure.

### Suggested structure

```txt
forgewriter-ai/
  apps/
    web/
    api/
  packages/
    shared/
    prompts/
  infra/
    docker/
  docs/
  scripts/
  CLAUDE.md
  docker-compose.yml
  README.md
```

### Acceptance criteria

- frontend app starts
- backend app starts
- Docker Compose starts Postgres, Redis, Qdrant, Ollama placeholder
- README includes local setup
- environment variables are documented

## Phase 1 — Database foundation

### Goal

Create the core relational schema.

### Entities

- User
- Project
- Series
- Book
- Chapter
- Scene
- Beat
- Character
- Location
- WorldbuildingEntry
- StyleGuide
- GenerationJob
- Revision
- AIComment

### Acceptance criteria

- migrations exist
- seed script creates demo project
- database can be reset locally
- all core entities have created_at and updated_at
- order fields exist for chapters, scenes, and beats

## Phase 2 — Project / Book / Chapter / Scene CRUD

### Goal

Allow the user to manage manuscript structure.

### Frontend screens

- `/projects`
- `/projects/[projectId]`
- `/projects/[projectId]/books/[bookId]/plan`
- `/projects/[projectId]/books/[bookId]/write`

### API endpoints

- `GET /projects`
- `POST /projects`
- `GET /projects/{project_id}`
- `POST /projects/{project_id}/books`
- `POST /books/{book_id}/chapters`
- `POST /chapters/{chapter_id}/scenes`
- `PATCH /chapters/{chapter_id}`
- `PATCH /scenes/{scene_id}`
- `DELETE /scenes/{scene_id}`

### Acceptance criteria

- user can create a project
- user can create a book
- user can create and reorder chapters
- user can create and reorder scenes
- user can edit chapter and scene metadata

## Phase 3 — Codex MVP

### Goal

Implement a NovelCrafter-like Codex foundation.

### Codex entry types

- Character
- Location
- WorldbuildingEntry
- StyleGuide

### Character fields

- name
- aliases
- role
- short_description
- long_description
- motivation
- fear
- goal
- conflict
- voice_notes
- arc_summary
- tags

### Location fields

- name
- type
- short_description
- sensory_details
- rules
- mood
- associated_characters
- tags

### Worldbuilding fields

- title
- category
- content
- rules
- contradictions_to_avoid
- tags

### Acceptance criteria

- user can create and edit characters
- user can create and edit locations
- user can create and edit worldbuilding entries
- user can search Codex entries
- scene editor can show related Codex entries in right sidebar

## Phase 4 — NovelCrafter-like layout and navigation

### Goal

Implement a polished writing workspace UI.

### Layout

```txt
┌─────────────────────────────────────────────────────────────┐
│ Top bar: Project / Book / Search / Model status              │
├──────────────┬───────────────────────────────┬──────────────┤
│ Left nav     │ Main workspace                │ Right panel  │
│              │                               │              │
│ Project      │ Editor / Board / Codex table  │ Codex / AI   │
│ Book         │                               │ Review       │
│ Plan         │                               │ Warnings     │
│ Write        │                               │              │
│ Codex        │                               │              │
│ Timeline     │                               │              │
│ Export       │                               │              │
└──────────────┴───────────────────────────────┴──────────────┘
```

### Acceptance criteria

- responsive three-pane layout on desktop
- collapsible sidebars
- active route highlighting
- scene/chapter context is always visible
- right panel can switch between Codex, AI Assistant, Notes, and Warnings

## Phase 5 — Tiptap manuscript editor

### Goal

Create a serious rich text writing editor.

### Features

- headings
- paragraphs
- bold / italic
- block quote
- scene separator
- word count
- autosave
- selected text actions
- AI action bubble menu
- revision snapshot before AI replace

### Acceptance criteria

- scene text can be edited and autosaved
- user can switch scenes without losing content
- selected text opens AI actions
- previous version is saved before AI rewrite
- editor has distraction-free mode

## Phase 6 — Chapter and scene board

### Goal

Create a card-based planning board.

### Views

- chapter list
- chapter cards with scene count and word count
- scene cards inside selected chapter
- drag-and-drop scene reordering
- beat preview on scene cards
- status badges

### Scene statuses

- idea
- outlined
- drafting
- drafted
- reviewing
- revised
- final

### Acceptance criteria

- scenes can be reordered with drag-and-drop
- status can be changed
- scene metadata visible on card
- board visually resembles a professional writing planner

## Phase 7 — Local AI connection

### Goal

Connect backend to Ollama or another local model provider.

### Model provider abstraction

Create a model router with provider abstraction:

```txt
ModelProvider
  - generate()
  - stream()
  - embed() optional
```

### Required providers for MVP

- OllamaChatProvider
- MockProvider for tests

### Acceptance criteria

- backend can call local model
- model name is configurable
- failed AI calls return useful error
- frontend shows model connection status

## Phase 8 — AI rewrite selected text

### Goal

Implement the first useful Sudowrite-like function.

### Actions

- Rewrite naturally
- Make more literary
- Make dialogue more natural
- Expand
- Compress
- Improve Hungarian style
- Show, don't tell

### Acceptance criteria

- user selects text
- user chooses action
- backend sends prompt to local model
- result appears in review panel
- user can accept, reject, or copy result
- original text is not overwritten without approval

## Phase 9 — Scene beats and scene generation

### Goal

Implement controlled BookNova-lite scene drafting.

### Scene beat fields

- goal
- conflict
- key_reveal
- emotional_turn
- outcome
- characters_present
- location_id
- required_lore
- forbidden_outcomes

### Generation flow

1. User selects scene.
2. User adds beats.
3. Backend retrieves relevant Codex entries.
4. Prompt is assembled.
5. Local model generates scene draft.
6. Draft appears in review panel.
7. User accepts into editor or saves as alternate draft.

### Acceptance criteria

- beats can be created and ordered
- generated scene uses selected POV, characters, and location
- generated output is saved as AI draft
- user decides whether to insert it

## Phase 10 — Markdown export

### Goal

Create first export pipeline.

### Export flow

1. Load book.
2. Sort chapters by order.
3. Sort scenes by order.
4. Convert scene rich text to Markdown.
5. Add chapter headings.
6. Generate `.md` file.

### Acceptance criteria

- user can export full book to Markdown
- output contains chapters in correct order
- scene separators are preserved
- file is downloadable

## Suggested first sprint

Build only these:

1. repo scaffold
2. Docker Compose
3. database schema
4. Project / Book / Chapter / Scene CRUD
5. basic NovelCrafter-like layout
6. Codex character CRUD

## Suggested second sprint

Build:

1. Tiptap scene editor
2. autosave
3. chapter/scene board
4. Codex right sidebar
5. seed demo project

## Suggested third sprint

Build:

1. Ollama integration
2. selected text rewrite
3. review panel
4. revision history
5. scene beats

## Suggested fourth sprint

Build:

1. scene generation from beats
2. local RAG over Codex
3. Markdown export
4. first continuity checker prototype

## Definition of done for MVP

The MVP is done when the user can write a short Hungarian chapter with:

- 3 characters
- 1 location
- 1 chapter
- 3 scenes
- beats for each scene
- local AI-generated scene draft
- manual editing
- Markdown export
