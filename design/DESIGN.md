# ForgeWriter AI — Design System

> **Canonical token source.** Every color, radius, shadow, spacing and z-index value is defined ONCE here (and in `globals.css`). The other design docs (`09_*`, `11_*`) must reference these names — never redefine a value or emit a raw hex.

## Philosophy

**Writer's cockpit, not a chatbot.** The app is a structured workspace for long-form fiction writing. The editor is the hero; AI is a trusted assistant that never acts without approval.

Core principles:

- Calm, focused, distraction-free writing environment
- Dense but readable — not minimal to the point of emptiness, never cluttered
- Every AI action surfaces its model, version and source — full transparency
- Human-in-the-loop always: AI suggests, writer decides
- Magyar-first UX — all labels, tooltips and microcopy in Hungarian

Design keywords: `calm` · `structured` · `warm` · `literary` · `editorial` · `professional` · `focused`

---

## Theming architecture (read first)

Colors are authored as **semantic CSS variables** in `globals.css` — this is the shadcn/ui idiom and the only way "light first, dark later" ships as a one-file swap rather than a rewrite. Tailwind references the variables; components reference Tailwind classes or `var(--token)`. **No component ever contains a raw hex.**

```css
/* app/globals.css — SOURCE OF TRUTH */
:root {
  /* surfaces */
  --background:        #f8f6f2;  /* warm off-white — page bg */
  --background-subtle: #f3f0ea;  /* sidebars, input area bg, tinted group surfaces */
  --surface:           #ffffff;  /* card, panel, modal */
  --surface-soft:      #fbfaf7;  /* editor page bg */
  --surface-muted:     #f1eee8;  /* hover state, secondary panel */
  --border:            #ded8ce;  /* borders, dividers */
  --border-strong:     #c9c0b4;  /* hovered input, active card border */

  /* text — see Contrast table for the usage rules */
  --text:              #2f2a24;  /* primary text — warm near-black */
  --text-soft:         #4c453d;  /* body paragraphs */
  --text-muted:        #6f675f;  /* labels, metadata (>=12px informational) */
  --text-muted-strong: #635c54;  /* small <12px informational text needing margin */
  --text-faint:        #9b9187;  /* DECORATIVE / disabled tint ONLY — never informational text */

  /* accent — user actions (distinct from ai) */
  --accent:            #6d5dfc;  /* fills, active indicators, borders, icons — NOT text */
  --accent-strong:     #5b4de0;  /* primary-button fill (white label clears AA) */
  --accent-hover:      #5b4de0;  /* hover on accent fills */
  --accent-muted:      #ebe9ff;  /* selected bg, chip bg, hover tint */
  --accent-text:       #342a91;  /* REQUIRED for any accent-colored text/link (AA-safe ~8.5:1) */
  --accent-foreground: #ffffff;  /* text/icon on an accent fill */

  /* ai — AI-generated content signal (distinct from accent) */
  --ai:                #7c3aed;  /* AI indicator: icons, borders, AI labels */
  --ai-muted:          #f0e9ff;  /* AI result card bg */
  --ai-foreground:     #ffffff;  /* text/icon on an ai fill */

  /* status — base = icon/border/fill; *-text = text on the *-muted bg */
  --success:        #2f7d55;  --success-muted: #e6f3ec;  --success-text: #256544;
  --warning:        #b7791f;  --warning-muted: #fff4da;  --warning-text: #8a5a13;
  --danger:         #c2410c;  --danger-muted:  #fff0e8;  --danger-text:  #9a3412;

  --ring: #6d5dfc;  /* focus-visible ring */

  /* POV swatches — fixed 6-entry rotation, assigned by character index/hash.
     Deliberately EXCLUDES accent/ai violet so violet stays the AI signal. */
  --pov-1-bg:#fdf0d5; --pov-1-text:#8a5a13;  /* amber  */
  --pov-2-bg:#fbe4e9; --pov-2-text:#9d2f4d;  /* rose   */
  --pov-3-bg:#e3f0e8; --pov-3-text:#256544;  /* emerald*/
  --pov-4-bg:#e1edf6; --pov-4-text:#235d86;  /* sky    */
  --pov-5-bg:#eceaf0; --pov-5-text:#4c4a59;  /* slate  */
  --pov-6-bg:#fdeadf; --pov-6-text:#9a3412;  /* orange */

  /* fonts */
  --font-ui:         'Inter', 'Geist', ui-sans-serif, system-ui, sans-serif;
  --font-manuscript: 'Literata', 'Lora', Georgia, serif;
  --font-mono:       'JetBrains Mono', 'Fira Code', ui-monospace, monospace;

  /* elevation */
  --shadow-card:    0 1px 2px rgba(47,42,36,.06);
  --shadow-hover:   0 2px 8px rgba(47,42,36,.10);
  --shadow-panel:   0 2px 8px rgba(47,42,36,.08);
  --shadow-popover: 0 8px 24px rgba(47,42,36,.12);
  --shadow-modal:   0 20px 48px rgba(47,42,36,.16);

  /* layout chrome dimensions (tokenized — no magic numbers in components) */
  --topbar-h: 52px;  --statusbar-h: 32px;
  --sidebar-w: 260px;  --inspector-w: 360px;  --editor-max: 820px;  --chapter-col-w: 280px;
}
```

```ts
// tailwind.config.ts — extend.colors (references the vars, never literal hex)
colors: {
  background: { DEFAULT: "var(--background)", subtle: "var(--background-subtle)" },
  surface:    { DEFAULT: "var(--surface)", soft: "var(--surface-soft)", muted: "var(--surface-muted)" },
  border:     { DEFAULT: "var(--border)", strong: "var(--border-strong)" },
  text:       { DEFAULT: "var(--text)", soft: "var(--text-soft)", muted: "var(--text-muted)", "muted-strong": "var(--text-muted-strong)", faint: "var(--text-faint)" },
  accent:     { DEFAULT: "var(--accent)", strong: "var(--accent-strong)", hover: "var(--accent-hover)", muted: "var(--accent-muted)", text: "var(--accent-text)", foreground: "var(--accent-foreground)" },
  ai:         { DEFAULT: "var(--ai)", muted: "var(--ai-muted)", foreground: "var(--ai-foreground)" },
  success:    { DEFAULT: "var(--success)", muted: "var(--success-muted)", text: "var(--success-text)" },
  warning:    { DEFAULT: "var(--warning)", muted: "var(--warning-muted)", text: "var(--warning-text)" },
  danger:     { DEFAULT: "var(--danger)", muted: "var(--danger-muted)", text: "var(--danger-text)" },
  ring:       "var(--ring)",
}
```

### Contrast (WCAG AA — verified on the warm palette)

AA target: **4.5:1** for normal text, **3:1** for large (≥18px/≥14px bold) and UI/icons.

| Pair | Ratio | Verdict | Rule |
|---|---|---|---|
| `text` #2f2a24 / `background` #f8f6f2 | 11.4:1 | PASS | any size |
| `text-soft` #4c453d / `surface` #fff | 8.9:1 | PASS | body |
| `text-muted` #6f675f / `background` | ~4.6:1 | PASS | informational text ≥12px |
| `text-muted-strong` #635c54 / `background` | ~5.2:1 | PASS | small informational text <12px |
| `text-faint` #9b9187 / `background` | ~2.6:1 | FAIL | **decorative / disabled tint ONLY — never informational text** (timestamps, captions, word counts, metadata use `text-muted`) |
| `accent` #6d5dfc as text / #fff | 3.9:1 | FAIL | never render text/links in raw `accent` — use `accent-text` #342a91 (~8.5:1) |
| white / `accent` #6d5dfc fill | 4.54:1 | thin | primary-button fill uses `accent-strong` #5b4de0 (white = ~5.9:1) for margin |
| `ai` #7c3aed / `ai-muted` #f0e9ff | ~4.6:1 | PASS | AI labels ≥14px or bold |
| `warning` #b7791f / `warning-muted` | 3.3:1 | FAIL | badge text uses `warning-text` #8a5a13 (≥4.5:1) |
| `success` #2f7d55 / `success-muted` | 4.4:1 | borderline | badge text uses `success-text` #256544 |

**Rule:** base `success`/`warning`/`danger` tokens are for icons, borders and fills only; the `*-text` tokens are for text on a `*-muted` background. Any new text/bg pair added later must be measured and added to this table.

### POV Character Badge Colors

Assigned by `characterId` hash to the fixed 6-entry token rotation above (`--pov-1..6`) — never ad-hoc per-scene colors, and never the accent/ai violet (so violet stays AI-only).

```ts
// pov index = hashCode(characterId) % 6
const pov = (i: number) => `bg-[var(--pov-${i+1}-bg)] text-[var(--pov-${i+1}-text)]`
// e.g. Callum → pov-1 (amber), Mia → pov-2 (rose), …
```

Each `*-bg / *-text` pair is AA-cleared (5.1–7.6:1). Character "roles" are **user-defined tags** rendered with this same swatch set — the design system ships no genre-specific role colors.

---

## Typography

### Font Stack

```css
--font-ui:         "Inter", "Geist", ui-sans-serif, system-ui, sans-serif;
--font-manuscript: "Literata", "Lora", Georgia, serif;   /* editor only */
--font-mono:       "JetBrains Mono", "Fira Code", ui-monospace, monospace;
```

### Type roles (UI = Inter, line-height + weight specified)

| Role | Token | Size | Weight | Line-height |
|---|---|---|---|---|
| Display | `--text-2xl` | 28px | 700 | 1.2 |
| H1 / page title | `--text-xl` | 22px | 600 | 1.25 |
| H2 / panel title | `--text-lg` | 18px | 600 | 1.3 |
| Body / UI | `--text-base` | 14px | 400 | 1.5 |
| Label / nav-selected | `--text-sm` | 13px | 500 | 1.4 |
| Caption / metadata | `--text-xs` | 12px | 400 | 1.4 (color `text-muted`, never `text-faint`) |
| Micro / badge | `--text-2xs` | 11px | 600 | 1.3 |

```css
--text-2xs: 11px;  --text-xs: 12px;  --text-sm: 13px;  --text-base: 14px;
--text-lg: 18px;   --text-xl: 22px;  --text-2xl: 28px;
/* removed the imperceptible 15px step; 16px exists only as --text-brand for the TopBar wordmark */
--text-brand: 16px;

--leading-tight: 1.25;  /* headings xl/2xl */
--leading-snug:  1.4;   /* titles lg, labels */
--leading-normal:1.5;   /* body */
```

Weights: **400** body · **500** medium (labels, nav-selected, buttons) · **600** semibold (headings, sparing) · **700** only the Display / ms-h1 emphasis. No weight > 700 in UI.

### Manuscript (Literata, the only serif role)

```css
--text-manuscript:    17px;  --text-ms-line-height: 1.75;
--text-ms-h1:         24px;  /* chapter title — 600 */
--text-ms-h2:         20px;  /* scene title — 500 */
--text-ms-h3:         17px;  /* sub-heading — 500 italic */
--text-ms-beat:       16px;  /* scene beat inline — italic */
```

**Measure (line length):** prose runs ~95 chars at 820px — too long. Cap the prose column to a character measure, not just px:

```css
.manuscript-editor .ProseMirror { max-width: 65ch; margin-inline: auto; text-wrap: pretty; hyphens: auto; } /* lang="hu" */
.manuscript-editor h1, .manuscript-editor h2 { text-wrap: balance; }
```

Target **60–75 characters per line** for the core artifact (Hungarian fiction).

### Typographic utilities (mandated)

- Headings: `text-balance`. Body & manuscript paragraphs: `text-pretty`.
- Word counts, dates, numeric metadata: `tabular-nums` (prevents BottomBar/card jitter on every keystroke).
- Dense lists: Codex descriptions `line-clamp-2`, scene-card summaries `line-clamp-3`, long titles `truncate`.
- Do not alter `letter-spacing`. Hungarian prose: `lang="hu"` + `hyphens-auto`. App is LTR-only (no layout mirroring).

---

## Spacing System

```css
--space-0.5: 2px;  --space-1: 4px;  --space-2: 8px;  --space-3: 12px;  --space-4: 16px;
--space-5: 20px;   --space-6: 24px; --space-8: 32px; --space-10: 40px; --space-12: 48px; --space-16: 64px;
```

All padding/gap uses this scale — no ad-hoc px. (Editor padding = `--space-12 --space-16` = 48px 64px.)

---

## Border Radius (canonical)

```css
--radius-sm:  6px;   /* badges, tooltips, compact chips */
--radius-md:  8px;   /* compact buttons, small controls */
--radius-lg:  10px;  /* buttons, inputs, dropdowns, popovers */
--radius-xl:  12px;  /* ALL cards (scene, chapter, codex, ai-result) */
--radius-2xl: 16px;  /* modals, large panels */
--radius-3xl: 24px;  /* project cards (welcome screen) */
--radius-full: 9999px; /* pills, POV badges, avatars */
```

`rounded-lg` = 10px and `rounded-xl` = 12px **everywhere** (the other docs must not redefine these).

---

## Elevation / Shadows (canonical)

```css
--shadow-card:    0 1px 2px  rgba(47,42,36,.06);
--shadow-hover:   0 2px 8px  rgba(47,42,36,.10);
--shadow-panel:   0 2px 8px  rgba(47,42,36,.08);
--shadow-popover: 0 8px 24px rgba(47,42,36,.12);
--shadow-modal:   0 20px 48px rgba(47,42,36,.16);
```

Three surface levels — and **never nest a bordered/shadowed card inside another card**:

1. **Page** — `background`, no shadow
2. **Tinted group surface** — `background-subtle`, no shadow (e.g. a chapter column that *contains* scene cards)
3. **Card** — `surface` + `shadow-card` + 1px `border`
4. **Floating** (dropdown, popover, modal) — `surface` + `shadow-popover` / `shadow-modal`

Separate groups in this order before adding any border: **spacing → alignment → divider → tinted surface.**

### Base Card primitive

All cards compose from one primitive; only the left-accent / selected state differs.

```css
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);   /* 12px */
  box-shadow: var(--shadow-card);
  padding: var(--space-3);
}
/* SceneCard / ChapterCard / CodexCard / AIResultCard extend .card */
```

---

## Layout Structure

```
┌──────────────────────────────────────────────────────────────────────┐
│  TopBar — 52px                                                        │
├──────────────┬─────────────────────────────────────┬─────────────────┤
│  LeftSidebar │  MainWorkspace                       │  RightInspector │
│  260px       │  flex-1 (min 480px)                  │  360px          │
├──────────────┴─────────────────────────────────────┴─────────────────┤
│  BottomBar — 32px (Write mode only)                                   │
└──────────────────────────────────────────────────────────────────────┘
```

### Dimensions

| Zone | Token | Default | Min | Max |
|---|---|---|---|---|
| TopBar | `--topbar-h` | 52px | — | — |
| LeftSidebar | `--sidebar-w` | 260px | 200px | 340px |
| RightInspector | `--inspector-w` | 360px | 300px | 440px |
| BottomBar | `--statusbar-h` | 32px | — | — |
| Editor content | `--editor-max` | 820px | — | — |
| Chapter column | `--chapter-col-w` | 280px | — | — |

### Responsive & Layering

Full-height columns use **`h-dvh`** (never `h-screen` — avoids mobile viewport bugs).

| Breakpoint | Behavior |
|---|---|
| ≥1280px | all three panes visible |
| 1024–1279px | RightInspector becomes a Radix `Sheet` from the right (toggle in TopBar) |
| <1024px | LeftSidebar collapses to a 64px icon rail; RightInspector is a full-height Sheet; editor stays primary |
| min usable | 768px |

**z-index scale** (use only these named tokens — no arbitrary `z-[...]`):

```css
--z-base:0; --z-sticky:10;   /* TopBar / StatusBar */
--z-sidebar:20; --z-inspector:20;
--z-overlay:30;               /* sheet scrim */
--z-dropdown:40;              /* slash menu, bubble menu, dropdowns */
--z-modal:50; --z-toast:60; --z-tooltip:70;
```

---

## Component Size Tokens

| Component | Height | H-padding | Radius | Font |
|---|---|---|---|---|
| Primary button | 36px | px-4 | rounded-lg (10px) | 14px medium |
| Secondary button | 36px | px-4 | rounded-lg | 14px |
| Ghost button | 32px | px-3 | rounded-md | 13px |
| Icon button | 32px | px-2 | rounded-md | — (hit area ≥32px) |
| Compact button | 28px | px-3 | rounded-md | 12px |
| Input | 36px | px-3 | rounded-lg | 14px |
| Textarea | auto | p-3 | rounded-lg | 14px |
| Select trigger | 36px | px-3 | rounded-lg | 14px |
| Tab item | 36px | px-3 py-1.5 | rounded-md | 13px medium |
| Nav item | 32px | px-3 | rounded-md | 13px |
| Badge | 20px | px-2 py-0.5 | rounded-full | 11px medium |
| Scene card | auto | p-3 | rounded-xl (12px) | 13px |
| Chapter column | auto | p-3 | rounded-xl | 14px |
| Codex entry card | auto | p-3.5 | rounded-xl | 13px |
| Dropdown item | 32px | px-3 | rounded-md | 13px |
| Tooltip | 24px | px-2 py-1 | rounded-md | 11px |
| Modal | auto | p-6 | rounded-2xl (16px) | 14px |
| Context menu | auto | py-1 | rounded-xl | 13px |

### Button variants (semantic)

| variant | Style | Use |
|---|---|---|
| `primary` | `bg-accent-strong text-accent-foreground` | **max ONE per pane/section** |
| `secondary` | `bg-surface border border-border text-text` | supporting actions |
| `ghost` | transparent, hover `bg-surface-muted` | dense toolbars, icon buttons |
| `destructive` | `bg-danger text-white` (AlertDialog confirm only) / list-row: `text-danger` ghost | deletes |
| `ai` | `bg-ai text-ai-foreground` or `bg-ai-muted text-ai` | **AI-initiating actions only** — never `accent` |

Rule: one `primary` action per pane; everything else recedes to `ghost`/`secondary`.

---

## Interaction States

Every interactive component MUST define this set. Hover is gated behind a pointer media query (no sticky hover on touch); the focus ring is `focus-visible` only (so it never flashes on mouse click in the calm cockpit).

```
Focus ring (ALL interactive):
  outline-none + focus-visible:ring-2 focus-visible:ring-ring
  focus-visible:ring-offset-2 focus-visible:ring-offset-background
Hover gating: wrap every hover rule in @media (hover:hover) and (pointer:fine)

Primary button:  default bg-accent-strong text-white | hover bg-accent-hover
  | active scale-[.98] | focus-visible +ring
  | disabled opacity-50 cursor-not-allowed pointer-events-none
  | loading <Loader2 className="size-4 animate-spin"/> replaces leading icon, label unchanged, aria-busy

Input:  default border-border | hover border-border-strong
  | focus-visible border-accent ring-[3px] ring-accent/12
  | disabled bg-surface-muted text-text-faint
  | error border-danger bg-danger-muted + helper <p role="alert" class="text-xs text-danger-text"> + aria-invalid + aria-describedby

Nav item / tree row:  default text-text-soft | hover bg-surface-muted
  | selected (PERSISTENT, distinct from hover) bg-accent-muted text-accent-text border-l-2 border-accent font-medium
  | focus-visible +ring

Scene / Codex card:  default shadow-card | hover -translate-y-0.5 shadow-hover
  | selected ring-2 ring-accent bg-accent-muted | focus-visible +ring
```

Never remove an outline without a ≥3:1 replacement. `selected` is persistent and visually distinct from transient `hover`/`focus`.

---

## States: Empty / Loading / Error

ForgeWriter is full of async AI work and empty collections — these states are first-class, not afterthoughts. Loaders never cover existing content; AI failures never insert partial text.

```
Empty (no scenes):  Layers 48px text-faint · "Még nincs jelenet" · secondary btn "Jelenet hozzáadása"
                    centered, max-w-xs, text-pretty
Empty (no Codex):   Database 48px · "A Kódex üres" · btn "Új bejegyzés"
Loading list:       3–5 skeleton rows (bg-surface-muted animate-pulse rounded-md h-4), matching card shape — not spinners
AI generating:      aiPending badge + Loader2 spin + "Generálás folyamatban…" inline in RightInspector, aria-busy=true
AI failed:          inline card — bg-danger-muted text-danger-text border border-danger/30 + AlertCircle
                    "A generálás sikertelen" + btn "Újrapróbálás" · role="alert" · NEVER inserts partial text
```

Wrap the editor, the AI panel, and each data pane in an `ErrorBoundary` with a "Valami hiba történt — Újratöltés" fallback.

---

## Accessibility & Primitives

- Every **icon-only button** has an `aria-label` (Hungarian, = its tooltip). Examples: `GripVertical`="Áthelyezés", `MoreHorizontal`="További műveletek", `Copy`="Másolás", `Star`="Mentés Snippetként", `X`="Bezárás", `PanelLeftClose`="Oldalsáv összecsukása". Decorative icons get `aria-hidden`.
- All menus, dialogs, tooltips, popovers, tabs, selects use **Radix/shadcn primitives** — never hand-roll focus or keyboard handling.
- Every `Dialog`: `DialogTitle` + `DialogDescription` (VisuallyHidden if not shown).
- **Destructive actions use `AlertDialog`, not a bare toast or Dialog.** Undo-toast (no dialog, 8s window) is for *reversible single* deletes (one scene card, one Codex entry, one snippet). `AlertDialog` with a `bg-danger` confirm naming the target is REQUIRED for cascading/irreversible actions: deleting a Chapter/Act (cascades scenes/beats/revisions), purging revision history, deleting a Book/Project, or discarding the only revision.
- Error text: `role="alert"` + field `aria-invalid` + `aria-describedby`.
- Focus order: TopBar → LeftSidebar → MainWorkspace → RightInspector. Trap focus in overlays; restore to the trigger on close.
- Minimum interactive target 32px; icon-only buttons get `p-2` hit area.
- Lucide stroke-width standardized at **1.75** for visual uniformity.

---

## Lucide Icon Reference

All icons from `lucide-react`. Size defaults: `16px` (nav), `18px` (action), `20px` (feature), `24px` (heading), `48px` (empty state). Stroke-width `1.75`.

### Navigation & Structure

| Context | Icon name |
|---------|-----------|
| Project | `BookOpen` |
| Book | `Book`, `BookMarked` |
| Chapter | `AlignLeft`, `FileText` |
| Scene | `Layers`, `Film` |
| Beat | `Activity`, `Zap` |
| Plan board | `LayoutGrid` |
| Overview | `LayoutDashboard` |
| Write | `PenLine` |
| Codex / DB | `Database` |
| Timeline | `CalendarDays` |
| Relationships | `Network` |
| AI Jobs | `Bot` |
| Export | `Download`, `FileOutput` |
| Settings | `Settings`, `Settings2` |
| Search | `Search` |
| Filter | `SlidersHorizontal` |
| Drag handle | `GripVertical` |
| Collapse/expand | `ChevronDown`, `ChevronRight` |

### Codex Entry Types

| Type | Icon |
|------|------|
| Character | `UserRound` |
| Location | `MapPin` |
| Object/Item | `Box` |
| Lore | `BookOpen` |
| Subplot | `GitBranch` |
| Other | `File` |
| Global Entry | `Globe` |
| Style Guide | `PenLine` |
| Story Genre | `Layers` |

### AI Actions

| Action | Icon |
|--------|------|
| General AI / Generate | `Sparkles` |
| Rewrite | `RefreshCw` |
| Describe (sensory) | `Eye` |
| Expand | `ChevronsUpDown` |
| Compress | `Minimize2` |
| Continue writing | `ArrowDown` |
| Scene beat | `Activity` |
| Brainstorm | `Brain` |
| Chat with scene | `MessageCircle` |
| Detect characters | `Users` |
| Summarize | `AlignLeft` |
| Visualize | `Image` |
| Thesaurus | `Quote` |

### Sensory Channels (Describe)

| Channel | Icon |
|---------|------|
| Látás (Sight) | `Eye` |
| Hang (Sound) | `Ear` |
| Tapintás (Touch) | `Hand` |
| Szag (Smell) | `Wind` |
| Íz (Taste) | `Droplets` |
| Metafora (Metaphor) | `Quote` |

### Status & Feedback

| Status | Icon |
|--------|------|
| Success / Approve | `CheckCircle2` |
| Warning | `AlertTriangle` |
| Error / Danger | `AlertCircle` |
| Info | `Info` |
| Restore / Undo | `RotateCcw` |
| History | `History` |
| Archive | `Archive` |
| Delete | `Trash2` |
| Copy | `Copy` |
| Insert | `CornerDownLeft` |
| Bookmark / Star | `Star`, `StarOff` |
| AI result pending | `Loader2` (spin) |
| Local model | `Cpu` |
| Cloud model | `Cloud` |

---

## Motion Tokens (Framer Motion)

### Core rules

- **Honor `prefers-reduced-motion`.** Global CSS: `@media (prefers-reduced-motion: reduce){ *,*::before,*::after{ animation-duration:.01ms!important; transition-duration:.01ms!important } }`. In Framer, gate every transition: `const reduce = useReducedMotion(); transition={ reduce ? { duration: 0 } : {...} }`.
- **Animate ONLY `transform` + `opacity`.** Never animate `height`/`width`/`top`/`left`/`scaleY`/`max-height` (layout thrash). Height reveals use the grid trick (`grid-template-rows: 0fr → 1fr`) + opacity, or animate the inner content `{opacity, y}`.
- **Ease-out only on entrances**; never ease-in for UI entrances. Standard curve: `cubic-bezier(0.22, 1, 0.36, 1)`. Exits may use ease-in.
- Every `AnimatePresence` element defines a matching **exit** (modal, toast, AI card, beat card, channel expand).
- **Never animate** high-frequency/keyboard actions: command palette open/close, sidebar/inspector pane toggle, tab-content switch, editor interactions, autosave indicator — these are instant. Slash/bubble menus open with a ≤0.12s opacity fade only; never animate the Tiptap content area.
- No bounce springs on UI; max 0.4s for any panel open. `Loader2` spin = `animate-spin` (CSS, not Framer).
- **Signature moment:** AI result cards entering the RightInspector — the single orchestrated reveal (`aiResultIn` y:12→0 0.22s + `cardList` stagger 0.06). All other motion is incidental.

### Transition Presets

```ts
export const transitions = {
  panelIn:  { x: 20, opacity: 0 },
  panelOut: { x: 20, opacity: 0 },                 // exit (ease-in ok)
  panelTransition: { duration: 0.18, ease: [0.22,1,0.36,1] },

  cardHover: { y: -2, transition: { duration: 0.12 } },

  aiResultIn: { y: 12, opacity: 0 },               // the signature moment
  aiResultTransition: { duration: 0.22, ease: [0.22,1,0.36,1] },

  menuIn: { y: 6, opacity: 0 },
  menuTransition: { duration: 0.12, ease: "easeOut" },

  beatCardIn:  { y: 10, opacity: 0 },
  beatCardOut: { opacity: 0, y: -6, transition: { duration: 0.18 } },   // NOT height:0
  beatCardTransition: { duration: 0.22, ease: [0.22,1,0.36,1] },

  channelExpand: { initial: { opacity: 0, y: -4 }, animate: { opacity: 1, y: 0 }, transition: { duration: 0.18 } }, // NOT max-height:auto

  dropdownIn: { opacity: 0, y: 6 },                 // NOT scaleY
  dropdownTransition: { duration: 0.15, ease: "easeOut" },

  modalIn:  { scale: 0.97, opacity: 0 },
  modalOut: { scale: 0.97, opacity: 0, transition: { duration: 0.12, ease: [0.22,1,0.36,1] } },
  modalTransition: { duration: 0.18, ease: [0.22,1,0.36,1] },

  toastIn:  { x: "100%", opacity: 0 },
  toastOut: { x: "100%", opacity: 0, transition: { duration: 0.18 } },
  toastTransition: { duration: 0.22, ease: [0.22,1,0.36,1] },
  toastAutoDismiss: 3000,

  pageFade: { opacity: 0 },                         // top-level route changes ONLY (not pane toggles)
  pageTransition: { duration: 0.15 },

  buttonTap: { scale: 0.96, transition: { duration: 0.08 } },
}
```

### Indeterminate progress bar (AI generating)

Never animate `width` or use a gradient fill. Indeterminate bar via transform:

```css
.progress-track { background: var(--accent-muted); height: 4px; border-radius: 9999px; overflow: hidden; }
.progress-bar   { background: var(--accent); width: 33%; animation: indeterminate 1.1s ease-in-out infinite; }
@keyframes indeterminate { 0%{ transform: translateX(-120%) } 100%{ transform: translateX(320%) } }
```

### Stagger Patterns

```ts
export const staggerVariants = {
  cardList: {
    container: { transition: { staggerChildren: 0.06 } },
    item: { y: 8, opacity: 0 },
    itemVisible: { y: 0, opacity: 1, transition: { duration: 0.18 } },
  },
  describeChannels: {
    container: { transition: { staggerChildren: 0.04 } },
    item: { opacity: 0 }, itemVisible: { opacity: 1, transition: { duration: 0.12 } },
  },
  // word cloud: cap to 24 words; total stagger ≤ 0.3s; under reduced-motion render all at once
  wordCloud: {
    container: { transition: { staggerChildren: 0.03 } },
    item: { opacity: 0 }, itemVisible: { opacity: 1, transition: { duration: 0.15 } },
  },
}
```

### Spring Configs

```ts
export const springs = {
  dragSnap:     { type: "spring", stiffness: 500, damping: 40 },  // dnd-kit snap-back
  tabIndicator: { type: "spring", stiffness: 300, damping: 30 },
}
```

---

## Status Badge Variants

Token-based only (no raw Tailwind palette). Every badge ALSO carries a Lucide icon or label — never color alone.

```ts
const badges = {
  // Scene status
  draft:      "bg-surface-muted text-text-muted border border-border",
  inProgress: "bg-warning-muted text-warning-text border border-warning/30",
  complete:   "bg-success-muted text-success-text border border-success/30",
  archived:   "bg-surface-muted text-text-faint border border-border",

  // AI result status
  aiPending:  "bg-ai-muted text-ai border border-ai/25",
  aiApproved: "bg-success-muted text-success-text",
  aiRejected: "bg-surface-muted text-text-muted",

  // Model type (label sourced from ModelRouter — never hardcoded)
  localModel: "bg-surface-muted text-text-muted",   // Cpu
  cloudModel: "bg-ai-muted text-ai",                 // Cloud
}
```

Character/Codex role tags are **user-defined** and render with the tokenized POV swatch set (`--pov-1..6`). The system ships no genre-specific role colors (no suspect/victim/protagonist presets) and no "Moderated" hue — a moderated model uses `bg-warning-muted text-warning-text` + an `AlertTriangle` icon.

---

## Dark Theme (ships later as a `.dark` class swap)

Wired via `next-themes` (`<html suppressHydrationWarning>` + `<ThemeProvider attribute="class" defaultTheme="light">`). Every `:root` token has a `.dark` counterpart — **never add a token to one block without the other**, and keep the two violets perceptually distinct so the human-vs-AI signal survives.

```css
.dark {
  --background:#191714; --background-subtle:#15130f;
  --surface:#23201c; --surface-soft:#1f1c18; --surface-muted:#2c2823;
  --border:#403a33; --border-strong:#544c43;
  --text:#eee7dc; --text-soft:#d3cabd; --text-muted:#b9afa4; --text-muted-strong:#c4baae; --text-faint:#8a8076;
  --accent:#9187ff; --accent-strong:#9187ff; --accent-hover:#a39bff; --accent-muted:#282343; --accent-text:#b9b2ff; --accent-foreground:#0f0d1a;
  --ai:#a78bfa; --ai-muted:#2a2140; --ai-foreground:#0f0d1a;
  --success:#5fb286; --success-muted:#16291f; --success-text:#7ec79e;
  --warning:#d9a441; --warning-muted:#2a2110; --warning-text:#e6b860;
  --danger:#e07a4f; --danger-muted:#2a160d; --danger-text:#f0a07f;
  --ring:#9187ff;
}
```

---

## Performance

- **Virtualize** (`@tanstack/react-virtual`): the Codex entry list, Mentions list, and scene/chapter board columns when >50 items.
- **Debounce** Codex/Plan/global search 250ms before query (TanStack Query).
- **Code-split** via `next/dynamic({ ssr:false })` with the matching skeleton fallback: the Tiptap editor, the V1 React Flow timeline, the revision diff view.
- List items keyed by stable entity id, **never index**.
- Model names are illustrative placeholders; render `<ModelBadge model={activeModel.label} provider={activeModel.provider} />` sourced from ModelRouter config — never hardcode a model string in a component.

---

## What NOT to Do

- **No dark navy** (`#0f172a`) background — that's NovelCrafter's territory
- **No off-token near-black** (`#1a1a1a`) for active pills/buttons — use `accent-strong` (or a named `--neutral-strong` token if a near-black selected state is genuinely wanted)
- **No raw Tailwind palette hues** (`bg-amber-100`, `bg-rose-100`, `text-red-700`, …) — every color is a token
- **No gradients anywhere EXCEPT one micro use:** the AI-active status highlight (a 2px top border or 1px ring on a *generating* card), `bg-gradient` `--ai → --accent` at low opacity, ≤24px tall. Never on buttons, panels, backgrounds, or hero areas.
- **No glassmorphism** (backdrop-filter blur)
- **No emoji** in UI labels unless in user content
- **No comic-sans, display, or decorative fonts** in UI
- **No oversized hero images** inside the app
- **No auto-playing/looping animations** while the editor is active
- **No animating `height`/`width`** (layout thrash) — transform/opacity only
- **No `:focus` ring** — `focus-visible` only
- **No `h-screen`** for full-height panes — `h-dvh`
- **No raw text in `text-faint`** — informational text uses `text-muted`
- **No accent-colored text in raw `accent`** — use `accent-text`
- **No auto-inserting AI text** without an Accept/Reject UI
- **No hiding model/cloud usage** — always show which model ran
- **No copying NovelCrafter exact branding, icons, or layout**
- **No color-only status meaning** — always pair color with icon or label
