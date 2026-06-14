# 09 — NovelCrafter-Inspired Design System

## Purpose

This document defines the visual and UX design direction for the AI novel-writing platform.

The goal is to create a product that feels familiar to users of structured writing platforms such as NovelCrafter, while remaining an original product with its own identity.

## Design system alignment (normative — overrides any inline value below)

> A token-értékek **kanonikus forrása a `DESIGN.md`** (radius, shadow, szín, z-index, type-scale). Ez a dokumentum részletes komponens-spec; ahol egy érték eltér a `DESIGN.md`-től, a `DESIGN.md` az irányadó. Az alábbi szabályok felülírják a dokumentum bármely korábbi/lentebbi inline részletét.

- **Theming:** minden szín szemantikus CSS-változó a `globals.css` `:root`-jában (a teljes `:root` + `.dark` blokk a `DESIGN.md`-ben). A komponensek `var(--token)` / Tailwind osztályra hivatkoznak — soha nincs nyers hex, és a régi camelCase TS objektum nem a forrás. A dark theme egy `next-themes` `.dark` osztály-csere (minden token-névnek van `.dark` párja).
- **Kontraszt (WCAG AA):** `text-faint` (#9b9187) **csak dekoratív/disabled** — információs kisszöveg (időbélyeg, képaláírás, szószám, metaadat) `text-muted` (#6f675f). Accent szöveg/link soha nyers `accent`, hanem `accent-text` (#342a91). Elsődleges gomb `accent-strong` (#5b4de0) + fehér. Badge szöveg muted háttéren `success-text`/`warning-text`/`danger-text`.
- **Badge & POV szín:** token-alapú (nincs nyers Tailwind hue és nincs leíró „muted purple/indigo" név, ami az accent/ai violettel ütközik). A POV a fix `--pov-1..6` rotáció (characterId hash, accent/ai kizárva). Minden státusz badge ikont/címkét is hordoz.
- **Aktív pill/Send/portré-gomb:** `bg-accent-strong text-white` — **nincs nyers `#1a1a1a`/fekete**. „Moderált" badge: `bg-warning-muted text-warning-text` + `AlertTriangle`.
- **Interakciós állapotok:** minden interaktív elem definiálja: default / hover (`@media (hover:hover)` mögött) / **`focus-visible`** (`ring-2 ring-ring ring-offset-2`, soha nyers `:focus`) / active / **selected** (perzisztens) / **disabled** / **loading** (Loader2, aria-busy) / **error** (border-danger + role="alert" + aria-invalid).
- **Mozgás:** `prefers-reduced-motion` kötelező. Csak `transform`+`opacity` — soha `height`/`max-height`/`width`/`scaleY`. A progress bar indeterminate `translateX` (nincs width-animáció, nincs gradiens-fill). Height-reveal a grid-trükkel (`grid-template-rows:0fr→1fr`) vagy `{opacity,y}`. Nincs animáció gyakori/billentyűs akción.
- **Akadálymentesítés:** ikon-gombok `aria-label` (magyar); Radix/shadcn primitívek; destruktív kaszkád-művelet (fejezet/könyv törlés, revízió-ürítés, az egyetlen revízió elvetése) **`AlertDialog`** — toast-undo csak visszafordítható egyelemű törlésre (8s).
- **Reszponzív:** `h-dvh`; ≥1280px három panel, 1024–1279px RightInspector `Sheet`, <1024px LeftSidebar 64px ikon-sáv. Z-index csak a `DESIGN.md` named skálájából.
- **Egységes Card primitív** (`radius-xl` = 12px, `shadow-card`, `border`) — minden kártya ebből származik; soha nincs kártya-a-kártyában (a fejezet-oszlop `background-subtle` tinted felület, NEM kártya). Radius/shadow értékek a `DESIGN.md`-ből.
- **Teljesítmény:** Codex-lista, mentions, board-oszlopok virtualizálva (>50 elem); keresés 250ms debounce; Tiptap + React Flow `next/dynamic` + skeleton.
- **Modellnevek placeholderek:** `<ModelBadge model provider />` a `ModelRouter` configból — soha nincs hardcode-olt modellnév komponensben.
- **Kézirat measure:** próza `max-w-[65ch]` (60–75 kar/sor), `text-pretty` + `hyphens-auto` (`lang="hu"`); szószám `tabular-nums`.

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

> Kanonikus értékek a `DESIGN.md`-ben — ezekkel összehangolva (`rounded-lg` = 10px, `rounded-xl` = 12px mindenhol).

```css
--radius-sm: 6px;
--radius-md: 8px;
--radius-lg: 10px;
--radius-xl: 12px;   /* ALL cards */
--radius-2xl: 16px;
--radius-3xl: 24px;  /* project cards */
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
/* Egységes Card primitív — minden kártya (Scene/Chapter/Codex/AIResult) ebből származik.
   Soha nincs kártya-a-kártyában: a fejezet-oszlop background-subtle tinted felület, NEM kártya. */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl);   /* 12px — egységes minden kártyán */
  box-shadow: var(--shadow-card);
  padding: var(--space-3);           /* 12px */
}
```

### Card interaction

- hover border darkens slightly
- selected card uses accent border and accentMuted background
- drag handle visible on hover
- status badge on top right

## Status badges

### Scene status colors

Token-alapú, minden badge ikont is hordoz. A nem-AI státuszok **soha nem használják az accent/ai violetet** (az az aktív felhasználói akció ill. az AI jele) — helyette a `--pov-*` semleges/meleg swatchök:

```txt
idea (tervezett):   bg-surface-muted text-text-muted              + Circle       (semleges)
outlined (vázolt):  bg-[var(--pov-4-bg)] text-[var(--pov-4-text)] + PenLine      (sky)
drafting (piszkoz.):bg-accent-muted text-accent-text              + PenLine      (accent = aktív munka)
drafted (kész):     bg-[var(--pov-3-bg)] text-[var(--pov-3-text)] + Check        (emerald)
reviewing (átnézve):bg-warning-muted text-warning-text            + Eye          (amber)
final (végleges):   bg-success-muted text-success-text            + CheckCircle2 (zöld)
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

---

## TopBar — részletes spec

> ref: `16_nc_write_view_full_layout.png`

Magasság: 52px. Háttér: `surface` (#ffffff). Border: `border-b border-border`.

**Bal rész:**

- `BookOpen` ikon (16px, accent) + "ForgeWriter" szöveg (16px bold)
- `"/"` elválasztó (textFaint)
- Projekt neve (14px, textMuted) — kattintható, projekt-választó legördülőhöz → `ChevronDown` (12px, textFaint)

**Közép (Write nézetben):**

- Fejezet neve (13px textMuted) + `›` + jelenet neve (13px text)
- Kattintható — navigál a scene-hez a Plan Board-on

**Jobb rész:**

- `Cpu` ikon + model name badge (12px, `aiMuted` bg, `ai` text) — lokális modell státusz
- `Loader2` spin ikon (accent) — ha generálás fut
- `Search` ghost gomb (32px)
- `Settings` ghost gomb (32px)
- Divider
- User avatar kör (28px), initials placeholder

---

## LeftSidebar — Nav és Codex üzemmód

> ref: `22_sw_sidebar_story_bible_nav.png`

### Navigation Mode (projekt-fa)

Háttér: `backgroundSubtle` (#f3f0ea). `border-r border-border`.

Header (52px): projekt neve (14px bold) + `Settings2` ikon gomb.

Nav szekciók — ikonok és labelek:

```
LayoutDashboard   Áttekintés
BookOpen          Tervezés
PenLine           Írás
Database          Codex
CalendarDays      Idővonal
Network           Kapcsolatok
Bot               AI Feladatok
Download          Exportálás
```

Nav elem stílus:

- 32px magasság, `px-3`, `rounded-md`
- Inaktív: `text-textMuted`
- Hover: `bg-surfaceMuted text-text`
- Aktív: `bg-accentMuted text-accent`, `border-l-2 border-accent` bal szél

Könyv-fa (összecsukható szekció):

- Fejezet sor: `ChevronRight/Down` + `AlignLeft` (16px) + cím (13px) + jelenet-szám badge
- Aktív jelenet: bold + accent bal pont

### Codex Mode (jobb panel, könyv-specifikus)

> ref: `04_nc_codex_sidebar_empty.png`, `05_nc_codex_sidebar_with_cover.png`

**Fejléc:**

- `ChevronLeft` visszagomb + `Settings2` fogaskerék
- Könyvborító thumbnail: 40×56px, `rounded-md`, `shadow-sm`
- Cím: 14px bold, max 2 sor ellipsis
- Szerző: 12px textFaint
- `PanelLeftClose` + `Columns2` ikonok (jobb fent)

**Tab sáv:** `Codex | Snippets | Chats` — underline stílus, aktív: `border-b-2 border-accent text-text font-medium`

**Keresés sor (36px, rounded-lg):**

- `Search` ikon belül, placeholder: "Keresés..."
- `SlidersHorizontal` filter gomb (32px ghost)
- `+ Új bejegyzés` — accent gomb, 32px
- `Settings2` gear gomb (32px ghost)

**New Entry dropdown:**

```
UserRound    Karakter
MapPin       Helyszín
Box          Tárgy/Eszköz
BookOpen     Lore
GitBranch    Mellékszál
File         Egyéb
─── Gyors létrehozás ───────
Globe        Globális bejegyzés
PenLine      Stílus kalauz
Layers       Regény műfaj
```

**Codex entry lista — három megjelenítési mód:**

Default (teljes):
- 40px kör avatar (karakternél) / `MapPin` ikon kör (helyszínnél)
- Név: 13px medium
- Leírás: 11px textFaint, max 2 sor
- Badge: típus chip + szín dot
- `N megemlítés` (12px accentText, ha > 0)

Compact: ikon + név + 1 soros leírás

Slim: ikon + csak név

---

## Plan Board — részletes spec

> ref: `10_nc_plan_board_empty_state.png`, `11_nc_plan_board_act_chapter_scene.png`, `12_nc_plan_board_multi_chapter_grid.png`, `13_nc_plan_board_scene_cards_filled.png`

### TopNav pill gombok

`Plan | Írás | Chat | Áttekintés`

- Aktív: `bg-accent-strong text-white rounded-full px-4 h-8`  (NEM nyers `#1a1a1a`)
- Inaktív: `text-text-muted hover:bg-surface-muted rounded-full`

Nézet-választó (jobb oldalon):

- `Rács | Mátrix | Vázlat` → grouped toggle, `border border-border rounded-lg`
- Aktív: `bg-accent-strong text-white`  (NEM nyers `#1a1a1a`)
- `SZŰRŐ:` label + `Search` input (36px, rounded-lg)

### Act szint

```
GripVertical   ChevronDown   [Act 1 bold]   [+ Új fejezet]   PenLine   MoreHorizontal   [N fejezet]
```

- `GripVertical`: 14px, textFaint, visible on hover (dnd-kit drag handle)
- `+ Új fejezet`: dashed border, 28px compact, ghost
- `PenLine`, `MoreHorizontal`: 28px ghost gombok

### Chapter oszlop

Szélesség: 280px. Háttér: `#f8f6f2`. `border border-border rounded-xl`.

Header: `GripVertical` + cím (14px bold) + `PenLine` + `MoreHorizontal` + szószám (12px textFaint).

Tartalom: vertical stack of SceneCards.

Footer: `+ Új jelenet` gomb, teljes szélességű, ghost dashed border.

### SceneCard

```css
.scene-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-xl); /* 12px */
  padding: 12px;
  box-shadow: var(--shadow-card);
}
.scene-card:hover {
  box-shadow: var(--shadow-hover);
  border-color: var(--border-strong);
}
.scene-card[data-selected] {
  border: 2px solid var(--accent);
  background: var(--accent-muted);
}
```

Tartalom:

```
Header:  GripVertical + "Jelenet 1" (13px medium) + PenLine ghost + MoreHorizontal
POV sor: Eye (12px accent) + "3. személy (Korlátozott) – Callum" (12px accentText)
Summary: textarea, 13px Literata, placeholder "Összefoglaló hozzáadása..."
Footer:  [Callum badge]  [+ Codex]  [◇ Cimke]
```

**POV badge** — karakternév pill, `rounded-full`, egyedi szín per karakter (amber/rose/emerald/sky/violet/orange sorozat).

**Codex/Label linkek:** `Plus ikon + "Codex"` és `Tag ikon + "Cimke"` — 11px, textMuted, ghost.

### Üres állapot (empty state)

```
Ikonok: nincs semmi
H3: "Még semmi nincs itt!"
Body: "Kezdd el a könyvedet elölről, importálj vázlatot, vagy tölts be egy meglévő kéziratot."
CTA: [+ Első jelenet létrehozása] (accent, dashed border 2px)
```

Bottom toolbar: `+ Felvonás hozzáadása` | `≡ Létrehozás vázlatból` | `⊕ Importálás` | `▶ Műveletek`

---

## Scene kártya — MoreHorizontal context menu

> ref: `15_nc_scene_context_menu_ai_model_picker.png`

```
Header (nem kattintható):
  "1. FEJEZET – 1. JELENET" (11px uppercase tracking-wide textFaint)
  összefoglaló preview (2 sor, 12px textMuted)
  [⠿ Műveletek] [◇ Cimke] [+ Codex]

── Normál ──────────────────────────────────
  Eye            Egyéni nézőpont beállítása
  Heading2       Alcím hozzáadása
── AI ──────────────────────────────────────
  Bot            Beleszámít az AI kontextusba    [Toggle]
  AlignLeft      Jelenet összefoglalása           ›
  Users          Karakterek felismerése           ›
  MessageCircle  Chat a jelenettel

AI model submenu (Jelenet összefoglalása hover):
  "Népszerű"
  <cpu>  Gemini 2.5 Flash
  <cpu>  Claude 4.5 Sonnet    [Moderált]
  "Egyéb"
  <cpu>  Claude 4.5 Haiku     [Moderált]
  <cpu>  Gemini 2.5 Flash Lite
  <cpu>  GPT-5 mini            [Moderált]
```

"Moderált" badge: `bg-warning-muted text-warning-text` + `AlertTriangle` ikon, 10px, rounded (NEM nyers `orange-100`). A modellnevek (Gemini/Claude/GPT) csak illusztrációk — a `ModelRouter` configból renderelnek.

---

## Write View — teljes spec

> ref: `16_nc_write_view_full_layout.png`, `23_sw_write_view_gradient_toolbar.png`

### Toolbar (szerkesztő felett)

ForgeWriter adaptáció — NEM gradiens, hanem: `bg-surface border-b border-border`.

```
Írás ∨  |  Leírás ∨  |  Átírás  |  Ötletelés  |  Vizualizáció  |  Több ∨
                                                             Szavak: NNN  ✓ Mentve
```

- Gombok: 32px kompakt pill, `border border-border rounded-full`
- Hover/aktív: `bg-accentMuted text-accent`
- `∨` jelzi: legördülő almenü

### Szerkesztő (center)

```css
.manuscript-editor {
  max-width: 820px;
  margin: 0 auto;
  padding: 48px 64px;
  background: var(--surface-soft);
  border-radius: var(--radius-2xl);
  box-shadow: var(--shadow-panel);
  font-family: var(--font-manuscript);
  font-size: 17px;
  line-height: 1.75;
  color: var(--text);
}
```

- Fejezet cím (H1): 24px, font-weight 600, `mb-6`
- Jelenet cím (H2): 18px, font-weight 500, `mb-4`, textMuted
- Bekezdések: `mb-4`
- Karakter-name kiemelés (Codex detect után): `bg-accentMuted rounded px-0.5`

### Floating Selection Bubble Menu

Megjelenés: text kijelölés → lebegő pill a kijelölés felett.

```
Container: bg-surface, shadow-popover, border border-border, rounded-full, px-1
Megjelenés: y: 8→0, opacity: 0→1, duration: 0.15s
Gombok: [RefreshCw Átírás] [Eye Leírás] [ChevronsUpDown Bővítés] [Wand2 Vizualizáció]
Gomb stílus: 30px, px-3, 13px, ghost, hover:bg-surfaceMuted
```

### Bottom Status Bar (Write mode)

32px, `bg-surface border-t border-border`, flex between:

- Bal: `"NNN szó"` (12px textFaint)
- Közép: `"✓ Mentve"` (12px success) VAGY `Loader2 spin + "Mentés..."` (12px textMuted)
- Jobb: `Cpu ikon + "ollama/llama3.2"` (11px badge, aiMuted)

---

## AI Panel (Right Inspector) — AI fül

### Fül fejléc ikonok

`Wand2 AI` | `Database Codex` | `Activity Beatok` | `AlertTriangle Figyelmeztetések` | `Info Metaadatok`

### AI fül tartalom

**Kontextus szekció:**

```
"KIJELÖLT SZÖVEG" label (11px uppercase textFaint)
bg-surfaceMuted, border-l-2 border-accent, p-3, rounded-r-lg
Literata 13px italic, max 3 sor + "... mutat többet" link
```

**Akció gombok (2×3 grid):**

```
RefreshCw  Átírás      |  Eye         Leírás
ChevronsUpDown Bővítés |  Minimize2   Tömörítés
MessageSquare Párbeszéd|  Sparkles    Javítás
```

Gomb stílus: `rounded-lg border border-border 36px px-3`, hover: `bg-accentMuted border-accent text-accent`.

**Egyéni utasítás textarea:** 72px, `rounded-lg border resize-none 13px`, placeholder: `"Egyéni utasítás..."`

**Modell választó:** `Cpu ikon + Select trigger` (36px). Opciók: Lokális (ollama) | Gemini Flash | stb.

**Generálás gomb:** full-width, accent fill, 40px, `Sparkles` ikon + "Generálás".

**AI Eredmény kártya** (generálás után):

```
Container: border-l-4 border-ai bg-aiMuted rounded-r-xl p-4
Megjelenés: y: 12→0, opacity: 0→1, duration: 0.22s

Header: "ÁTÍRÁS EREDMÉNYE" (11px textFaint uppercase)
        Cpu ikon + modell neve + "v1.0" prompt verziójú badge

Tartalom: Literata 14px, max 8 sor + scroll

Lábléc:
  [CheckCircle2 Elfogad] (success btn 36px) [X Elvet] (ghost 36px)
  [Copy ikon] [Star ikon]
```

---

## Describe / Érzéki Leírás panel

> ref: `24_sw_describe_sensory_channels.png`

Megnyílás: toolbar `Leírás ∨` → vagy jobb panel dedikált tab.
Slide-in animáció jobbról, duration: 0.2s.

**Fejléc:**

```
"ÉRZÉKI LEÍRÁS" (11px uppercase tracking-wide textFaint)
Kiválasztott szöveg preview doboz (lásd AI panel)
```

**Csatorna sorok:**

```
Eye        LÁTÁS        ChevronRight
Ear        HANG         ChevronRight
Hand       TAPINTÁS     ChevronRight
Wind       SZAG         ChevronRight
Droplets   ÍZ           ChevronRight
Quote      METAFORA     ChevronRight
```

Sor stílus: 44px, `hover:bg-surfaceMuted border-b border-border`. Ikon: 18px accent. Label: 13px medium.

**Csatorna kibontva (kattintás után):**

```
Container: bg-aiMuted border-l-4 border-ai rounded-r-xl p-4
Animáció: transform-only — {opacity:0, y:-4}→{opacity:1, y:0}, duration: 0.18s (NEM max-height; height-reveal a grid-trükkel `grid-template-rows:0fr→1fr` ha a konténer-magasság is kell)

Header: [Eye ikon] "LÁTÁS" (13px bold) + [X bezárás]
Tartalom: 2 alternatív bekezdés, Literata 13px, mb-3 között
Minden bekezdés alján: [Star + "Snippet mentése"] ghost gomb (28px)
```

---

## Slash Command menü az editorban

> ref: `17_nc_editor_slash_command_menu.png`

Megjelenés: `"/"` beírása az editorban → lebegő kártya a kurzor alatt.

```
Container: bg-surface border border-border rounded-xl shadow-popover
Szélesség: 260px, max-height: 320px, overflow-y: auto
Megjelenés: y: 6→0, opacity: 0→1, duration: 0.12s
```

Szekció tartalom:

```
── AI ─────────────────────────────────────────────────────────
Activity    JELENET BEAT
            "Kulcsmoment a cselekményben"

PenLine     FOLYTATÁS ÍRÁSA
            "Új beat az írás folytatásához"

── Codex ──────────────────────────────────────────────────────
Database    CODEX PROGRESSZIÓ
            "Világ/karakter fejlődés rögzítése"

── Formázás ───────────────────────────────────────────────────
Heading1 / Heading2 / Bold / Italic / Quote / Divider
```

Item stílus: 36px, `px-3 hover:bg-surfaceMuted rounded-lg`. Bal ikon: 18px accent. Label: 13px medium. Alfelirat: 11px textFaint.

Navigáció: `↑↓` + Enter kiválaszt, Escape = zárás.

---

## Scene Beat kártya (generáló UI)

> ref: `18_nc_editor_scene_beat_card.png`

Inline kártya az editorban (nem popup). Megjelenés: `y: 10→0, opacity: 0→1, duration: 0.22s`.

```
Container: bg-surface border border-border border-l-4 border-l-accent
           rounded-xl p-4 shadow-panel

Header sor:
  [200] [400] [600] szószám pill gombok (aktív: accent fill, 28px)
  PenLine gomb (egyéni utasítás, 28px ghost)
  Plus + "Kontextus" gomb (Codex entitás, 28px ghost)

Modell badge: Cpu ikon + model neve (11px, aiMuted bg)
```

**Állapot 1 — Generálás közben:**

```
Loader2 spin (accent) + "Generálás..." (13px textMuted)
ProgressBar (indeterminate, transform-only — NEM width, NEM gradiens):
  Track: w-full h-1 bg-accent-muted rounded-full overflow-hidden
  Bar:   w-1/3 bg-accent, animate-[indeterminate_1.1s_ease-in-out_infinite]
         @keyframes indeterminate { 0%{transform:translateX(-120%)} 100%{transform:translateX(320%)} }
```

**Állapot 2 — Kész, jóváhagyásra vár:**

```
Generált szöveg: Literata 14px, max 5 sor + scroll

Toolbar:
  [CheckCircle2 Alkalmaz] (success btn 32px)
  [RefreshCw Újra]        (ghost 32px)
  [X Elveti]              (ghost 32px)
  [Layers Szekció]        (ghost 32px, "Szekció-határként jelölés")

Lábléc: "NNN szó · [modell neve]" (11px textFaint)
```

Elvetés animáció: `opacity: 1→0, height: auto→0, duration: 0.18s`.

---

## Revision History panel

> ref: `19_nc_revision_history_panel.png`

Megnyílás: jobb panel overlay VAGY szerkesztő feletti modal. Panel slide-in: `x: 20→0, opacity: 0→1, duration: 0.18s`.

```
Fejléc: "Verzióelőzmények" (16px bold) + [X bezárás]

Layout: flex row, 60%/40% arány

┌── Bal (szöveg preview) ───────────────┬── Jobb (timeline) ────────────────┐
│ Teljes jelenet szövege                │ Verzió lista:                      │
│ Literata 14px, scrollable             │                                    │
│                                       │  ● 44 perce                        │
│ Aktív verzió szövege: halványabb bg   │    te szerkesztetted               │
│ vs inaktív → diff látható             │  ─────────────────                 │
│                                       │  ● Ma, 9:44                        │
│                                       │    te szerkesztetted               │
│                                       │  ─────────────────                 │
│                                       │  Továbbiak betöltése               │
└───────────────────────────────────────┴────────────────────────────────────┘

Verzió sor: 48px, px-3, hover:bg-surfaceMuted
Aktív: bg-accentMuted border-l-2 border-accent
Időbélyeg: 12px textMuted | Szerző: 11px textFaint

Lábléc:
  [RotateCcw Verzió visszaállítása] (accent ghost 36px)
  [X Bezárás] (ghost 36px)
```

---

## Chat / Thread nézet

> ref: `20_nc_chat_view_empty_thread.png`, `21_nc_chat_codex_mention_highlight.png`

TopNav: ugyanaz a pill sor mint Plan Board-on.
Sub-tab: `Chat | Áttekintés`

**Üres állapot:**

```
Center: MessageCircle ikon (48px textFaint)
H3: "Ez egy új téma." (16px)
Body: "Kezdj el gépelni... A Codex bejegyzések megemlítése automatikusan kontextusba kerül."
Footer: "Az AI tévedhet. Ellenőrizz minden fontos információt." (11px textFaint)
```

**Chat buborékok:**

- User: jobb oldal, `bg-accentMuted rounded-2xl rounded-tr-sm`
- AI: bal oldal, `bg-surface border rounded-2xl rounded-tl-sm`, Literata 14px

**Alsó input terület:**

```
Context expander: [ChevronDown "+ Kontextus"] ghost 28px
  Kibontva: checkbox lista (Jelenet kontextus | Teljes regény szöveg | Codex)

Input container: bg-surface border rounded-2xl p-2
  Textarea: min 40px auto-expand, 14px, "Kérdezz bármit..."
  @mention: Codex entitásnév → dashed accent box keret

Lábléc:
  [Sparkles + "Általános Chat, [modell]" ∨] (model dropdown)
  [Send gomb: `bg-accent-strong text-white` pill, SendHorizontal ikon — NEM nyers fekete]
```

Send animáció: `scale: 1→0.95→1, duration: 0.1s`.

---

## Projects Dashboard — részletes spec

> ref: `01_nc_projects_welcome_screen.png`, `02_nc_projects_novels_list.png`

### Üres állapot

```
Center column, max-width 480px, text-center

H2: "Üdvözöl a ForgeWriter AI!" (24px bold)
Body: "Melyik projektedet szeretnéd ma folytatni?" (15px textMuted)

2 opció kártya (dashed border 2px, rounded-2xl, 220×160px, gap-4):
┌── Új projekt ──────────────────────┐  ┌── Importálás ───────────────────┐
│  BookOpen (48px accent)             │  │  FileInput (48px textMuted)     │
│  "Új projekt létrehozása"  14px bold│  │  "Kézirat importálása" 14px bold│
│  "Hozd ide az ötleteidet..." 13px   │  │  ".docx, .md, .txt" 12px       │
└────────────────────────────────────┘  └─────────────────────────────────┘

Bal kártya hover: border-accent bg-accentMuted
Jobb kártya hover: bg-surfaceMuted
```

### Kitöltött állapot

**"Folytasd ott ahol abbahagytad" szekció:**

Vízszintes scroll, 2 recent kártya (260px):
- Cover thumbnail (40×56px) + cím (15px bold) + szerző (12px textFaint) + időbélyeg

**"Az összes projekted" szekció:**

Controls sor: `Search` input | `Sort` dropdown | `Group` dropdown | Grid/List toggle

Grid kártya (180px):

```
Cover area: 100px magas, bg-surfaceMuted rounded-t-xl, BookOpen ikon center
Body: cím 14px bold, szerző 12px textFaint, genre badge
Footer: N könyv · N szó · last edited
```

List kártya:

```
[cover 40×56px]  [cím 15px]  [genre badge]  [N szó]  [dátum]  [ChevronRight]
```

Lábléc: `[+ Projekt létrehozása]` (accent fill 36px) + `[FileInput Importálás]` (ghost outline 36px)

---

## Thesaurus / Szó-javaslat panel

> ref: `25_sw_thesaurus_word_cloud.png`

Megjelenés: szóra dupla kattintás VAGY `Több ∨ → Tezaurusz` toolbar opció.

```
Fejléc: "...belépett a sziklafal mentén. cautiously..."
  (kontextus mondat, a kiválasztott szó bold Literata)

Nézet toggle: [Lista] [Felhő]   — alapból a Lista (a nyugodt cockpithoz); a Felhő opcionális.

**Felhő nézet:**

```
Szavak: font-size 14–22px, különböző pozíció; max 24 szó (a kaszkád ne legyen zajos)
Szín: alap text-muted, hover: text-accent-text + cursor-pointer (soha nem random per-szó szín)
Kattintás: szó bekerül a szövegbe, panel bezárul
Megjelenés: opacity-only stagger fadeIn, delay = min(i*0.03, 0.3)s összesen
Reduced-motion: minden szó egyszerre jelenik meg (nincs stagger)
```

**Lista nézet:**

```
Közvetlen szinonimák
Tágabb fogalmak
Ellentétes
```

---

## Karakter Detail oldal

> ref: `07_nc_codex_character_detail_tabs.png`, `08_nc_codex_character_portrait_mentions.png`, `09_nc_codex_relations_ai_tracking.png`

### Fejléc

```
Típus dropdown: [UserRound "Karakter" ChevronDown] ghost pill (13px)
Név: 22px bold h1
[+ Cimkék/Jelölők] ghost link (12px)
Jobb felső: portré doboz 80×80px, rounded-xl, border-2 border-dashed border-border
  Üres: bg-surfaceMuted + UserRound (32px textFaint) center
  Hover: [Upload] [Paste] sötét semleges pill gombok (`bg-text text-surface` — NEM nyers fekete)
[N megemlítés] jobb felső (12px accentText) — ha N > 0
```

### Tab sáv

`Részletek | Kutatás | Kapcsolatok | Megemlítések | Nyomon követés | ⋮`

Aktív tab: `border-b-2 border-accent text-text font-medium`

### Részletek tab

**Álnevek/Becénevek szekció:**

```
Label: "Álnevek/Becénevek" + [? segítség] + [Sparkles AI javaslat]
Input: text field 36px, comma-separated értékek
Javaslatok: chips (pl. "Richards", "Mia") bg-surfaceMuted, kattintható (hozzáad)
```

**Leírás szekció:**

```
Label: "Leírás" + [? segítség] + [Sparkles AI]
Textarea: auto-magasság, Literata 14px, line-height 1.6
Lábléc: "NNN szó"  [Progressziók ↗]  [Előzmények ↗]  [Copy ikon]
```

**Egyéni mezők:**

```
Story Role: [● Suspect ∨] dropdown — piros dot | narancssárga Victim | zöld Protagonist stb.
[Plus "Részlet hozzáadása"] ghost link
```

### Kapcsolatok tab (Relations)

```
Kapcsolat kártyák:
  [Avatar kör]  Karakter neve (14px bold)                    [↔ ikon]
  [Szerep badge]
  Rövid leírás (12px textFaint, 2 sor max)
```

AI Nyomon követés (Tracking):

```
☑  Nyomkövetés névvel/álnévvel
─────────────────────────────────────
AI KONTEXTUS
○  Mindig belekerül az AI kontextusba
●  Beleszámít, ha felismerve  [Alapértelmezett]
```
