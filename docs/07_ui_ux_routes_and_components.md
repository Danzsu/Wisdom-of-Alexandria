# 07 — UI/UX Routes and Components

## Purpose

This document defines the UI/UX structure for a NovelCrafter-inspired but original AI novel-writing platform.

The interface should feel like a professional writing cockpit:

- planning on the left
- writing in the center
- Codex and AI assistance on the right
- calm visual hierarchy
- fast navigation between book, chapter, scene, and Codex

## Important legal/design note

The UI may be inspired by NovelCrafter-like workflows and layout patterns, but it must not copy:

- exact branding
- exact color palette
- logo
- proprietary icons
- exact screen arrangement pixel-for-pixel
- exact text labels if they are distinctive product copy

Use the product pattern, not the product identity.

## Design goals

The UI should be:

- calm
- dense but readable
- writer-first
- structured
- fast
- keyboard-friendly
- card-based for planning
- editor-focused for writing
- Codex-aware
- AI-assisted but not AI-dominated

## Primary app shell

### Desktop layout

```txt
┌────────────────────────────────────────────────────────────────────────────┐
│ TopBar: Project switcher | Book switcher | Search | AI model status | User │
├────────────────┬──────────────────────────────────────┬────────────────────┤
│ LeftSidebar    │ MainWorkspace                        │ RightInspector     │
│                │                                      │                    │
│ Project        │ Route-specific view                  │ Codex              │
│ Book           │                                      │ AI Assistant       │
│ Plan           │                                      │ Notes              │
│ Write          │                                      │ Warnings           │
│ Codex          │                                      │ Metadata           │
│ Timeline       │                                      │                    │
│ Exports        │                                      │                    │
└────────────────┴──────────────────────────────────────┴────────────────────┘
```

### Behavior

- Left sidebar collapsible.
- Right inspector collapsible.
- Main workspace remains stable.
- Scene context remains visible during writing.
- AI panel never covers the manuscript permanently.
- AI suggestions appear in review panel before insertion.

## Navigation routes

```txt
/projects
/projects/:projectId
/projects/:projectId/books/:bookId/overview
/projects/:projectId/books/:bookId/plan
/projects/:projectId/books/:bookId/write
/projects/:projectId/books/:bookId/chapters/:chapterId
/projects/:projectId/books/:bookId/scenes/:sceneId
/projects/:projectId/codex
/projects/:projectId/codex/characters
/projects/:projectId/codex/characters/:characterId
/projects/:projectId/codex/locations
/projects/:projectId/codex/locations/:locationId
/projects/:projectId/codex/worldbuilding
/projects/:projectId/timeline
/projects/:projectId/relationships
/projects/:projectId/ai-jobs
/projects/:projectId/export
/settings/models
/settings/prompts
```

## Screen 1 — Projects dashboard

### Purpose

List all writing projects.

### Components

- ProjectCard
- CreateProjectDialog
- RecentActivityList
- LocalModelStatusCard
- QuickStartTemplateCard

### Project card fields

- project title
- genre
- language
- book count
- word count
- last edited
- status
- progress bar

### Visual direction

Use large clean cards with subtle metadata. Avoid a file-manager look.

## Screen 2 — Project overview

### Purpose

Show high-level project state.

### Components

- ProjectHeader
- BookList
- CodexSummary
- RecentScenes
- OpenAIJobs
- ProjectProgressStats

### Main actions

- New book
- Open plan
- Open writing view
- Add character
- Add location
- Run project consistency check later

## Screen 3 — Book overview

### Purpose

Show book-level summary and progress.

### Components

- BookHeader
- SynopsisCard
- ChapterProgressList
- PlotlineOverview
- WordCountChart
- StyleGuideCard

### Fields

- title
- subtitle
- logline
- synopsis
- target word count
- current word count
- status

## Screen 4 — Plan board

### Purpose

NovelCrafter-like planning space for chapters and scenes.

### Layout

```txt
┌─────────────────────────────┬─────────────────────────────────────────────┐
│ Chapter column/list         │ Scene cards for selected chapter             │
│                             │                                             │
│ Chapter 1                   │ [Scene card] [Scene card] [Scene card]       │
│ Chapter 2                   │                                             │
│ Chapter 3                   │                                             │
└─────────────────────────────┴─────────────────────────────────────────────┘
```

### Components

- ChapterList
- ChapterCard
- SceneCard
- BeatPreview
- StatusBadge
- AddSceneButton
- DragHandle
- SceneMetadataPopover

### Scene card fields

- title
- POV character
- location
- summary
- status
- word count
- beat count
- warnings count

### Interactions

- drag scenes
- reorder chapters
- add scene
- open scene editor
- duplicate scene
- generate beats
- change status

### Design style

- card grid
- subtle colored status chips
- compact metadata
- calm background
- selected chapter highlighted
- avoid overusing color

## Screen 5 — Write view

### Purpose

Focused manuscript writing.

### Layout

```txt
┌──────────────┬──────────────────────────────────┬─────────────────────────┐
│ Scene tree   │ Manuscript editor                │ Inspector               │
│              │                                  │                         │
│ Chapter 1    │ Scene title                      │ Tabs:                   │
│  Scene 1     │ [Tiptap editor]                  │ - Codex                 │
│  Scene 2     │                                  │ - AI                    │
│ Chapter 2    │                                  │ - Beats                 │
│              │                                  │ - Review                │
└──────────────┴──────────────────────────────────┴─────────────────────────┘
```

### Components

- SceneTree
- ManuscriptEditor
- EditorToolbar
- AIBubbleMenu
- WordCountFooter
- AutosaveStatus
- RightInspectorTabs
- SceneMetadataPanel
- RelatedCodexPanel
- AIActionPanel
- ReviewDiffPanel
- ContinuityWarningsPanel

### AI bubble actions

When text is selected:

- Rewrite
- Expand
- Compress
- Improve dialogue
- Make more literary
- Improve Hungarian
- Show, don't tell
- Explain issue

### Required behavior

- autosave every few seconds
- show save status
- never overwrite text with AI result automatically
- display AI output in review panel
- accept/reject/copy controls

## Screen 6 — Codex

### Purpose

Central knowledge base / Story Bible.

### Codex sections

- Characters
- Locations
- Worldbuilding
- Plotlines
- Timeline
- Style guide
- Relationships

### Layout

```txt
┌────────────────────┬─────────────────────────────────────────────┐
│ Codex nav          │ Table / card list / detail view              │
│                    │                                             │
│ Characters         │ Search + filters                             │
│ Locations          │ Cards or table                               │
│ Worldbuilding      │ Detail drawer                                │
│ Plotlines          │                                             │
└────────────────────┴─────────────────────────────────────────────┘
```

### Character detail tabs

- Overview
- Motivation
- Voice
- Backstory
- Arc
- Relationships
- Scene appearances
- AI notes

### Location detail tabs

- Overview
- Sensory details
- Rules
- Associated characters
- Scenes
- AI notes

### Worldbuilding detail tabs

- Overview
- Rules
- Contradictions to avoid
- Related entities
- Scene usage

### Design style

The Codex should feel like an organized writer database, not an admin CRUD table.

Use:

- searchable cards
- compact metadata chips
- right-side detail drawer
- relationship links
- “used in scenes” badges

## Screen 7 — Timeline

### Purpose

Track chronology and narrative order.

### MVP version

Simple list/table with:

- event title
- relative order
- related characters
- related scenes
- description

### Future version

Timeline visualization with zoom and filters.

## Screen 8 — Relationship map

### Purpose

Visualize character relationships.

### Tech

Use React Flow / xyflow.

### Nodes

- characters
- organizations later
- locations optional later

### Edges

- relationship type
- conflict
- alliance
- romance
- family
- mentor
- enemy

## Screen 9 — AI Jobs / Generation Queue

### Purpose

Track long-running AI workflows.

### Components

- JobList
- JobStatusBadge
- JobDetailPanel
- PromptInputPreview
- RetrievedContextList
- OutputPreview
- AcceptRejectControls

### Job statuses

- queued
- running
- requires_review
- completed
- failed
- accepted
- rejected

## Screen 10 — Export

### Purpose

Export manuscript.

### Export formats

- Markdown in MVP
- DOCX later
- EPUB later
- PDF later

### Components

- ExportFormatSelector
- ExportOptionsPanel
- ChapterSelectionList
- ExportPreview
- ExportJobStatus
- DownloadButton

## Component inventory

### Layout components

```txt
AppShell
TopBar
LeftSidebar
RightInspector
MainWorkspace
ResizablePanelGroup
Breadcrumbs
CommandPalette
```

### Planning components

```txt
ChapterList
ChapterCard
SceneBoard
SceneCard
BeatList
BeatCard
StatusBadge
WordCountBadge
```

### Editor components

```txt
ManuscriptEditor
EditorToolbar
AIBubbleMenu
SelectionActionMenu
AutosaveIndicator
WordCountFooter
RevisionHistoryDrawer
```

### Codex components

```txt
CodexNav
CodexSearch
CodexCardGrid
CodexTable
CharacterCard
CharacterDetail
LocationCard
LocationDetail
WorldbuildingCard
WorldbuildingDetail
RelationshipMiniMap
```

### AI components

```txt
AIAssistantPanel
AIActionButton
AIResultCard
ReviewDiffPanel
ContinuityWarningCard
GenerationJobList
ModelStatusBadge
RetrievedContextList
```

### Export components

```txt
ExportFormatSelector
ExportOptionsPanel
ExportPreview
DownloadButton
```

## Design system

### Color tokens

```ts
export const colors = {
  background: "#f8f6f2",
  surface: "#ffffff",
  surfaceMuted: "#f1eee8",
  border: "#ded8ce",
  text: "#2f2a24",
  textMuted: "#6f675f",
  accent: "#6d5dfc",
  accentMuted: "#ebe9ff",
  success: "#2f7d55",
  warning: "#b7791f",
  danger: "#c2410c",
}
```

### Spacing

```txt
xs: 4px
sm: 8px
md: 12px
lg: 16px
xl: 24px
2xl: 32px
```

### Border radius

```txt
sm: 6px
md: 10px
lg: 14px
xl: 18px
```

### Typography

Use a clean sans-serif UI font.

For manuscript editor, allow user to choose:

- serif writing font
- sans writing font
- monospace only for technical notes, not prose

### UI density

The app should support dense professional UI, but avoid clutter.

Use:

- icons plus labels in nav
- compact metadata chips
- collapsible panels
- tooltips for advanced features
- keyboard shortcuts later

## Key UX rules

1. The writer should always know where they are:
   - project
   - book
   - chapter
   - scene

2. AI should always show:
   - what it used
   - what it changed
   - whether it is safe to accept

3. Codex should be close to writing:
   - right sidebar
   - quick search
   - related entries
   - insert reference into prompt

4. Planning should be visual:
   - scene cards
   - statuses
   - beats
   - drag-and-drop

5. Editing should be safe:
   - revisions
   - accept/reject
   - no silent overwrites

## MVP UI priority

Build in this order:

1. AppShell
2. Projects dashboard
3. Project overview
4. Book plan board
5. Scene editor
6. Codex character/location views
7. AI assistant panel
8. Review panel
9. Export screen
