# 11 — Claude Design Prompt

Ez a dokumentum egy kész promptot tartalmaz, amit Claude Design-nak (vagy bármely design AI-nak) oda lehet adni a **Wisdom of Alexandria** UI megtervezéséhez.

> **Megjegyzés:** A termék mostani neve **Wisdom of Alexandria** (a korábbi „ForgeWriter AI" munkanév elavult). Az aktuális UI-akcentus **lila `#6d5dfc`** — az arany csak másodlagos kiemelő szín. A fontkészlet: **Inter** (UI), **Literata** (kézirat), **Cormorant Garamond** (display/címsorok), **Caveat** (kézírás / wordmark).
>
> **Phase-1 kész:** a design-rendszer alapjai már leszállítva — Skeleton / Empty / Error state minták, Radix Select, Accordion, és WCAG-AA megfelelés. A Codex képgenerálás és a könyvborító-generálás szintén él. Az alábbi prompt friss, használható design-promptként megmaradt.

---

## Teljes design prompt

```
Design a professional AI-assisted novel writing workspace called "Wisdom of Alexandria".

PRODUCT TYPE: A structured writing cockpit — not a chatbot, not a Notion clone.
Think: manuscript editor + story planning board + Codex database + AI assistant panel.

VISUAL IDENTITY:
- Calm, focused, warm, literary, editorial
- Light theme (dark theme later)
- Background: #f8f6f2 (warm off-white)
- Surface: #ffffff
- Surface muted: #f1eee8
- Border: #ded8ce
- Text: #2f2a24 (dark warm brown)
- Text muted: #6f675f
- Accent (PRIMARY): #6d5dfc (muted purple) — this is the main accent direction
- Accent muted: #ebe9ff
- Secondary accent: warm gold (used sparingly for highlights/wordmark flourishes only — NOT the primary accent)
- AI highlight: #7c3aed
- Success: #2f7d55
- Warning: #b7791f
- Danger: #c2410c
- Font UI: Inter
- Font manuscript: Literata (serif)
- Font display / headings: Cormorant Garamond (serif)
- Font hand / wordmark: Caveat (handwriting)
- Font scale: 12–28px
- Border radius: 6–18px
- Shadows: very subtle (1–2px, low opacity)

LAYOUT — Three-pane structure:
┌─────────────────────────────────────────────────────┐
│ TopBar: Project / Book / Search / Model status       │
├──────────────┬─────────────────────────┬────────────┤
│ LeftSidebar  │ MainWorkspace           │ RightPanel │
│ 260px        │ flexible                │ 360px      │
│              │                         │            │
│ - Overview   │ - Plan board (scenes)   │ - Codex    │
│ - Plan       │ - Write (editor)        │ - AI       │
│ - Write      │ - Codex database        │ - Beats    │
│ - Codex      │ - Timeline              │ - Warnings │
│ - Timeline   │ - Export                │ - Metadata │
│ - Export     │                         │            │
└──────────────┴─────────────────────────┴────────────┘

SCREENS TO DESIGN:

1. PROJECTS DASHBOARD
- Large clean project cards
- Fields: title, genre, language, book count, word count, status, last edited
- "Create project" prominent button
- Local model status indicator (small green/red badge)

2. BOOK PLAN BOARD
- Left column: chapter list with status badges
- Main area: scene cards grid for selected chapter
- Scene card fields: title, POV character, location, summary, status badge, word count, beat count
- Status colors: planned=gray, drafting=purple, drafted=indigo, reviewing=amber, final=green
- Drag handles visible on hover
- "Add scene" button at bottom

3. WRITE VIEW (most important screen)
Left sidebar:
- Collapsible chapter tree
- Active scene highlighted

Center manuscript editor:
- max-width 820px, centered
- Serif font (Literata), 17px, line-height 1.75
- White card with soft shadow
- Floating AI bubble menu on text selection (Rewrite / Expand / Improve Hungarian / Show don't tell)
- Bottom: word count + autosave status

Right inspector (tabbed):
Tab 1: AI Assistant
- Selected text preview
- Action buttons (Rewrite, Expand, Compress, Dialogue, Hungarian)
- Custom instruction input
- Model selector (local/cloud)
- Generate button
- Result card: before/after text, [Accept] [Reject] buttons

Tab 2: Codex
- Related characters (avatars + name + role)
- Related locations
- Quick search

Tab 3: Beats
- Beat list for current scene
- Goal / Conflict / Outcome fields
- "Generate scene from beats" button

Tab 4: Warnings
- Continuity issues (character, location, timeline, lore)
- Severity: info / warning / critical

4. CODEX VIEW
- Left nav: Characters / Locations / Worldbuilding / Plotlines / Timeline
- Main: searchable card grid or table toggle
- Character card: avatar placeholder, name, role chip, short description, tags
- Right drawer: character detail tabs (Overview / Voice / Arc / Relationships / Scenes)

COMPONENT DETAILS:
- Status badges: rounded, soft colors, 12px text
- AI actions: purple/violet accent, subtle glow on hover
- Cards: white surface, 1px warm border, 12px radius, 1–2px shadow
- Drag handles: 6-dot icon, visible on hover
- Empty states: helpful, not generic ("Add beats to help AI draft better scenes")
- Loading: skeleton screens matching card shapes
- AI result card: shows model name, prompt version, retrieved context entries

AVOID:
- Copying NovelCrafter exactly
- Flashy gradients
- Bright colorful kanban aesthetic
- Auto-inserting AI text without approval UI
- Generic chatbot interface
- Too many colors at once
```

---

## Rövid verzió (gyors vázlathoz)

```
Design a calm professional novel writing workspace.
Three-pane: left nav (project tree) + center editor + right Codex/AI inspector.
Colors: warm off-white background #f8f6f2, purple accent #6d5dfc, dark warm text #2f2a24.
Show the Write view: Tiptap manuscript editor (serif, centered 820px), AI bubble menu on selection, right panel with AI result (before/after diff) + Codex entries + scene beats.
Cards: white, rounded, subtle shadow, soft warm borders.
Feel: focused writing cockpit, not a chatbot or Notion clone.
```
