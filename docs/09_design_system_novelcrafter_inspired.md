# 09 — NovelCrafter-Inspired Design System

## Purpose

This document defines the visual and UX design direction for the AI novel-writing platform.

The goal is to create a product that feels familiar to users of structured writing platforms such as NovelCrafter, while remaining an original product with its own identity.

## Design positioning

The app should feel like:

- a professional writer's cockpit
- a manuscript editor
- a story planning board
- a Codex / Story Bible database
- an AI-assisted creative studio

It should not feel like:

- a generic chatbot
- a Notion clone
- a colorful kanban toy
- a developer dashboard
- a simple text generator
- a copied NovelCrafter skin

## Core visual identity

### Keywords

```txt
calm
structured
warm
literary
focused
dense
soft
editorial
professional
```

### Mood

The app should feel like a quiet writing room with strong organizational tools.

It should support long work sessions without visual fatigue.

## Layout philosophy

Use a three-zone product structure:

```txt
Structure     Work area       Context
Left nav  +   Main view   +   Right inspector
```

### Left nav

Purpose:

- project navigation
- book navigation
- chapter/scene tree
- major sections

Should feel:

- compact
- stable
- predictable
- always available

### Main workspace

Purpose:

- planning board
- editor
- Codex list
- timeline
- export

Should feel:

- focused
- spacious
- primary

### Right inspector

Purpose:

- AI assistant
- Codex context
- metadata
- beats
- review warnings

Should feel:

- contextual
- collapsible
- helpful
- secondary

## Color palette

### Light theme

```ts
export const lightTheme = {
  background: "#f8f6f2",
  backgroundSubtle: "#f3f0ea",
  surface: "#ffffff",
  surfaceSoft: "#fbfaf7",
  surfaceMuted: "#f1eee8",
  border: "#ded8ce",
  borderStrong: "#c9c0b4",

  text: "#2f2a24",
  textSoft: "#4c453d",
  textMuted: "#756d64",
  textFaint: "#9b9187",

  accent: "#6d5dfc",
  accentHover: "#5b4de0",
  accentMuted: "#ebe9ff",
  accentText: "#342a91",

  ai: "#7c3aed",
  aiMuted: "#f0e9ff",

  success: "#2f7d55",
  successMuted: "#e6f3ec",

  warning: "#b7791f",
  warningMuted: "#fff4da",

  danger: "#c2410c",
  dangerMuted: "#fff0e8"
}
```

### Dark theme later

Do not implement dark theme in MVP unless easy through CSS variables.

Future dark theme:

```ts
export const darkTheme = {
  background: "#191714",
  surface: "#23201c",
  surfaceMuted: "#2c2823",
  border: "#403a33",
  text: "#eee7dc",
  textMuted: "#b9afa4",
  accent: "#9187ff",
  accentMuted: "#282343"
}
```

## Typography

### UI font

Use a clean sans-serif font.

Recommended:

```txt
Inter
Geist
Source Sans 3
```

### Manuscript font

Allow user preference later.

Default options:

```txt
Literata
Lora
Merriweather
Georgia
```

### Font scale

```css
--font-xs: 12px;
--font-sm: 13px;
--font-base: 14px;
--font-md: 15px;
--font-lg: 18px;
--font-xl: 22px;
--font-2xl: 28px;
```

## Spacing system

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

## Radius

```css
--radius-sm: 6px;
--radius-md: 10px;
--radius-lg: 14px;
--radius-xl: 18px;
--radius-2xl: 24px;
```

## Shadows

Use very subtle shadows.

```css
--shadow-card: 0 1px 2px rgba(47, 42, 36, 0.06);
--shadow-popover: 0 8px 24px rgba(47, 42, 36, 0.12);
--shadow-panel: 0 2px 10px rgba(47, 42, 36, 0.08);
```

Avoid heavy shadows.

## Component design

## AppShell

### Structure

```txt
TopBar
ResizablePanels
  LeftSidebar
  MainContent
  RightInspector
```

### Requirements

- full viewport height
- fixed top bar
- resizable sidebars later
- collapsible left and right panels
- route-aware breadcrumbs

## TopBar

### Contents

- project switcher
- book switcher
- global search
- local model status
- generation queue indicator
- settings

### Style

- height: 52px
- subtle bottom border
- surface background
- compact controls

## LeftSidebar

### Sections

```txt
Workspace
  Overview
  Plan
  Write
  Codex
  Timeline
  Relationships
  AI Jobs
  Export

Current book
  Chapter tree
```

### Style

- width: 260px default
- background: surfaceMuted
- border-right
- active route accent background
- small icons
- collapsible groups

## RightInspector

### Tabs

```txt
Codex
Beats
AI
Review
Warnings
Metadata
```

### Style

- width: 360px default
- white/surface background
- border-left
- tabbed header
- scrollable content

## Cards

Cards are core to the app.

### ChapterCard

Fields:

- title
- summary
- status
- word count
- scene count
- warnings count

### SceneCard

Fields:

- title
- POV
- location
- summary
- status
- word count
- beat count
- last edited

### CodexCard

Fields:

- name/title
- type
- short description
- tags
- related scenes count

### Card style

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-card);
  padding: 14px;
}
```

### Card interaction

- hover border darkens slightly
- selected card uses accent border and accentMuted background
- drag handle visible on hover
- status badge on top right

## Status badges

### Scene status colors

```txt
idea: neutral
outlined: muted blue
drafting: muted purple
drafted: muted indigo
reviewing: muted amber
revised: muted green
final: strong green
```

Keep badges subtle.

## Manuscript editor

### Requirements

The editor must feel different from admin views.

Use:

- wider line height
- comfortable writing width
- optional centered page mode
- no visual clutter
- floating AI bubble on selection
- bottom word count

### Suggested editor container

```css
.manuscript-editor {
  max-width: 820px;
  margin: 0 auto;
  padding: 48px 64px;
  background: var(--surface);
  border-radius: var(--radius-xl);
  box-shadow: var(--shadow-card);
}
```

### Editor typography

```css
.manuscript-editor {
  font-family: "Literata", Georgia, serif;
  font-size: 17px;
  line-height: 1.75;
  color: var(--text);
}
```

## AI Assistant panel

### Purpose

AI must be contextual and transparent.

### Sections

```txt
Selected context
Available actions
Custom instruction
Model choice
Generate button
Result preview
Accept / Reject / Copy
```

### AI result card

Show:

- action type
- model used
- prompt version
- retrieved Codex entries
- output
- warnings
- accept/reject buttons

## Review / diff design

Use side-by-side or inline diff later.

MVP:

```txt
Original
AI suggestion
[Accept] [Reject] [Copy]
```

Do not auto-apply.

## Codex UI

### Character list

Use cards or table toggle.

Card fields:

- name
- role
- short description
- tags
- scene appearances

### Character detail page

Tabs:

```txt
Overview
Voice
Motivation
Arc
Relationships
Scenes
AI notes
```

### Relationship UI

Use chips first, graph later.

## Board UI

### Chapter/scene board style

```txt
Left column: chapters
Main board: scenes for selected chapter
Right inspector: selected scene metadata
```

### Drag-and-drop

- visible drag handle
- soft drop indicator
- do not animate too aggressively

## Empty states

Empty states should be helpful.

Examples:

```txt
No characters yet.
Create your first character to help the AI keep scenes consistent.
[Create character]
```

```txt
This scene has no beats yet.
Add beats to generate a more controlled first draft.
[Add beat]
```

## Loading states

Use skeletons for:

- project cards
- scene cards
- Codex cards
- editor loading
- AI result loading

For AI generation, show:

- job status
- elapsed time
- model used
- cancel button

## Error states

AI errors should be understandable.

Example:

```txt
Local model is not available.
Check that Ollama is running and the selected model is installed.
```

## UX details that matter

### Always visible context

When writing, show:

- book title
- chapter title
- scene title
- scene status
- POV
- location
- word count

### AI transparency

Every AI action should show:

- model
- task
- source context
- whether cloud was used
- prompt version

### Data safety

Before replacing text:

- create revision
- show confirmation if replacing large text
- allow undo/restore

### Keyboard shortcuts later

Future shortcuts:

```txt
Cmd/Ctrl + K: command palette
Cmd/Ctrl + S: save
Cmd/Ctrl + Shift + A: open AI panel
Cmd/Ctrl + Shift + C: open Codex search
```

## Responsive behavior

MVP desktop-first.

For smaller screens:

- left sidebar collapses
- right inspector becomes drawer
- editor remains primary

## Accessibility

Minimum:

- keyboard focus states
- sufficient contrast
- labels for icon buttons
- no color-only status meaning
- semantic headings
- ARIA for dialogs

## What to avoid

Avoid:

- copying NovelCrafter exactly
- using NovelCrafter name in UI
- overloading the first screen
- making AI the center of everything
- flashy SaaS landing page aesthetic
- excessive gradients
- too many colors
- auto-inserting AI text without approval
- hiding model/cloud usage
