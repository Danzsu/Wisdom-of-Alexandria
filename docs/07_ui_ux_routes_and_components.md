# 07 — UI/UX: képernyők, route-ok és komponens-leltár

## Cél

Ez a dokumentum a **Wisdom of Alexandria** webfelület (`apps/web`, Next.js 15 App Router) **jelenlegi, megvalósult** UI-szerkezetét írja le: az app-shell, a route → képernyő → komponens leképezés, a megosztott komponens-kit és a minden adatnézetre kötelező state-minták.

> **Forrásdokumentumok.** A vizuális design-forrás (DESIGN-A / DESIGN-B / DESIGN-C tervek + a re-skin specifikációja) a **design-doc (doc 18)**. A token- és tipográfia-rendszer (színek, térköz, sugár, fontok, kontraszt-szabályok) a **`docs/09` design system**. Ez a fájl a *struktúrát és az inventárt* írja le, nem a tokeneket.

A felület továbbra is NovelCrafter-szerű munkafolyamatokból inspirálódik, de **nem másol** márkajelet, színpalettát, logót, proprietary ikont vagy pixelpontos elrendezést. A termék-mintát használjuk, nem a termék-identitást.

---

## App-shell

A shell-t egyszer rendereli az `(app)` layout (`apps/web/components/shell/app-shell.tsx`). Az aktuális chrome **tisztán a pathnameből** vezetődik le (`useShellChrome`): a rail könyvön belül látszik, a fejezet-fa a Írás nézeten, a Codex-oldalsáv a Codexen; a projektválasztón a rail és az oldalsávok rejtve vannak. A StatusBar + AI-inspektor csak az Írás route-on jelenik meg.

```txt
┌──────────────────────────────────────────────────────────────────────────┐
│ TopBar (52px): ✦ "Wisdom of Alexandria" wordmark · / · könyv-kontextus ·  │
│        [Írás: jelenet-breadcrumb] · AI-job-pulzus · modell-pill · Megosztás│
│        · keresés (⌘K) · "Hogyan működik?" · téma-kapcsoló · beállítás · user│
├──────┬───────────────────────────────────────────────────┬────────────────┤
│ Icon │ Bal struktúra-pane                                │ Jobb inspektor  │
│ rail │ (Írás: fejezet-fa · Codex: Codex-oldalsáv)        │ (Írás, 360px):  │
│ 56px │                                                   │ Codex / AI /    │
│      │ MainWorkspace (route-gyerek a <main>-ben)         │ Beat / Revíziók │
│      │                                                   │ / Warnings      │
├──────┴───────────────────────────────────────────────────┴────────────────┤
│ StatusBar (32px, csak Írás): szószám · fej./jelenet · autosave · modell    │
└──────────────────────────────────────────────────────────────────────────┘
```

### Shell-elemek

- **TopBar** (`top-bar.tsx`, 52px) — bal oldalon a **márkajel**: a „Wisdom of Alexandria" wordmark **Caveat** (kézírásos, arany `--gold-text`) fontban, mellette egy **arany-gradiens (`--gold` → `--gold-deep`) lekerekített csempe fehér 5-ágú csillaggal**; a márkajel a projektválasztóra navigál. Könyvön belül `/` elválasztó + **ProjectSwitcher** (könyv-kontextus). Az Írás route-on középen a **jelenet-breadcrumd** (fejezet › jelenet). Jobb klaszter: persistent **AI-job-indikátor** (futó pulzus / hibaszám / üresjáratban rejtve), config-vezérelt **modell-pill**, **Megosztás** pill (stub → toast), **keresés** (parancspalettát nyit), **„Hogyan működik?"** súgógomb (scroll-narratíva modal), **téma-kapcsoló**, **beállítás** gomb, **UserMenu**. `<lg` alatt itt jelennek meg a fa-/inspektor-drawer kapcsolók.
- **IconRail** (`icon-rail.tsx`, 56px) — elsődleges célok rail-sorrendben: **Terv · Írás · Codex · Chat · Tiszta írás** [térköz] **Tools-flyout · Export · Beállítások**. Az Írás cél a betöltött könyv-fából feloldja az *első valódi jelenetet* (ha nincs, a Terv nézetre esik vissza). A **Tiszta írás** AI-mentes írásmódot kapcsol be, majd megnyitja a kéziratot. A **Tools-flyout** (`PopoverMenu`) tartja a V1-elemzőképernyőket (Áttekintés, Idősor, Kapcsolatok, Cselekményszálak), az AI-feladatokat (valódi „elbukott job" attention-dot + badge), és a prompt-/hang-tárakat. Az aktív elemnek `aria-current="page"` + accent-muted highlight + `woaRailPop` ikon-pop.
- **ChapterTree** (`chapter-tree.tsx`) — bal struktúra-pane az Írás nézeten (fejezetek → jelenetek).
- **CodexSidebar** (`codex-sidebar.tsx`) — bal struktúra-pane a Codexen.
- **InspectorPanel** (`components/inspector/`) — jobb oldali, 360px-es inspektor (csak Írás); tabok: **Codex · AI · Beat · Revíziók · Warnings**. Egy `AiGenerationProvider` átfogja a kézirat-`<main>`-t és az inspektort, így a generálás → elfogadás → beszúrás folyam egy állapotot oszt.
- **StatusBar** (`status-bar.tsx`, 32px, csak Írás) — élő szószám (tabular-nums), fej./jelenet-lokáció a fából, autosave-állapot (`Mentés…` / `Mentve ✓` / hiba, `aria-live` régióban), config-vezérelt aktív modell-badge.
- **CommandPalette** (`command-palette.tsx` + `…-hotkey.tsx`) — ⌘K/Ctrl-K parancspaletta.
- **ShortcutsOverlay** (`shortcuts-overlay.tsx`) — billentyű-overlay.
- **Sparkfield** (`sparkfield.tsx`) — finom navigációs szikra-effekt.
- **ShellDrawer** (`shell-drawer.tsx`) — `<lg` alatt a bal struktúra-pane és az inspektor slide-in Radix Dialog drawerbe csúszik (focus-trap, Esc/scrim-zár, címkézett). A rail inline marad (már 56px). **Fókusz mód** (Írás): minden chrome eltűnik, csak a kézirat marad; Esc kilép.

---

## Képernyők / route-ok

A route-ok az `(app)` szegmens alatt élnek. A könyv-scope-os route-ok mind `/konyv/[bookId]/<szegmens>` formájúak; a `routes` helper (`lib/routes.ts`) generálja őket.

| Route | Képernyő / belépő | Komponens | Cél | Polish-állapot |
|---|---|---|---|---|
| `/` | Landing (marketing) | `app/page.tsx` | Publikus marketing-landing: hero + features + filozófia-sáv + showcase + footer CTA (app-on kívüli, net-új route) | **KÉSZ** (DESIGN-C) |
| `/profil` | Profil | `components/profile/ProfileScreen` | Dedikált felhasználói profil-képernyő; a `/me` végpontot + a `scene_count`-ot köti be; a user-menü „Profil" sora ide navigál | **KÉSZ** (DESIGN-C) |
| `/projekt` | Projektek dashboard | `components/projects/ProjectsDashboard` | Könyvespolc / projektválasztó + új-könyv wizard, TanStack Query-vel | **KÉSZ** — Cormorant (`font-display`) hero, arany eyebrow + lebegő könyv-gerinc ikon, Daily-Spark kártya |
| `/konyv/[bookId]/terv` | Terv-board | route → terv-screen | NovelCrafter-szerű fejezet/jelenet tervezőfelület, status-pillek, beat-előnézet, drag; **fejezet-generálás-trigger** (`GenerateChapterDialog`) indít AI fejezet-jobot | **KÉSZ** |
| `/konyv/[bookId]/iras/[sceneId]` | Írás nézet | route → Tiptap editor + inspektor | Fókuszált kézirat-szerkesztés, autosave, AI-bubble, jelenet-fa, jobb inspektor | **KÉSZ** |
| `/konyv/[bookId]/codex` | Codex | route → Codex-screen + `CodexSidebar` | Story Bible: karakter/helyszín/worldbuilding, keresés, kártya/tábla/detail, **„Képek" panel** | **KÉSZ** |
| `/konyv/[bookId]/kapcsolatok` | Kapcsolatok | relations-graph | Karakter-kapcsolat gráf — egyedi SVG force-graph (determinista d3-force, GSAP él-rajz) | **KÉSZ** |
| `/konyv/[bookId]/cselekmenyszalak` | Cselekményszálak | plotlines-screen | Subplotok típus szerint csoportosítva, status-pillek, jelenet-chipek, attach/detach | **KÉSZ** |
| `/konyv/[bookId]/idosor` | Idősor | timeline-screen | Fejezet/jelenet kronológia a könyv-fából (GSAP spine-draw) | **KÉSZ** |
| `/konyv/[bookId]/feladatok` | AI feladatok | jobs-screen | Élő AI-job-képernyő (book-scope `GET /jobs` + polling, history + attention); a **fejezet-job progressz + review** itt fut le (a tervről indított fejezet-generálás állapota + emberi jóváhagyása) | **KÉSZ** |
| `/konyv/[bookId]/chat` | Kutatás (RAG) | chat-screen | Grounded RAG Q&A a Codex + kézirat felett, idézet-chipekkel | **KÉSZ** |
| `/konyv/[bookId]/export` | Export / Import | `components/export/ExportScreen` | Manuscript-export; **Markdown / DOCX / EPUB / PDF mind valódi** (letöltés), csak **TXT stub**, Import V1-stub | **MD/DOCX/EPUB/PDF KÉSZ** (TXT stub) |
| `/konyv/[bookId]/beallitasok` | Beállítások | `BookTab` + `components/settings/SettingsScreen` | 2-tabos: **Könyv** (cím/műfaj/szerző) + **AI / Szolgáltatók** (Local/Ollama, Cloud/API-kulcs hub, MCP, generálási paraméterek, RAG-index) | **KÉSZ** — provider-hub megőrizve |
| `/konyv/[bookId]/attekintes` | Áttekintés | route → áttekintés-screen | Könyv-dashboard áttekintő-nézet (a design-delta körben megépült, placeholder kitöltve) | **KÉSZ** (design-delta, `32486eb`) |
| `/konyv/[bookId]/stiluskalauz` | Stíluskalauz | route → stíluskalauz-screen | Style Guide szerkesztő, a `StyleGuide` backendhez kötve (net-új design-delta route) | **KÉSZ** (design-delta, `1056e2f`) |
| `/konyv/[bookId]/promptok` | Prompt-tár | `components/prompts/PromptLibraryScreen` | Prompt Library — **teljes CRUD** (létrehozás / szerkesztés / törlés UI), nem placeholder többé | **KÉSZ** (full CRUD) |
| `/konyv/[bookId]/hangok` | Hangkönyvtár | `ScreenPlaceholder` | Audio domain — **az egyetlen megmaradt placeholder** | **PLACEHOLDER (V2, M11)** |
| `/kitchen-sink` | Kit-galéria | `app/kitchen-sink/page.tsx` | Komponens-kit fejlesztői galéria | **dev-only** (production buildből kizárva) |

### Kiemelt panelek és overlay-ek

- **Codex „Képek" panel** (`components/codex/image-panel.tsx`) — karakter/helyszín képgenerálás (Nano Banana / Gemini image), RQ async job, kanonikus referencia-kép kijelölése (human-in-the-loop). Forrás: `CodexEntry` (entry_type + id).
- **Könyv-borító panel** (`components/book/cover-panel.tsx`) — borító-generálás (Phase 2): art-generálás + app-oldali tipográfia-kompozit.
- **GenerateChapterDialog** (`components/plan/generate-chapter-dialog.tsx`) — a terv-boardról indított fejezet-generálás dialógusa; AI fejezet-jobot indít, amelynek progressze + emberi review-ja a feladatok-képernyőn fut le (HITL).
- **Verzióelőzmények panel** (Revision History, design-delta `06633e6`) — jobbról-csúszó panel diffel + restore-ral, a Write inspektorba kötve.
- **Scene Metadata modal** (design-delta `b9461c5`) — a terv-board jelenet-kártya „Info" gombjáról nyíló jelenet-metaadat modal.
- **Codex Image Lightbox** (design-delta `d316528`) — a Codex „Képek" panel képeit teljes méretben nyitó képnagyító overlay.

---

## Komponens-kit (`apps/web/components/kit/index.ts`)

A képernyők innen importálnak primitíveket, nem nyúlnak az egyes fájlokba. Kategóriák:

### Display

`Badge` / `StatusPill` · `StatusDot` · `Avatar` · `Card` (+ accent-él) · `PageHero` / `SectionEyebrow` · `Spinner` · `Skeleton` + `SkeletonCard` / `SkeletonList` / `SkeletonTable` · `ProgressBar` · `AIResultCard` (RAG kontextus-chipekkel) · `ContextChips` · `DiffPane` (szó-szintű diff) · `QuoteBlock` · `BarChart` / `Sparkline` · `TimelineNode`/`Marker`/`Spine` · `BookSpineCard` / `CoverThumbnail` · `BrandStar` · `CelestialBackdrop` (finom égi delight-háttér, reduced-motion-safe) · `Icon`.

### Inputs / controls

`Button` (variánsok + **loading state**) · `IconButton` · `Select` (Radix) · `SegmentedControl` · `Tab` / `TabBar` · `PillButton` / `FilterChip` · `FormInput` (+ `FieldLabel`, **prefix/suffix slot**) · `Textarea` · `RadioGroup` / `RadioRow` / `TypedRadioGroup` · `CheckboxRow` / `CheckBox` / `SelectableCheckboxCard` · `ToggleSwitch` · `RangeSlider` · `PasswordInput` · `SplitButtonDropdown` · `ModelSelector` · `VariableTokenChip` · `DashedTile`.

### Struktúra / overlay

`Accordion` · `Modal` (+ shell/header/footer/body/close/title/description) · `AlertDialog` / `ConfirmDialog` · `PopoverMenu` (+ `MenuRow`/`MenuSection`/`MenuSeparator`, raw `Popover`) · `Tooltip` (+ provider/root/trigger/content) · `Toaster` / `toast` · `ErrorBoundary`.

### Patterns

`EmptyState` · `ErrorState`.

### Theme

`ThemeToggle`.

> **a11y gate.** A kit + shell `axe-core` accessibility teszt-gate alatt áll; az interaktív elemek `aria-label` / `aria-current` / `aria-live` jelölésűek, a drawerek focus-trappeltek.

---

## State-minták (kötelező minden adatnézetre)

A Phase-2 state-pattern adoptáció óta **minden adatnézet** ugyanazt a három állapotot kezeli a kit-primitívekkel:

- **Betöltés** → `SkeletonList` / `SkeletonCard` / `SkeletonTable` (a tartalom alakját tükröző skeleton, nem spinner).
- **Üres** → `EmptyState` (cím + leírás + akció).
- **Hiba** → inline `ErrorState` **retry-gombbal** (a transport-hibák magyarul lokalizáltak; az infra-hibák hangosak maradnak).

Ez egységesíti a board, Codex, Kutatás, Idősor, Kapcsolatok, Cselekményszálak, feladatok és export nézeteket.

---

## Kulcs UX-szabályok

1. Az író mindig tudja, hol van: projekt → könyv → fejezet → jelenet (breadcrumb + StatusBar lokáció).
2. Az AI mindig megmutatja, **mit használt** (RAG kontextus-chipek), **mit változtatna** (DiffPane), és **biztonságos-e elfogadni** (HITL: revízió → elfogadás/elvetés, soha nincs néma felülírás).
3. A Codex közel van az íráshoz: jobb inspektor-tab + parancspaletta-keresés + kapcsolódó bejegyzések.
4. A tervezés vizuális: jelenet-kártyák, státuszok, beatek, drag-and-drop.
5. A szerkesztés biztonságos: revíziók, elfogad/elvet, autosave-állapot.

---

## Design-rendszer hivatkozás

A színtokenek, térköz, sugár, fontok (UI: **Inter**; kézirat: **Literata**; display: **Cormorant Garamond**; kézírás/márkajel: **Caveat**), valamint a WCAG-AA kontraszt-szabályok a **`docs/09`**-ben élnek. A jelenlegi vizuális identitás a **Claude Design re-skin** (lila accent + arany márkajel) — forrás a **design-doc (doc 18)**.
