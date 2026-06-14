# ForgeWriter AI — Frontend Design Prompt

> **Hogyan használd:** Másold be ezt a teljes promptot egy új Claude sessionbe (vagy Claude Designba).
> Ez egy önálló, teljes kontextust tartalmazó tervezési brief.

---

## PROMPT START — copy everything below this line

---

You are designing the complete frontend UI for **ForgeWriter AI**, a local-first AI novel-writing workspace for long-form Hungarian fiction. Think of it as a calm, structured writer's studio — somewhere between Notion's information density and iA Writer's focus, with AI embedded throughout.

This is a **greenfield Next.js 15 App Router project**. Your job is to design and implement the full frontend: every page, every component, every interaction. The backend API (FastAPI) is already spec'd out — I will provide the exact API contracts.

---

## Tech stack (non-negotiable)

- **Next.js 15** App Router, TypeScript strict mode
- **Tailwind CSS 4.x** — utility-first, no custom CSS unless absolutely necessary
- **shadcn/ui** — component primitives, built on Radix UI. Use `npx shadcn@latest add` for components. Docs: https://ui.shadcn.com/docs/components
- **Radix UI** primitives where shadcn doesn't cover: https://www.radix-ui.com/primitives
- **Framer Motion 11.x** — animations and layout transitions: https://www.framer.com/motion/
- **Tiptap 2.x** — rich text editor for the manuscript: https://tiptap.dev/docs/editor/getting-started/overview
- **dnd-kit** — drag and drop for scene/chapter board: https://docs.dndkit.com/
- **TanStack Query 5.x** — server state, data fetching: https://tanstack.com/query/latest/docs/framework/react/overview
- **Zustand 5.x** — client UI state: https://zustand.docs.pmnd.rs/getting-started/introduction
- **React Hook Form + Zod** — forms and validation: https://react-hook-form.com/ + https://zod.dev/
- **Lucide React** — icons: https://lucide.dev/icons/

---

## Design system

Apply these design tokens globally in `tailwind.config.ts` and as CSS custom properties:

```ts
const theme = {
  background: "#f8f6f2",      // warm off-white, app background
  surface: "#ffffff",          // white, cards and panels
  surfaceMuted: "#f1eee8",    // slightly warm gray for secondary surfaces
  border: "#ded8ce",           // soft warm border
  text: "#2f2a24",             // near-black, main text
  textMuted: "#6f675f",       // warm gray, secondary text
  accent: "#6d5dfc",           // muted purple — primary actions, links, active states
  accentMuted: "#ebe9ff",     // very light purple — hover, selected backgrounds
  ai: "#7c3aed",               // slightly deeper purple — AI-specific elements
  aiMuted: "#f0e9ff",         // AI panel backgrounds, AI card backgrounds
  success: "#2f7d55",
  warning: "#b7791f",
  danger: "#c2410c",
}
```

**Typography:**
- UI font: `Inter` (Google Fonts or `next/font/google`)
- Manuscript font: `Literata` (serif, for the writing editor only)

**Visual style:**
- Rounded corners: `rounded-lg` (8px) for cards, `rounded-md` for inputs
- Shadows: `shadow-sm` on cards, `shadow-md` for modals/dropdowns
- Borders: subtle (`border border-[#ded8ce]`), not harsh
- Spacing: generous padding inside panels (16–24px)
- Dense but readable — NOT minimalist to the point of feeling empty
- No flashy gradients — one exception: AI response areas can have a very subtle purple-to-white gradient top border

---

## App structure

```
app/
  (auth)/
    login/                    ← single-user JWT login page
  (app)/
    layout.tsx                ← global sidebar + header shell
    projects/
      page.tsx                ← project list / dashboard
      [projectId]/
        page.tsx              ← project home (book list)
        books/
          [bookId]/
            plan/
              page.tsx        ← chapter/scene outline board
            write/
              page.tsx        ← manuscript editor view
        codex/
          page.tsx            ← codex dashboard (characters + locations + worldbuilding)
        characters/
          [characterId]/
            page.tsx          ← character profile editor
        locations/
          [locationId]/
            page.tsx          ← location profile editor
        worldbuilding/
          [entryId]/
            page.tsx          ← worldbuilding entry editor
        timeline/
          page.tsx            ← timeline view (V1, can be placeholder for now)
        export/
          page.tsx            ← export panel
    settings/
      models/
        page.tsx              ← AI model configuration
```

---

## Global layout

The app has a **three-panel layout** on all writing pages:

```
┌─────────────────────────────────────────────────────┐
│ [Logo] ForgeWriter         [Project name]    [User] │  ← top bar (40px)
├──────────┬──────────────────────────┬───────────────┤
│          │                          │               │
│  LEFT    │     MAIN CONTENT         │  RIGHT PANEL  │
│  NAV     │     (editor / board /    │  (AI panel /  │
│  240px   │      database)           │  Codex /      │
│          │                          │  Notes)       │
│          │                          │  340px        │
└──────────┴──────────────────────────┴───────────────┘
```

**Left nav (240px, fixed):**
- Project logo/title at top
- Navigation sections:
  - Write (→ `/write`)
  - Plan (→ `/plan`)
  - Codex (→ `/codex`)
  - Characters sub-list (expandable)
  - Locations sub-list (expandable)
  - Timeline (→ `/timeline`)
  - Export (→ `/export`)
- Settings gear at bottom
- Collapse to icon-only on smaller screens

**Right panel (340px, collapsible):**
- Tabs: `AI Assistant` | `Codex` | `Notes`
- Collapses to 0px when not needed (toggle button on edge)
- Persists its open/closed state per page in Zustand

**Main content:** remaining space, scrollable

---

## Page designs

### 1. Login page (`/login`)

Clean, centered card on the warm background.

```
┌────────────────────────────┐
│  🪶 ForgeWriter AI          │
│                            │
│  [Username input]          │
│  [Password input]          │
│  [Bejelentkezés button]    │
│                            │
│  local-first AI írói       │
│  munkakörnyezet            │
└────────────────────────────┘
```

- POST to `/api/v1/auth/token` (form-urlencoded, OAuth2 format)
- Store JWT in localStorage as `forgewriter_token`
- On success: redirect to `/projects`
- Error state: show inline error message below form

---

### 2. Projects page (`/projects`)

Grid of project cards.

```
┌─────────────────────────────────────────────────┐
│  Projektjeim                    [+ Új projekt]  │
├─────────────────────────────────────────────────┤
│                                                  │
│  ┌──────────────┐  ┌──────────────┐             │
│  │ Üvegváros    │  │ Homoki csillag│            │
│  │ Fantasy      │  │ Sci-fi       │             │
│  │ 45 231 szó   │  │ 12 000 szó   │             │
│  │ drafting     │  │ planning     │             │
│  └──────────────┘  └──────────────┘             │
└─────────────────────────────────────────────────┘
```

- Each card: title, genre tag, word count, status badge, last modified
- Status badge colors: planning=gray, drafting=accent, revision=warning, completed=success
- Click card → navigate to `/projects/[projectId]`
- "Új projekt" button → modal with form (title, language, genre)
- Hover card shows edit/delete icon buttons

---

### 3. Project home (`/projects/[projectId]`)

Shows the book(s) in the project and quick-access stats.

- If only 1 book (MVP default): redirect directly to `/projects/[id]/books/[bookId]/write`
- If multiple books: list them as cards with cover placeholder, title, word count progress bar

---

### 4. Plan view (`/books/[bookId]/plan`)

**Board-style chapter/scene planner.** This is the NovelCrafter-style outline board.

```
┌────────────────────────────────────────────────────────┐
│ 1. fejezet: A kapu         2. fejezet: Az árnyék       │
│                                                         │
│ ┌─────────────────┐        ┌─────────────────┐        │
│ │ 1.1 Bevezető    │        │ 2.1 Üldözés     │        │
│ │ idea    320 szó │        │ drafting        │        │
│ │ [AI ✦]          │        │ [AI ✦]          │        │
│ └─────────────────┘        └─────────────────┘        │
│ ┌─────────────────┐        ┌─────────────────┐        │
│ │ 1.2 Találkozás  │        │ 2.2 Rejtekhely  │        │
│ │ drafted 1800 szó│        │ idea            │        │
│ └─────────────────┘        └─────────────────┘        │
│ [+ Jelenet]                [+ Jelenet]                 │
│                                                        │
│ [+ Fejezet]                                            │
└────────────────────────────────────────────────────────┘
```

- **Columns** = Chapters (horizontal scroll if many)
- **Cards** = Scenes within each chapter
- **Drag and drop** with dnd-kit: scenes draggable within a chapter and between chapters
- Each scene card shows: title, status badge, word count, POV character
- Click scene card → opens scene detail panel (right panel transforms to show scene metadata)
- Double-click scene card → navigate to write view, that scene focused
- "AI ✦" button on scene card → triggers AI generation if scene has beats
- Chapter column header: click to edit chapter title/goal/summary inline
- Status colors: idea=border-dashed, outlined=gray, drafting=accent-light, drafted=success-light, final=success

---

### 5. Write view (`/books/[bookId]/write`)

**The manuscript editor.** This is the most important screen.

```
┌───────────────────────────────────────────────────────────────┐
│ LEFT: Scene list  │  CENTER: Tiptap editor  │  RIGHT: AI panel│
│                   │                          │                  │
│ 1. fejezet        │  Scene title here        │ [AI] [Codex] [Notes]│
│ ▸ 1.1 Bevezető ● │                          │                  │
│   1.2 Találkozás  │  [Manuscript text here   │  [Describe] ←   │
│ 2. fejezet        │   in Literata font.      │  [Rewrite]       │
│   2.1 Üldözés    │   Comfortable line        │  [Continue]      │
│                   │   height, soft border     │  [Generate]      │
│                   │   on left as ruler]       │                  │
│                   │                          │  --- History --- │
│                   │  [Bubble menu appears    │  AI cards here   │
│                   │   on selection:          │                  │
│                   │   Leírás|Átírás|Bővítés] │                  │
└───────────────────────────────────────────────────────────────┘
```

**Left panel — scene list (240px):**
- Tree: Chapter → Scene hierarchy
- Active scene highlighted with accent border-left
- Click → loads that scene in editor
- Word count per scene, status dot
- Right-click → context menu: Rename, Archive, Delete

**Center — Tiptap editor:**
- Font: Literata, 18px, 1.8 line-height
- Max width: 720px centered
- Autosave: debounced 1.5s after last keystroke → PATCH `/api/v1/scenes/{id}`
- Save indicator: subtle "Mentve" or "Mentés..." in top-right corner of editor pane
- **Floating bubble menu** (appears on text selection, ~6 items max):
  - `Leírás` → triggers Describe feature
  - `Átírás` → triggers Rewrite feature
  - `Ctrl+K` shortcut → opens Quick Edit inline input
  - `Bővítés` → expand selected text
  - `📋 Másolás` → copy
- Word count bar at bottom of editor
- Scene metadata strip above editor: POV character, Location, Time marker (compact, editable on click)

**Right panel — AI assistant:**

Tab 1: **AI panel**
- Top action buttons row: `▶ Folytatás` | `✦ Generálás` | `⚙ Beállítások`
- **Describe cards** (when active):
  - 6 cards, each with sense icon + label + generated text
  - Each card: insert button (dropdown: cursor / after selection / before selection) + star (save as Snippet)
  - Cards animate in with Framer Motion `staggerChildren` as they arrive
- **Rewrite card:**
  - Shows original (strikethrough) vs new text side by side
  - Accept / Reject / Refine buttons
- **AI history:**
  - Scrollable list of past AI interactions in this session
  - Each item: type badge + timestamp + collapse/expand

Tab 2: **Codex panel**
- Search box (searches all Codex entries for current project)
- Results as compact rows: icon (character/location/worldbuilding) + name + short description
- Click → expands to show full profile inline
- `ai_visible` toggle visible for each entry

Tab 3: **Notes / Snippets**
- List of project Snippets
- Filterable by tag (describe_result, idea, todo, etc.)
- Quick-add new note button

---

### 6. Codex dashboard (`/projects/[projectId]/codex`)

Three-column layout (or tabs on smaller viewports):

```
Characters | Locations | Worldbuilding
```

Each column:
- Search bar
- Sortable list of entries (name, role/type, last modified)
- "+ Új" button to create
- Click entry → navigate to detail page

---

### 7. Character profile (`/characters/[characterId]`)

Full-page form for character editing.

Sections (accordion or tabs):
- **Alapok:** name, aliases (tag input), role, short description
- **Mélység:** motivation, goal, fear, internal conflict, external conflict
- **Hang:** voice notes, speech patterns (these feed the AI)
- **Megjelenés:** appearance text
- **Ív:** arc summary, backstory
- **AI beállítások:** `ai_visible` toggle with explanation, tags

Each section autosaves on blur. The `ai_visible` toggle should be visually prominent with a label: "Az AI látja ezt az entitást" / "Rejtett az AI elől".

---

### 8. Settings — Model config (`/settings/models`)

Clean settings page:

```
AI Modell beállítások

Local (Ollama)
  Model: [ollama/llama3.2 ▾]  
  Base URL: [http://localhost:11434]
  [Kapcsolat tesztelése] → ✓ Elérhető / ✗ Nem elérhető

Cloud (opcionális)
  Provider: [Google AI Studio ▾]
  API key: [••••••••••••••]
  Model: [gemini-2.0-flash ▾]
```

POST to `/api/v1/settings/models` (V1 endpoint — for now can be local Zustand/localStorage).

---

## Component library to build

Here are the key shared components with their exact responsibilities:

### `SceneCard`
`components/plan/SceneCard.tsx`

```tsx
interface SceneCardProps {
  scene: SceneResponse;
  onEdit: (id: string) => void;
  onGenerate: (id: string) => void;
  isDragging?: boolean;
}
```

Shows: title, status badge, word count, POV avatar (initials), AI button if beats exist.
Drag handle via dnd-kit sortable.

### `AIPanel`
`components/ai/AIPanel.tsx`

```tsx
interface AIPanelProps {
  sceneId: string;
  projectId: string;
  selectedText: string | null;       // from Tiptap
  onInsert: (text: string) => void;  // inserts into editor
  onStar: (text: string, sense: string) => void;  // saves as Snippet
}
```

Manages all AI interactions. Renders either DescribeCards, RewriteCard, or GenerationCard based on active job type.

### `DescribeCard`
`components/ai/DescribeCard.tsx`

```tsx
interface DescribeCardProps {
  sense: "sight" | "sound" | "touch" | "smell" | "taste" | "metaphor";
  label: string;       // "Látás", "Hang", etc.
  text: string;
  onInsert: (text: string) => void;
  onStar: () => void;
  isLoading?: boolean;
}
```

The card design:
```
┌──────────────────────────────────────┐
│ 👁  Látás                            │
│                                      │
│  Generated text here, 2-4 sentences  │
│  in Hungarian literary prose...      │
│                                      │
│  [Beillesztés ▾]        [⭐]  [✕]   │
└──────────────────────────────────────┘
```
Background: `aiMuted` (`#f0e9ff`). Animate in with `framer-motion` `opacity: 0→1, y: 8→0`.

### `EditorBubbleMenu`
`components/editor/EditorBubbleMenu.tsx`

Tiptap `BubbleMenu` extension wrapper. Shows on text selection. Items:
- Leírás (Eye icon)
- Átírás (RefreshCw icon)  
- Bővítés (Maximize2 icon)
- Ctrl+K (Command icon)
- Másolás (Copy icon)

### `ManuscriptEditor`
`components/editor/ManuscriptEditor.tsx`

Tiptap setup with:
- `StarterKit` extension
- `BubbleMenu` (custom, as above)
- `CharacterCount` extension (for word count)
- `Placeholder` extension: "Kezdd el írni a jelenetet..."
- `Typography` extension (smart quotes, em dashes)
- Autosave: `useEffect` watching `editor.getJSON()`, debounced 1500ms

Font: Literata via `next/font/google`. Apply to editor wrapper div only — not the whole app.

---

## API integration

All API calls go through TanStack Query hooks in `hooks/` directory.

Base URL comes from `NEXT_PUBLIC_API_URL` env var (default `http://localhost:8000`).

Auth token stored in localStorage `forgewriter_token`. All requests add `Authorization: Bearer <token>` header via an axios instance or fetch wrapper.

Key hooks to implement:

```ts
// hooks/useProjects.ts
useProjects()                    // GET /api/v1/projects
useProject(id)                   // GET /api/v1/projects/:id
useCreateProject()               // POST /api/v1/projects
useUpdateProject()               // PATCH /api/v1/projects/:id
useDeleteProject()               // DELETE /api/v1/projects/:id

// hooks/useScenes.ts
useScenes(chapterId)             // GET /api/v1/chapters/:id/scenes
useScene(id)                     // GET /api/v1/scenes/:id
useUpdateScene()                 // PATCH /api/v1/scenes/:id (autosave)

// hooks/useAI.ts
useDescribe()                    // POST /api/v1/ai/describe
useRewrite()                     // POST /api/v1/ai/rewrite
useContinue()                    // POST /api/v1/ai/write-continue
useGenerateScene()               // POST /api/v1/ai/generate-scene
```

---

## State management (Zustand)

Two stores:

```ts
// store/editorStore.ts
interface EditorStore {
  activeSceneId: string | null
  selectedText: string | null
  setActiveScene: (id: string) => void
  setSelectedText: (text: string | null) => void
}

// store/uiStore.ts
interface UIStore {
  rightPanelOpen: boolean
  rightPanelTab: "ai" | "codex" | "notes"
  leftPanelOpen: boolean
  toggleRightPanel: () => void
  setRightPanelTab: (tab: "ai" | "codex" | "notes") => void
}
```

---

## File structure to create

```
apps/web/
  src/
    app/
      (auth)/
        login/page.tsx
      (app)/
        layout.tsx             ← 3-panel shell
        projects/
          page.tsx
          [projectId]/
            books/[bookId]/
              plan/page.tsx
              write/page.tsx
            codex/page.tsx
            characters/[id]/page.tsx
    components/
      layout/
        AppShell.tsx           ← 3-panel wrapper
        LeftNav.tsx
        RightPanel.tsx
        TopBar.tsx
      editor/
        ManuscriptEditor.tsx
        EditorBubbleMenu.tsx
        SceneMetadataBar.tsx
        AutosaveIndicator.tsx
      plan/
        BoardView.tsx
        ChapterColumn.tsx
        SceneCard.tsx
        AddSceneButton.tsx
      ai/
        AIPanel.tsx
        DescribeCard.tsx
        RewriteCard.tsx
        AIActionButtons.tsx
        AIHistory.tsx
      codex/
        CodexSearch.tsx
        CodexEntryRow.tsx
        CodexEntryInline.tsx
      ui/
        StatusBadge.tsx        ← scene/project status with color
        WordCountBar.tsx
    hooks/
      useProjects.ts
      useBooks.ts
      useChapters.ts
      useScenes.ts
      useBeats.ts
      useCharacters.ts
      useLocations.ts
      useAI.ts
      useSnippets.ts
    store/
      editorStore.ts
      uiStore.ts
    lib/
      api.ts                   ← fetch wrapper with auth header
      queryClient.ts           ← TanStack Query client setup
    styles/
      globals.css              ← Tailwind base + CSS vars for theme tokens
```

---

## Key interactions to get right

1. **Autosave** — must be debounced (1500ms), show save state in editor, never block the user
2. **AI card animation** — each Describe card should animate in with 80ms stagger (`framer-motion` `staggerChildren`)
3. **Drag and drop scenes** — smooth reorder within and between chapter columns (dnd-kit `SortableContext` + `DragOverlay`)
4. **Right panel collapse** — smooth width transition with `framer-motion` `AnimatePresence`
5. **Bubble menu** — appears only when selection is non-empty, aligned to selection, disappears on click-outside
6. **Toast notifications** — `sonner` (comes with shadcn) for save confirmations, error messages

---

## Implementation order (recommended)

1. Project scaffold (`create-next-app --typescript`, Tailwind, shadcn init, fonts)
2. Auth (login page, token storage, route guard in layout)
3. AppShell layout (3 panels, responsive collapse)
4. Projects CRUD page
5. Plan board (chapters + scenes, drag-and-drop)
6. Manuscript editor (Tiptap + autosave)
7. AI panel shell (tabs, action buttons, loading states)
8. Describe feature (cards, insert, star)
9. Rewrite feature
10. Codex pages (Character, Location, Worldbuilding)
11. Settings / model config

---

## API base contract (for reference)

```
Base URL: http://localhost:8000/api/v1

Auth:
  POST /auth/token         form-data: username, password → {access_token, token_type}

Projects:
  GET  /projects           → ProjectResponse[]
  POST /projects           → ProjectResponse
  GET  /projects/:id       → ProjectResponse
  PATCH /projects/:id      → ProjectResponse
  DELETE /projects/:id     → 204

Books:
  GET  /projects/:id/books        → BookResponse[]
  POST /projects/:id/books        → BookResponse
  GET  /books/:id                 → BookResponse
  PATCH /books/:id                → BookResponse

Chapters:
  GET  /books/:id/chapters               → ChapterResponse[]
  POST /books/:id/chapters               → ChapterResponse
  POST /books/:id/chapters/reorder       body: {chapter_ids: string[]}
  PATCH /chapters/:id                    → ChapterResponse

Scenes:
  GET  /chapters/:id/scenes              → SceneResponse[]
  POST /chapters/:id/scenes              → SceneResponse
  POST /chapters/:id/scenes/reorder      body: {scene_ids: string[]}
  GET  /scenes/:id                       → SceneResponse
  PATCH /scenes/:id                      → SceneResponse (text_json, text_markdown, word_count)

AI:
  POST /ai/describe        body: {project_id, scene_id, selected_text, preceding_context, senses[]}
                           → {job_id, results: [{sense, label, text}]}
  POST /ai/rewrite         body: {project_id, scene_id, selected_text, action, instructions}
                           → {job_id, status, result: {rewritten_text, explanation}}
  POST /ai/write-continue  body: {project_id, scene_id}
                           → {job_id, status, result: {continuation}}
  POST /ai/generate-scene  body: {project_id, scene_id, target_word_count, include_codex}
                           → {job_id, status, result: {draft_markdown}}
```

---

## What to deliver

For each page and component:
- Working TypeScript component with proper types
- Tailwind styling matching the design tokens above
- TanStack Query hooks for data fetching
- Framer Motion animations where specified
- Loading states (skeleton or shimmer for lists/cards)
- Error states (inline error messages, not just console.log)
- Empty states (when no projects / no scenes / no AI results yet)
- Responsive: works on 1280px+ desktop (no mobile needed for MVP)

Start with the AppShell layout and Projects page, then the Plan board, then the Write view with the editor.

---

## PROMPT END
