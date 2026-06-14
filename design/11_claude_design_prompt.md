# ForgeWriter AI — Claude Design Prompt

Ez a dokumentum egy teljes, részletes design prompt gyűjtemény a ForgeWriter AI frontend tervezéséhez.
Referencia képek: `design/01_nc_*.png` (NovelCrafter), `design/22_sw_*.png` – `design/25_sw_*.png` (Sudowrite).

---

## 0. Kötelező alapok (ezek felülírnak minden alábbi inline értéket)

> A token-értékek kanonikus forrása a `DESIGN.md`. Ahol az alábbi szekciók eltérnek tőle, **ez a 0. szakasz és a `DESIGN.md` az irányadó.**

**Theming:** Minden szín **szemantikus CSS-változó** a `globals.css`-ben (`:root`), a Tailwind ezekre hivatkozik, a komponensek soha nem tartalmaznak nyers hexet. Ez teszi lehetővé a „light first, dark later" egy-fájlos váltást (`next-themes`, `attribute="class"`). A teljes `:root` + `.dark` token-blokk a `DESIGN.md`-ben él (kanonikus forrás) — onnan másold a `globals.css`-be; itt ne duplikáld.

**Kontraszt (WCAG AA — kötelező):**
- `text-faint` (#9b9187) **csak dekoratív / disabled** — soha nem információs szöveg. Időbélyeg, képaláírás, szószám, metaadat → `text-muted` (#6f675f).
- Accent színű szöveg/link **soha** nyers `accent` (#6d5dfc, 3.9:1 — bukik), hanem `accent-text` (#342a91, ~8.5:1).
- Elsődleges gomb kitöltése `accent-strong` (#5b4de0), fehér felirattal (~5.9:1).
- Badge szöveg muted háttéren: `warning-text` (#8a5a13), `success-text` (#256544), `danger-text` (#9a3412) — nem a bázis token.

**Badge-ek token-alapúak** (nincs nyers Tailwind hue, mint `bg-amber-100`): a státusz/POV/Codex badge-ek a `DESIGN.md` token-térképét és a fix `--pov-1..6` paletta-rotációt használják (karakter-index szerint, az accent/ai violetet kizárva). Minden badge ikont VAGY címkét is hordoz — soha nem csak szín.

**Aktív pill/toggle és Send gomb:** `bg-accent-strong text-white` — **nincs nyers `#1a1a1a`/fekete**. (A 10. szakasz adaptációs táblája ezt mondja ki; ahol a 7. szakasz `bg-[#1a1a1a]`-t mutat, az elavult — ezt használd helyette.)

**Interakciós állapotok — minden interaktív elem definiálja:** default / hover (`@media (hover:hover)` mögött) / **`focus-visible`** (ring-2 ring-ring ring-offset-2, soha nem nyers `:focus`) / active / **selected** (perzisztens, hovertől elkülönülő) / **disabled** (opacity-50 cursor-not-allowed) / **loading** (Loader2 spin, aria-busy) / **error** (border-danger + role="alert" + aria-invalid).

**Mozgás:** `prefers-reduced-motion` kötelező (`useReducedMotion()` + globális CSS). **Csak `transform` + `opacity` animálható** — soha `height`/`width`/`maxHeight`/`scaleY`. A `channelExpand`/`dropdownOpen` height-reveal helyett `{opacity, y}`; a progress bar indeterminate `translateX`-szel (nincs width-animáció, nincs gradiens-fill). Nincs animáció gyakori/billentyűs akción (command palette, panel-toggle, tab-váltás, editor).

**Akadálymentesítés:** minden ikon-gombnak `aria-label` (magyar); Radix/shadcn primitívek minden menühöz/dialógushoz; `Dialog` → `DialogTitle`+`DialogDescription`; **destruktív kaszkád-művelet (fejezet/könyv törlés, revízió-előzmény ürítés) `AlertDialog`-ban** — toast-undo csak visszafordítható egyelemű törlésre.

**Reszponzív:** `h-dvh` (nem `h-screen`). ≥1280px három panel; 1024–1279px a RightInspector `Sheet`; <1024px a LeftSidebar 64px ikon-sáv. Z-index csak a `DESIGN.md` named skálájából.

**Modellnevek placeholderek:** a `ollama/llama3.2`, `Gemini 2.5 Flash` stb. csak illusztráció — a badge a `ModelRouter` configból renderel (`<ModelBadge model provider />`), soha nincs hardcode-olt modellnév komponensben.

**Kézirat measure:** a próza oszlopa `max-w-[65ch]` (60–75 karakter/sor), `text-pretty` + `hyphens-auto` (`lang="hu"`); szószámok `tabular-nums`.

---

## 1. Termék leírás

ForgeWriter AI egy **lokális-first, agentic AI regényíró munkaterület**.
Nem chatbot, nem Notion-klón — hanem egy strukturált "writer's cockpit":
manuscript editor + story planning board + Codex adatbázis + AI asszisztens panel.
Elsősorban **magyar nyelvű hosszú-forma fikció** írásához tervezve.

---

## 2. Vizuális identitás — teljes token táblázat

| Token | Érték | Használat |
|---|---|---|
| `--bg` | `#f8f6f2` | Fő oldal háttér |
| `--bg-subtle` | `#f3f0ea` | Sidebar, panel háttér |
| `--surface` | `#ffffff` | Kártyák, modal, editor |
| `--surface-muted` | `#f1eee8` | Input háttér, hover state |
| `--border` | `#ded8ce` | Alapértelmezett szegélyek |
| `--border-strong` | `#c9c0b4` | Fókusz, aktív card border |
| `--text` | `#2f2a24` | Elsődleges szöveg |
| `--text-soft` | `#4c453d` | Bekezdések, másodlagos szöveg |
| `--text-muted` | `#6f675f` | Labelek, placeholderek |
| `--text-faint` | `#9b9187` | Disabled, metaadat |
| `--accent` | `#6d5dfc` | Elsődleges akció, aktív nav |
| `--accent-muted` | `#ebe9ff` | Accent háttér, badge |
| `--accent-hover` | `#5b4de0` | Hover on accent button |
| `--accent-text` | `#342a91` | Accent szövegszín (sötét bg-n) |
| `--ai` | `#7c3aed` | AI elemek, AI border |
| `--ai-muted` | `#f0e9ff` | AI kártya háttér |
| `--success` | `#2f7d55` | Mentve, elfogadva |
| `--success-muted` | `#e6f3ec` | Success badge háttér |
| `--warning` | `#b7791f` | Figyelmeztetések |
| `--warning-muted` | `#fff4da` | Warning badge háttér |
| `--danger` | `#c2410c` | Hibák, törlés |
| `--danger-muted` | `#fff0e8` | Error badge háttér |

**Tailwind CSS 4.x config (részlet):**

```ts
// tailwind.config.ts
export default {
  theme: {
    extend: {
      colors: {
        bg: "#f8f6f2",
        "bg-subtle": "#f3f0ea",
        surface: { DEFAULT: "#ffffff", muted: "#f1eee8", soft: "#faf8f5" },
        border: { DEFAULT: "#ded8ce", strong: "#c9c0b4" },
        text: {
          DEFAULT: "#2f2a24", soft: "#4c453d",
          muted: "#6f675f", faint: "#9b9187",
        },
        accent: {
          DEFAULT: "#6d5dfc", muted: "#ebe9ff",
          hover: "#5b4de0", text: "#342a91",
        },
        ai: { DEFAULT: "#7c3aed", muted: "#f0e9ff" },
        success: { DEFAULT: "#2f7d55", muted: "#e6f3ec" },
        warning: { DEFAULT: "#b7791f", muted: "#fff4da" },
        danger: { DEFAULT: "#c2410c", muted: "#fff0e8" },
      },
      fontFamily: {
        ui: ["Inter", "Geist", "system-ui", "sans-serif"],
        manuscript: ["Literata", "Lora", "Georgia", "serif"],
      },
      borderRadius: {
        sm: "4px", DEFAULT: "6px", md: "8px",
        lg: "10px", xl: "12px", "2xl": "16px", "3xl": "20px",
      },
      boxShadow: {
        card: "0 1px 2px rgba(47,42,36,0.06)",
        hover: "0 2px 8px rgba(47,42,36,0.10)",
        panel: "0 2px 8px rgba(47,42,36,0.08)",
        popover: "0 4px 16px rgba(47,42,36,0.14)",
        modal: "0 8px 32px rgba(47,42,36,0.18)",
      },
    },
  },
}
```

---

## 3. Tipográfia táblázat

| Stílus | Font | Méret | Weight | Line-height | Szín |
|---|---|---|---|---|---|
| UI Display | Inter | 24px | 700 | 1.3 | text |
| UI H1 | Inter | 20px | 600 | 1.35 | text |
| UI H2 | Inter | 16px | 600 | 1.4 | text |
| UI H3 | Inter | 14px | 600 | 1.5 | text |
| UI Body | Inter | 14px | 400 | 1.5 | text-soft |
| UI Small | Inter | 13px | 400 | 1.5 | text-muted |
| UI Caption | Inter | 12px | 400 | 1.4 | text-muted |
| UI Micro | Inter | 11px | 500 | 1.3 | text-faint |
| UI Badge | Inter | 11px | 600 | 1 | — |
| MS H1 (fejezet) | Literata | 24px | 600 | 1.4 | text |
| MS H2 (jelenet) | Literata | 20px | 500 | 1.45 | text-soft |
| MS Body | Literata | 17px | 400 | 1.75 | text |
| MS Quote | Literata | 16px | 400 italic | 1.6 | text-soft |
| MS Beat | Literata | 16px | 400 italic | 1.6 | text-muted |

---

## 4. Layout diagram

```
┌──────────────────────────────────────────────────────────────────────────┐
│  TopBar (52px)                                                            │
│  [Logo + Projekt ∨]        [Fejezet › Jelenet]        [Cpu model] [⚙ 👤]│
├────────────────┬──────────────────────────────────────┬──────────────────┤
│                │                                      │                  │
│  LeftSidebar   │           MainWorkspace              │  RightInspector  │
│  260px         │           flex-1                     │  360px           │
│                │                                      │                  │
│  Nav ikonok    │  [Plan Board / Editor / Codex DB]    │  AI | Codex      │
│  Könyv-fa      │                                      │  Beats | Warn.   │
│                │                                      │  Metadata        │
│                │                                      │                  │
├────────────────┴──────────────────────────────────────┴──────────────────┤
│  StatusBar (32px) — szavak · mentve · modell                              │
└──────────────────────────────────────────────────────────────────────────┘
```

**Méretek:**

| Elem | Érték |
|---|---|
| TopBar | 52px magasság |
| LeftSidebar (default) | 260px, min 200px, max 340px |
| RightInspector (default) | 360px, min 300px, max 440px |
| StatusBar | 32px |
| Editor max-width | 820px |
| Editor padding | 48px 64px (desktop) |
| Chapter column (Plan Board) | 280px |
| Scene card padding | 12px |

---

## 5. Lucide ikon készlet

| Kategória | Lucide ikon nevek |
|---|---|
| Projekt / Könyv | `BookOpen`, `Book`, `BookMarked`, `Library` |
| Fejezet / Jelenet | `AlignLeft`, `FileText`, `Film`, `Layers` |
| Beat | `Activity`, `Zap` |
| Karakter | `UserRound`, `User`, `Users` |
| Helyszín | `MapPin`, `Map`, `Globe` |
| Tárgy / Lore | `Box`, `BookOpen`, `Tag`, `Database` |
| AI akció | `Wand2`, `Sparkles`, `Bot`, `Brain` |
| Átírás | `RefreshCw`, `PenLine` |
| Érzéki csatornák | `Eye`, `Ear`, `Hand`, `Wind`, `Droplets`, `Quote` |
| Folytatás | `ChevronRight`, `Play`, `ArrowDown` |
| Generálás | `Zap`, `Sparkles` |
| Export | `Download`, `FileOutput`, `Package` |
| Verzió előzmény | `History`, `Clock`, `RotateCcw` |
| Chat | `MessageSquare`, `MessageCircle` |
| Ellenőrzés | `ScanEye`, `CheckCircle2`, `AlertTriangle` |
| Beállítások | `Settings`, `SlidersHorizontal`, `Settings2` |
| Drag handle | `GripVertical` |
| Összecsuk / kibont | `ChevronDown`, `ChevronRight` |
| Archiválás | `Archive`, `ArchiveX` |
| Törlés | `Trash2` |
| Jelölés / Snippet | `Star`, `StarOff` |
| Beillesztés | `CornerDownLeft`, `Plus` |
| Másolás | `Copy`, `ClipboardCopy` |
| Keresés | `Search` |
| Szűrés | `SlidersHorizontal`, `Filter` |
| Modell indikátor | `Cpu` (lokális), `Cloud` (felhő) |
| Figyelmeztetés | `AlertTriangle`, `AlertCircle` |
| Siker | `CheckCircle2`, `Check` |
| POV indikátor | `Eye` + karakternév badge |
| Bezárás | `X`, `XCircle` |
| Mentés | `Save` |
| Beküldés | `SendHorizontal`, `Send` |
| Lezárás | `Lock`, `Unlock` |
| Panel váltás | `PanelLeftClose`, `PanelRightClose`, `Columns2` |
| Importálás | `FileInput` |
| Kapcsolatok | `Network`, `GitBranch` |
| Idősor | `CalendarDays`, `Clock` |
| Stílus kalauz | `PenLine`, `AlignJustify` |
| AI státusz | `Loader2` (spin), `CheckCircle2` (kész) |

---

## 6. Animációs rendszer (Framer Motion 11.x)

### Motion token táblázat

| Token neve | initial | animate | ease | duration |
|---|---|---|---|---|
| `panelIn` | `{x:20, opacity:0}` | `{x:0, opacity:1}` | `easeOut` | `0.18s` |
| `panelOut` | `{x:0, opacity:1}` | `{x:20, opacity:0}` | `easeIn` | `0.15s` |
| `aiResultIn` | `{y:12, opacity:0}` | `{y:0, opacity:1}` | `easeOut` | `0.22s` |
| `beatCardIn` | `{y:10, opacity:0}` | `{y:0, opacity:1}` | `easeOut` | `0.22s` |
| `slashMenuIn` | `{y:6, opacity:0}` | `{y:0, opacity:1}` | `easeOut` | `0.12s` |
| `bubbleMenuIn` | `{y:8, opacity:0}` | `{y:0, opacity:1}` | `easeOut` | `0.15s` |
| `cardHoverLift` | `{y:0}` | `{y:-2}` | `easeOut` | `0.12s` |
| `modalIn` | `{scale:0.96, opacity:0}` | `{scale:1, opacity:1}` | `easeOut` | `0.18s` |
| `toastIn` | `{x:"100%", opacity:0}` | `{x:0, opacity:1}` | `easeOut` | `0.22s` |
| `buttonPress` | — | `{scale:0.96}` | — | `0.08s` |
| `dropdownOpen` | `{height:0, opacity:0}` | `{height:"auto", opacity:1}` | `easeOut` | `0.15s` |
| `channelExpand` | `{opacity:0, y:-4}` | `{opacity:1, y:0}` | `easeOut` | `0.18s` |
| `discardFade` | `{opacity:1, height:"auto"}` | `{opacity:0, height:0}` | `easeIn` | `0.18s` |

### Stagger minták

```ts
// Kártya lista betöltés
const cardListVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.06 } },
}
const cardItemVariants = {
  hidden: { y: 8, opacity: 0 },
  show: { y: 0, opacity: 1, transition: { duration: 0.18, ease: "easeOut" } },
}

// Describe csatorna sorok
const channelRowStagger = { staggerChildren: 0.04 }

// Thesaurus szó felhő
const wordCloudStagger = { staggerChildren: 0.04 }
const wordVariant = {
  hidden: { opacity: 0 },
  show: (i: number) => ({ opacity: 1, transition: { delay: i * 0.04, duration: 0.15 } }),
}
```

### Spring konfigurációk

```ts
// Drag & Drop snap-back
const dndSpring = { type: "spring", stiffness: 500, damping: 40 }

// Tab underline indikátor csúszás
const tabIndicatorSpring = { type: "spring", stiffness: 300, damping: 30 }
```

### Loader / folyamat animációk

```ts
// AI generálás pulsálás
const loaderPulse = {
  animate: { opacity: [1, 0.4, 1] },
  transition: { repeat: Infinity, duration: 1.2, ease: "easeInOut" },
}

// Progress bar töltés
const progressFill = {
  initial: { width: "0%" },
  animate: { width: "100%" },
  transition: { ease: "linear", duration: "varies" },
}
```

### Tiltott animációk

- Bounce spring UI elemeken (distraction)
- 0.4s-nál hosszabb panel nyitás
- Loop animáció szerkesztő közben
- Véletlenszerű shake/wiggle
- Auto-play video háttér vagy parallax scroll

---

## 7. Képernyő specifikációk

### A. Projects Dashboard

**Ref képek:** `01_nc_projects_welcome_screen.png`, `02_nc_projects_novels_list.png`

**Üres állapot:**

```
TopBar: [BookOpen "ForgeWriter"]                [Cpu badge] [Search] [Settings] [Avatar]

Center column (max-width: 480px, text-center):
  H2: "Üdvözöl a ForgeWriter AI!"  (24px bold)
  Body: "Melyik projektedet szeretnéd ma folytatni?"  (15px textMuted)

  2 kártya sor (dashed border-2 rounded-2xl 220×160px gap-4):
  ┌─────────────────────────────┐  ┌─────────────────────────────┐
  │  BookOpen (48px accent)      │  │  FileInput (48px textMuted) │
  │  Új projekt létrehozása      │  │  Kézirat importálása        │
  │  14px bold                   │  │  14px bold                  │
  │  "Hozd ide az ötleteidet..." │  │  ".docx, .md, .txt"         │
  │  13px textMuted              │  │  12px textFaint             │
  └─────────────────────────────┘  └─────────────────────────────┘
  Bal hover: border-accent bg-accentMuted
  Jobb hover: bg-surfaceMuted
```

**Kitöltött állapot:**

```
"Folytasd ott ahol abbahagytad" szekció:
  H3: 14px bold  + "Mutasd az összeset →" link 13px accentText

  2 recent projekt kártya (vízszintes scroll, 260px wide):
    [Cover 40×56px] + [cím 15px bold] + [szerző 12px textFaint] + [dátum 11px textFaint]
    hover: shadow-hover, bg-surfaceMuted

"Az összes projekted" szekció:
  Controls: [Search 240px input] [Sort ∨] [Group ∨] [Grid icon toggle] [List icon toggle]

  GRID kártya (180px wide):
    Cover area: 100px, bg-surfaceMuted, rounded-t-xl, BookOpen(32px textFaint) center
    Body: p-3
      Cím: 14px bold
      Szerző: 12px textFaint
      Genre badge: accentMuted, 11px, rounded-full
    Footer: p-2 border-t border-border
      "N könyv · NNN szó" 11px textFaint
      "N napja szerkesztve" 11px textFaint

  LIST kártya (full-width, 56px):
    [Cover 40×56px rounded-md] + [cím 15px] + [genre badge] + [N szó] + [dátum] + [ChevronRight]

Lábléc: [+ Projekt létrehozása] (accent fill 36px) + [FileInput Importálás] (ghost outline 36px)
```

---

### B. Új könyv létrehozása wizard

**Ref képek:** `03_nc_create_novel_wizard.png`

```
Modal: rounded-2xl, shadow-modal, max-width 520px, p-8

Fejléc: "Új könyv létrehozása" (20px bold) + [X] jobb felső

Lépés indikátor: 3 pont + vonal, aktív: accent fill, kész: success fill

Lépés 1 — Alapadatok:
  [Cover feltöltés] 80×112px dashed border rounded-xl  (Upload + Paste ghost btn hover-on)
  Title input: 44px, 16px bold, rounded-xl
  Subtitle input: 36px, 14px, rounded-lg (opcionális)
  Szerző input: 36px, 14px
  Genre dropdown: 36px, ChevronDown ikon belül
  Language: [Magyar] [English] toggle pills

Lépés 2 — Stílus és AI:
  POV: [1. személy] [3. Korlátozott] [3. Mindentudó] radio pills
  Target audience: Felnőtt / YA / Gyerek pills
  Terjedelmi cél: 50 000 / 80 000 / 100 000+ szó pills
  Stílusjegyek: textarea 80px

Lépés 3 — Összefoglalás:
  Read-only preview, szerkesztés gomb (PenLine)
  [Létrehozás] accent fill 44px full-width

Nav gombok: [← Vissza] (ghost) + [Tovább →] (accent fill)
```

---

### C. Plan Board (Act / Chapter / Scene grid)

**Ref képek:** `11_nc_plan_board_act_chapter_scene.png`, `12_nc_plan_board_multi_chapter_grid.png`, `13_nc_plan_board_scene_cards_filled.png`

```
TopNav pill sor:
  [Plan] [Írás] [Chat] [Áttekintés]
  Aktív: bg-accent-strong text-white rounded-full px-4 h-8   (NEM nyers #1a1a1a)
  Inaktív: text-text-muted hover:bg-surface-muted

Jobb oldal:
  [Rács] [Mátrix] [Vázlat] toggle group (border rounded-lg, aktív: bg-accent-strong text-white)
  [Search input 200px]

Act sáv (drag handle + ChevronDown collapse):
  ⠿ GripVertical + "Felvonás 1" 16px bold + [+ Fejezet] dashed + [PenLine] + [···]

Chapter oszlopok (280px, rounded-xl, border, bg-bg):
  Header: ⠿ + cím 14px bold + PenLine + ··· + szószám 11px textFaint
  Body: SceneCard stack (gap-2, p-2)
  Footer: [+ Jelenet] dashed ghost full-width

SceneCard (bg-surface, border, rounded-xl, p-3, shadow-card):
  ┌── ⠿  "1. Jelenet"  PenLine  ···  ──────────────────────────┐
  │  Eye  "3. személy (Korlátozott) – Callum" 12px accentText   │
  │  [Summary textarea, Literata 13px placeholder "Összefoglaló"]│
  │  [Callum badge amber] [+ Codex] [◇ Cimke]                   │
  └──────────────────────────────────────────────────────────────┘

  POV badge sorozat per karakter (token-alapú, characterId hash → --pov-1..6,
  az accent/ai violetet kizárva — soha nem nyers Tailwind hue):
    Callum   → bg-[var(--pov-1-bg)] text-[var(--pov-1-text)]   (amber)
    Mia      → bg-[var(--pov-2-bg)] text-[var(--pov-2-text)]   (rose)
    Sparky   → bg-[var(--pov-3-bg)] text-[var(--pov-3-text)]   (emerald)
    James    → bg-[var(--pov-4-bg)] text-[var(--pov-4-text)]   (sky)
    Elara    → bg-[var(--pov-5-bg)] text-[var(--pov-5-text)]   (slate)
    Tobias   → bg-[var(--pov-6-bg)] text-[var(--pov-6-text)]   (orange)

Scene status badge (jobb felső sarok — token-alapú + ikon, soha nem csak szín;
  AI-violetet nem-AI státusz SOHA nem használ):
  tervezett  → bg-surface-muted text-text-muted border border-border         (+ Circle ikon)
  piszkozat  → bg-accent-muted  text-accent-text                             (+ PenLine ikon)
  elkészült  → bg-[var(--pov-3-bg)] text-[var(--pov-3-text)]                 (+ Check ikon, emerald)
  végleges   → bg-success-muted text-success-text                            (+ CheckCircle2 ikon)

Üres állapot:
  Center: "Még semmi nincs itt!" H3 + leírás + [+ Első jelenet] dashed accent btn

Bottom toolbar:
  [+ Felvonás] [≡ Vázlatból] [⊕ Importálás] [▶ Műveletek]
```

---

### D. Write View — szerkesztő + AI toolbar

**Ref képek:** `16_nc_write_view_full_layout.png`, `23_sw_write_view_gradient_toolbar.png`

```
TOOLBAR (szerkesztő felett, bg-surface border-b, NEM gradiens):
  [Írás ∨] [Leírás ∨] [Átírás] [Ötletelés] [Vizualizáció] [Több ∨]
  Gombok: 32px rounded-full border-border, hover: bg-accentMuted text-accent
  Jobb: "NNN szó" 12px textFaint | "✓ Mentve" 12px success | Loader2 spin

LEFT SIDEBAR (Write módban, szűkített 220px):
  Összecsukható fejezet-fa:
    - Fejezet sor: ChevronDown + AlignLeft + cím + badge
    - Jelenet sor: indent + aktív: bold + accent left dot
    - Hover: bg-surfaceMuted

SZERKESZTŐ (max-width 820px, centered):
  Container: bg-surface rounded-2xl shadow-panel p-[48px_64px]
  Fejezet cím (H1): Literata 24px 600, color text, mb-6
  Jelenet cím (H2): Literata 18px 500, color text-soft, mb-4
  Bekezdések: Literata 17px 400, line-height 1.75, mb-4, color text
  Codex-detected name: alapból border-b border-dotted border-accent/40 cursor-help (NINCS fill,
    hogy ne zajosítsa a prózát); hover: bg-accent-muted/60. Perzisztens bg-accent-muted fill CSAK ha
    a felhasználó bekapcsolja a "Codex-megemlítések kiemelése" kapcsolót a Nézet menüben.
  Cursor line highlight: bg-[rgba(109,93,252,0.04)] (nagyon finom) — ez az editor egyetlen mindig-aktív accent árnyalata

FLOATING BUBBLE MENU (szöveg kijelölés):
  Container: bg-surface border rounded-full shadow-popover px-1
  Megjelenés: y:8→0 opacity:0→1 duration:0.15s
  Gombok: [RefreshCw Átírás] [Eye Leírás] [ChevronsUpDown Bővítés] [Wand2 Vizualizáció]
  Stílus: 30px px-3 13px ghost hover:bg-surfaceMuted

STATUS BAR (szerkesztő alatt, 32px):
  Bal: "NNN szó" 12px textFaint
  Közép: "✓ Mentve" success | Loader2 + "Mentés..." textMuted
  Jobb: Cpu + "ollama/llama3.2" badge (aiMuted bg, 11px)

RIGHT INSPECTOR (AI tab):
  [AI tab-icon] [Codex tab-icon] [Beats tab-icon] [Warn tab-icon] [Info tab-icon]

  Kijelölt szöveg doboz:
    bg-surfaceMuted border-l-2 border-accent p-3 rounded-r-lg
    Literata 13px italic, max 3 sor + "mutat többet" link

  Akció gombok (2×3 grid, 36px rounded-lg border):
    RefreshCw Átírás | Eye Leírás
    ChevronsUpDown Bővítés | Minimize2 Tömörítés
    MessageSquare Párbeszéd | Sparkles Javít
    hover: bg-accentMuted border-accent text-accent

  Egyéni utasítás textarea: 72px resize-none rounded-lg 13px
  Modell dropdown: Cpu + trigger 36px
  Generálás gomb: full-width accent 40px Sparkles ikon

  AI Eredmény kártya (generálás után):
    border-l-4 border-ai bg-aiMuted rounded-r-xl p-4
    Megjelenés: y:12→0 opacity:0→1 duration:0.22s
    "ÁTÍRÁS EREDMÉNYE" 11px textFaint
    Cpu + modell neve + "v1.0" badge
    Literata 14px tartalom, max 8 sor + scroll
    [CheckCircle2 Elfogad] success 36px + [X Elvet] ghost + [Copy] + [Star]
```

---

### E. Describe / Érzéki Leírás panel

**Ref képek:** `24_sw_describe_sensory_channels.png`

```
Megnyílás: toolbar "Leírás ∨" → slide-in jobbról, duration 0.20s

Fejléc:
  "ÉRZÉKI LEÍRÁS" 11px uppercase tracking-wide textFaint
  Kijelölt szöveg doboz (identikus az AI panellel)

Csatorna sorok (44px, hover:bg-surfaceMuted, border-b):
  Eye     LÁTÁS       ChevronRight
  Ear     HANG        ChevronRight
  Hand    TAPINTÁS    ChevronRight
  Wind    SZAG        ChevronRight
  Droplets ÍZ         ChevronRight
  Quote   METAFORA    ChevronRight

Csatorna kibontva (transform-only animáció — {opacity:0,y:-4}→{opacity:1,y:0}, duration 0.18s; NEM maxHeight):
  Container: bg-aiMuted border-l-4 border-ai rounded-r-xl p-4
  Header: Eye ikon + "LÁTÁS" 13px bold + [X] jobb
  2 alternatív bekezdés (Literata 13px, mb-3)
  Minden bekezdés alján: [Star Snippet mentése] ghost 28px

Generálás közbeni állapot:
  Loader2 spin accent + "Generálás..." 13px textMuted
  ProgressBar: h-0.5 w-full bg-accentMuted, fill: animated accent width
```

---

### F. Scene Beat generálás (inline editor kártya)

**Ref képek:** `18_nc_editor_scene_beat_card.png`

```
Slash "/" → dropdown megjelenik (y:6→0 opacity:0→1 duration:0.12s):
  bg-surface border rounded-xl shadow-popover, 260px, max-height 320px scroll

  ── AI ─────────────────────────────────────────────────────────
  Activity  JELENET BEAT         "Kulcsmoment a cselekményben"
  PenLine   FOLYTATÁS ÍRÁSA      "Új beat az írás folytatásához"
  ── Codex ──────────────────────────────────────────────────────
  Database  CODEX PROGRESSZIÓ    "Fejlődés rögzítése"
  ── Formázás ───────────────────────────────────────────────────
  Heading1 H1 | Heading2 H2 | Bold | Italic | Quote | Separator

  Item: 36px px-3 rounded-lg hover:bg-surfaceMuted
  Navigáció: ↑↓ Enter, Escape zárás

Beat kártya megjelenés (y:10→0 opacity:0→1 duration:0.22s):
  bg-surface border border-l-4 border-l-accent rounded-xl p-4 shadow-panel

  Header:
    Szószám pill gombok: [200] [400] [600] (aktív: accent fill 28px)
    [PenLine Egyéni utasítás] ghost 28px
    [Plus Kontextus] ghost 28px
    Cpu badge: modell neve 11px aiMuted

  Generálás közbeni állapot:
    Loader2 spin + "Generálás..." 13px textMuted
    ProgressBar animated

  Kész állapot (jóváhagyásra vár):
    Literata 14px tartalom, max 5 sor
    Toolbar:
      [CheckCircle2 Alkalmaz] success 32px
      [RefreshCw Újra] ghost 32px
      [X Elveti] ghost 32px
      [Layers Szekció] ghost 32px
    Lábléc: "NNN szó · modell neve" 11px textFaint

  Elvetés: opacity:1→0 height:auto→0 duration:0.18s
```

---

### G. Codex Sidebar + New Entry dropdown

**Ref képek:** `04_nc_codex_sidebar_empty.png`, `05_nc_codex_sidebar_with_cover.png`, `06_nc_codex_new_entry_types.png`

```
Fejléc:
  [ChevronLeft vissza] + [Settings2]
  Cover thumbnail 40×56px rounded-md shadow-sm
  Cím 14px bold (ellipsis 2 sor max)
  Szerző 12px textFaint
  [PanelLeftClose] [Columns2] ikonok jobb fent

Tab sáv:
  [Codex] [Snippets] [Chats]
  Aktív: border-b-2 border-accent text-text font-medium

Keresés sor (gap-1.5):
  Search input 36px rounded-lg "Keresés..."
  SlidersHorizontal ghost 32px
  "+ Új bejegyzés" accent ghost 32px (dashed border)
  Settings2 ghost 32px

New Entry dropdown (y:6→0 opacity:0→1 duration:0.12s):
  bg-surface border rounded-xl shadow-popover 200px

  UserRound  Karakter
  MapPin     Helyszín
  Box        Tárgy / Eszköz
  BookOpen   Lore
  GitBranch  Mellékszál
  File       Egyéb
  ───── Gyors létrehozás ─────
  Globe      Globális bejegyzés
  PenLine    Stílus kalauz
  Layers     Regény műfaj

Entry lista (default compact):
  Csoport fejléc: ChevronDown + label 12px uppercase + count badge
  Entry: 40px kör avatar/ikon + Név 13px + Leírás 11px textFaint (2 sor max) + N mentions

Slim mód: ikon + csak név (LeftSidebar szűkítve)
```

---

### H. Karakter Detail oldal

**Ref képek:** `07_nc_codex_character_detail_tabs.png`, `08_nc_codex_character_portrait_mentions.png`, `09_nc_codex_relations_ai_tracking.png`

```
Fejléc:
  Típus pill dropdown: [UserRound "Karakter" ChevronDown] ghost 13px
  Név: h1 22px bold
  [+ Cimkék/Jelölők] ghost link 12px
  Portré doboz (jobb): 80×80px rounded-xl border-2 border-dashed border-border
    Üres: bg-surfaceMuted + UserRound(32px textFaint)
    Hover: [Upload] [Paste] sötét semleges pill gombok (`bg-text text-surface` — NEM nyers fekete)
  "N megemlítés" jobb felső (12px accentText, ha N > 0)

Tab sáv: [Részletek] [Kutatás] [Kapcsolatok] [Megemlítések] [Nyomon követés] [⋮]
  Aktív: border-b-2 border-accent text-text font-medium

RÉSZLETEK TAB:
  Szekció: Álnevek / Becénevek
    Label + [? segítség] + [Sparkles AI] ikonok
    Input 36px, suggestions chips (bg-surfaceMuted, kattintható)

  Szekció: Leírás
    Label + [? segítség] + [Sparkles AI]
    Textarea auto-magasság, Literata 14px, line-height 1.6
    Lábléc: "NNN szó" + [Progressziók ↗] + [Előzmények ↗] + [Copy]

  Szekció: Story Role
    Dropdown: Suspect (piros dot) | Victim | Protagonist (zöld) | Antagonist stb.
  [Plus "Részlet hozzáadása"] ghost link 12px

KAPCSOLATOK TAB (09 ref):
  Kapcsolat kártyák:
    [Avatar] + Név 14px bold + [↔ ikon] + Szerep badge + leírás 12px textFaint

  AI Tracking szekció:
    ☑  Nyomkövetés névvel/álnévvel
    ─────────────────────────────────
    "AI KONTEXTUS" label 11px uppercase textFaint
    ○  Mindig belekerül az AI kontextusba
    ●  Beleszámít, ha felismerve  [Alapértelmezett]

MEGEMLÍTÉSEK TAB:
  Lista: jelenet neve + fejezet neve + rövid szöveg-részlet (Literata 13px italic)
  hover: bg-surfaceMuted rounded-lg, kattintás: ugrik a jelenetre
```

---

### I. Chat / Thread nézet

**Ref képek:** `20_nc_chat_view_empty_thread.png`, `21_nc_chat_codex_mention_highlight.png`

```
TopNav: [Plan] [Írás] [Chat aktív] [Áttekintés]
Sub-tab: [Chat] [Áttekintés]

Thread fejléc:
  Thread név input (280px, 36px, rounded-lg) VAGY legördülő korábbi thread-ek

ÜRES ÁLLAPOT (center column):
  MessageCircle (48px textFaint)
  H3: "Ez egy új téma." 16px
  Body: "Kezdj el gépelni... A Codex bejegyzések megemlítése automatikusan kontextusba kerül." 13px textMuted
  Footer: "Az AI tévedhet. Ellenőrizz minden fontos információt." 11px textFaint

CHAT BUBORÉKOK:
  User: jobb, bg-accentMuted rounded-2xl rounded-tr-sm, max-width 80%
  AI: bal, bg-surface border rounded-2xl rounded-tl-sm, Literata 14px, max-width 80%
  AI bubble megjelenés: y:8→0 opacity:0→1 duration:0.20s

ALSÓ INPUT TERÜLET:
  Context expander gomb (ChevronDown + "+ Kontextus" ghost 28px):
    Kibontva (dropdownOpen animáció):
      ☑  Jelenet kontextus
      ☑  Teljes regény szöveg
      ☐  Codex

  Input container: bg-surface border rounded-2xl p-2
    Textarea: min-height 40px, auto-expand, 14px
    Codex @mention: beírt @Callum → dashed border bg-accentMuted inline box
    placeholder: "Kérdezz bármit..."

  Lábléc flex between:
    Bal: Sparkles + "Általános Chat, [modell]" ∨  dropdown 13px
    Jobb: Send gomb (bg-accent-strong text-white fill — NEM fekete, SendHorizontal ikon, 36px rounded-full)
    Send click animáció: scale 0.95→1.0 duration 0.1s
```

---

### J. Revision History panel

**Ref képek:** `19_nc_revision_history_panel.png`

```
Megjelenés: jobb panel overlay VAGY szerkesztő feletti modal
Panel slide-in: x:20→0 opacity:0→1 duration:0.18s

FEJLÉC:
  "Verzióelőzmények" 16px bold + [X] jobb

LAYOUT (flex row, 60/40):
  ┌── Bal (szöveg preview, 60%) ──────┬── Jobb (timeline, 40%) ──────┐
  │ Literata 14px, scrollable          │                               │
  │                                    │ ● 44 perce                    │
  │ Aktív verzió szöveg:               │   te szerkesztetted           │
  │   halványabb bg vs többi           │ ─────────────────────         │
  │ (diff látható passively)           │ ● Ma, 9:44                    │
  │                                    │   te szerkesztetted           │
  │                                    │ ─────────────────────         │
  │                                    │ Továbbiak betöltése           │
  └────────────────────────────────────┴───────────────────────────────┘

VERZIÓ SOR:
  48px, px-3, hover:bg-surfaceMuted, border-b border-border
  Aktív: bg-accentMuted border-l-2 border-accent
  Időbélyeg: 12px textMuted
  Szerző: 11px textFaint
  AI-generált badge: Cpu ikon + "AI" (11px aiMuted)

LÁBLÉC:
  [RotateCcw Verzió visszaállítása] accent ghost 36px
  [X Bezárás] ghost 36px
```

---

## 8. Komponens referencia (méret táblázat)

| Komponens | Height | Padding | Radius | Font |
|---|---|---|---|---|
| Primary button | 36px | px-4 | rounded-lg (8px) | 14px medium |
| Secondary button | 36px | px-4 | rounded-lg | 14px |
| Ghost button | 32px | px-3 | rounded-md | 13px |
| Icon button | 32px | px-2 | rounded-md | — |
| Compact button | 28px | px-3 | rounded-md | 12px |
| Primary input | 36px | px-3 | rounded-lg | 14px |
| Textarea | min 72px | p-3 | rounded-lg | 13–14px |
| Tab item | 36px | px-3 py-1.5 | rounded-md | 13px medium |
| Badge (default) | 20px | px-2 py-0.5 | rounded-full | 11px medium 600 |
| Scene card | auto | p-3 | rounded-xl (12px) | 13px |
| Chapter column header | 44px | px-3 | rounded-t-xl | 14px bold |
| Codex entry row | 48px | px-3 | rounded-lg | 13px |
| Dropdown item | 32px | px-3 | rounded-md | 13px |
| Context menu item | 32px | px-3 | — | 13px |
| Tooltip | 24px | px-2 py-1 | rounded-md | 11px |
| Modal | auto | p-6 | rounded-2xl (16px) | 14px |
| Modal header | 56px | px-6 | rounded-t-2xl | 16px bold |
| Nav item | 32px | px-3 | rounded-md | 13px medium |
| Chapter tree row | 28px | px-2 | rounded-md | 13px |
| Separator | 1px | — | — | — |
| Avatar kör | 28–40px | — | rounded-full | initials 11–13px |
| Cover thumbnail | 40×56px | — | rounded-md | — |
| Progress bar | 4px | — | rounded-full | — |
| Status bar | 32px | px-4 | — | 12px |

---

## 9. Interakció minták

**Drag & Drop (dnd-kit):**
- Drag handle: `GripVertical` (⠿), 14px textFaint, csak hover-re látható
- Dragging state: `opacity-70 scale-[1.02] shadow-hover rotate-0.5deg cursor-grabbing`
- Drop zone highlight: `border-2 border-dashed border-accent bg-accentMuted`
- Snap animáció: spring config (stiffness: 500, damping: 40)

**Hover state:**
- Kártyák: `shadow-hover border-borderStrong` + `y:-2 duration:0.12s`
- Gombok: `bg-surfaceMuted` vagy `bg-accentMuted text-accent`
- Nav elemek: `bg-surfaceMuted text-text`
- Codex entry: `bg-surfaceMuted`

**Focus ring (`focus-visible` only — soha nyers `:focus`, hogy egér-kattintásra ne villogjon):**
- `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-background` — minden interaktív elemen
- Input focus: `focus-visible:border-accent focus-visible:ring-[3px] focus-visible:ring-accent/12`
- Outline-t soha nem távolítunk el ≥3:1 helyettesítés nélkül

**Keyboard navigáció:**
- Slash command: `↑↓` navigál, `Enter` választ, `Escape` zár
- Modal: `Escape` zárás, `Tab` focus trap
- Plan board: `Space` vagy `Enter` jelenet megnyitáshoz

**Loading states:**
- Skeleton: `bg-surfaceMuted animate-pulse rounded-md` (azonos alakú mint a tartalom)
- AI generálás: `Loader2 spin` + animated progress bar
- Oldal betöltés: route változásra top progress bar (accent szín, 2px)

**Toast notifikációk:**
- Jobb alsó sarok, `x:100%→0 opacity:0→1 duration:0.22s`
- Auto-elhalvány 3s után, `opacity:1→0 duration:0.3s`
- Típusok: success (CheckCircle2) | warning (AlertTriangle) | error (XCircle) | info (Info)

**Inline editing:**
- Mezők helyszínen szerkeszthetők: kattintásra `border-accent` + input aktív
- Enter vagy click-away → mentés (autosave, nem explicit "Mentés" gomb)
- Escape → visszavonás

---

## 10. ForgeWriter-specifikus adaptációk

### Átvesszük NovelCrafter-ből

- Act / Chapter / Scene hierarchia + grid Plan Board layout
- POV badge pill per karakter (egyedi szín sorozat)
- Codex sidebar tab (Codex / Snippets / Chat) + könyvborító thumbnail
- Karakter detail tabs (Részletek / Kutatás / Kapcsolatok / Megemlítések / Nyomon követés)
- Slash `/` command menü (AI + Codex + Formázás szekciókkal)
- Scene beat kártya (szószám picker + Apply / Retry / Discard toolbar)
- Revision history kétpaneles layout + timestamp lista
- Context menu AI szekció + model picker submenu
- "Include in AI Context" toggle Codex entryn
- Chat @mention: Codex nevek dashed box-ban

### Átvesszük Sudowrite-ból

- 6 érzéki csatorna (Látás / Hang / Tapintás / Szag / Íz / Metafora)
- Thesaurus szó-felhő (kattintható szavak, font-size variáció)
- Write / Describe / Rewrite toolbar gombok (pill formában)
- Floating bubble menu szöveg kijelöléskor
- Generált eredmény kártyák Insert / Copy / Star gombokkal

### Módosítjuk ForgeWriter identitáshoz

| Eredeti | ForgeWriter adaptáció |
|---|---|
| Sudowrite gradiens toolbar | `bg-surface border-b` — nincs gradiens |
| NovelCrafter #1a1a1a aktív pill | `bg-accent-strong text-white` (#5b4de0 — AA-biztos) |
| NovelCrafter teal "New Entry" gomb | Accent primary (`bg-accent text-white`) |
| Sudowrite pink/purple gradient AI highlight | `bg-aiMuted` (#f0e9ff) egyszínű |
| "Include in AI Context" toggle | `Eye-slash` ikon + "Rejtett az AI-tól" |
| Modell választó (implicit) | Explicit `Cpu` badge: lokális vs `Cloud` felhő |
| Angol UI feliratok | Minden label **Magyar** |

### Magyar-specifikus UX

- Összes UI felirat Magyar (nem fordítás, hanem natív megfogalmazás)
- Szótag-helyes sorvégek (CSS hyphens: auto, lang="hu")
- POV megnevezések: "1. személy" / "3. személy (Korlátozott)" / "3. személy (Mindentudó)"
- Tense picker: "Múlt idő" / "Jelen idő" (default: múlt)
- Describe csatornák: Látás / Hang / Tapintás / Szag / Íz / Metafora
- Exportálandó fájlnév: ékezetmentesítve (á→a, é→e stb.) + underscore szóközök
- AI prompt wrapper: mindig Magyar instrukció a system promptban

---

## 11. Kerülendők

**Vizuálisan:**
- Gradiens háttér az editorban vagy toolbar-on
- Több mint 2 erős szín egy kártyán
- Harsány kanban esztétika (Trello-stílus)
- Teli fill background nav elemeken (csak aktív állapotban)
- Flashy hero szekció, landing page stílus
- Emoji a UI-ban (kivéve ha a user teszi be a tartalmába)
- Overly rounded ("buborék") design

**Funkcionálisan:**
- AI szöveg automatikus beillesztése jóváhagyás nélkül
- Modell/verzió elrejtése
- "Generáló" loaderrel letakarni a régi tartalmat
- Mentés gomb (autosave van)
- Felugró confirm dialog törléshez (undo lesz helyette)
- Több mint 2 egyidejű modal/overlay

**AI-specifikusan:**
- Prompt hardcoding route handler-ben
- Nincs modell megjelenítve az eredmény kártyán
- Közvetlen overwrite korábbi tartalom előtt
- "Trusted AI" mód — minden generáláshoz jóváhagyás kell

**Magyar szövegnél:**
- Szó-szerinti angol-struktúrájú mondat fordítás
- Tegezés/magázás keverés (default: tegezés)
- Rövid szótagolt szavak erőltetett sorvégei (CSS hyphens kezelés)

---

## 12. Rövid verzió (10 sor)

```
POV: a calm, focused writer's cockpit for Hungarian long-form fiction — restraint over flash; NOT a chatbot, NOT Notion, NOT a NovelCrafter clone.

Design ForgeWriter AI — a calm Hungarian-first AI novel writing workspace.

Three-pane layout: LeftSidebar 260px (nav + book tree) + MainWorkspace (Plan Board / Editor / Codex DB) + RightInspector 360px (AI / Codex / Beats / Warnings).

Colors (semantic CSS vars in globals.css): bg #f8f6f2 (warm off-white), surface #ffffff, accent #6d5dfc (user actions, fills/borders — never as text; accent-text #342a91 for accent text), ai #7c3aed (the single AI signal), text #2f2a24. Font: Inter UI + Literata serif for manuscript (max-w-65ch measure).

Plan Board: Act/Chapter/Scene grid with dnd-kit drag. SceneCards: white, rounded-xl, subtle shadow, tokenized POV badge (--pov-1..6 per character, no raw Tailwind hues), summary textarea, status badge (color + icon).

Write View: max-width 820px centered Literata editor, floating selection bubble menu (Rewrite/Describe/Expand/Visualize), AI panel with action buttons + result card (accept/reject).

Describe panel: 6 sensory channels (Látás/Hang/Tapintás/Szag/Íz/Metafora), each expands to 2 AI-generated alternatives with "Save to Snippet" option.

Codex Sidebar: book cover thumbnail, search, New Entry dropdown (Character/Location/Object/Lore/Subplot). Character detail: aliases, portrait, tabs (Details/Relations/Mentions/Tracking).

AI results: always show model name + prompt version. Human-in-the-loop approval required. Never auto-insert text. All labels in Hungarian.

Animations: Framer Motion, transform/opacity only, panel slide-in x:20→0 0.18s, AI card y:12→0 0.22s (signature moment), stagger card lists 0.06s. No bounce, no gradients, no >0.4s panel opens, no animating height/width.

Accessibility: all text ≥4.5:1 contrast (text-faint is decorative only), focus-visible rings on every control, aria-label on icon buttons, AlertDialog for cascading deletes, honor prefers-reduced-motion. Tokens are semantic CSS variables (dark theme later via .dark swap). The single AI-violet is the only AI signal.

Feel: focused writing cockpit. Not a chatbot. Not Notion. Not NovelCrafter.
```
