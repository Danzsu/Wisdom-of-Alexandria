# Alexandria UI — Implementációs terv

> **Ágenseknek:** A tervet a `superpowers:subagent-driven-development` skillel hajtjuk végre, mérföldkövenként. A lépések checkbox (`- [ ]`) szintaxisúak.

**Cél:** A Claude Designban elkészített „Alexandria" (Wisdom of Alexandria) prototípus (`wisdom-of-alexandria-ui-ux/project/Alexandria App.dc.html`, 15 fő képernyő + 15 overlay) pixel-pontos újraépítése az `apps/web` Next.js frontendben, a backendhez (`apps/api`) kötve, MVP-first sorrendben.

**Architektúra:** Next.js 15 App Router perzisztens AppShell layouttal (TopBar + kontextus-függő bal sidebar + opcionális jobb AI inspector + StatusBar); a prototípus `state.view` kapcsolgatását valódi route-ok váltják. Kliens UI-állapot Zustand slice-okban, szerver-adat TanStack Query-vel, űrlapok RHF+Zod, szerkesztő Tiptap.

**Tech stack:** Next.js 15, React, TypeScript (strict), Tailwind CSS 4, shadcn/ui (Radix), Framer Motion 11, Tiptap 2, Lucide React, Zustand 5, TanStack Query 5, RHF+Zod, dnd-kit, next-themes.

---

## Forrás-igazság és kulcsdöntések

1. **Vizuális igazságforrás a prototípus**, NEM a `design/DESIGN.md`. A `DESIGN.md` lila „ForgeWriter" témája felülíródik a prototípus **arany/pergamen „Alexandria"** témájával. A `DESIGN.md` csak *strukturális* szabályokra marad mérvadó (3-paneles cockpit, akadálymentesség, human-in-the-loop, token-fegyelem, „státusz soha nem csak szín").
2. **Terméknév a UI-ban: „Alexandria"** (a „ForgeWriter" csak munkacím volt).
3. **Accent = ARANY (#b8862b), AI = KÉK (#1e5fa8)** — nem lila/ibolya.
4. **POV token-szuffix `-tx`** (nem `-text`) — a prototípus 700+ helyen ezt használja; a 4 POV-t 6-ra bővítjük (slate, orange).
5. **Téma: `data-woa` attribútum a `<html>`-en** (nem `.dark` class). Tailwind 4 `@custom-variant dark (&:where([data-woa=dark],[data-woa=dark] *))`; `next-themes` `attribute="data-woa"`. A dark paletta MOST teljes (nem „később").
6. **Navigáció: valódi Next.js route-ok** magyar slugokkal; a 15 overlay kliens-állapot Radix Dialog (Zustand flag), csak a deep-linkelhető felületek (codex entry, diff, jelenet) intercepting route.
7. **Drag & drop: dnd-kit** (a prototípus natív HTML5 DnD-jét nem portoljuk).
8. **Modellnevek a `ModelRouter` configból** — soha nincs hardcode-olt modellnév a UI-ban.
9. **Magyar microcopy szó szerint** a prototípusból egy központi `hu` locale modulba — soha nincs kitalált fordítás.
10. **A prototípus `support.js` runtime-ját NEM portoljuk** — a `{{ }}` bindingok, `sc-if`, `data-on`, `style-hover` szemantikáját idiomatikus Reactre fordítjuk (props/derived selectorok, cva variánsok, Tailwind `hover:`/`focus-visible:`).

---

## Token-rendszer (kanonikus — `apps/web/app/globals.css`)

```css
:root {
  --bg:#f6f1e6; --bg-subtle:#efe7d6; --surface:#fffdf7; --surface-soft:#fbf6ec; --surface-muted:#f1ead9;
  --border:#ded2b8; --border-strong:#c6b48d;
  --text:#2d2618; --text-soft:#4c4332; --text-muted:#6e6450; --text-faint:#a3977c;
  --accent:#b8862b; --accent-strong:#8a5f14; --accent-hover:#76510f; --accent-muted:#f3e7c6; --accent-text:#6b4a0a; --accent-fg:#fffdf7;
  --ai:#1e5fa8; --ai-muted:#e2ecf7; --ai-text:#1a4c86;
  --success:#2f7d55; --success-muted:#e4f1ea; --success-text:#256544; --success-fg:#ffffff;
  --warning:#b7791f; --warning-muted:#fdf2d8; --warning-text:#8a5a13;
  --danger:#c2410c; --danger-muted:#fcefe6; --danger-text:#9a3412;
  --pov1-bg:#fdf0d5; --pov1-tx:#8a5a13; --pov2-bg:#fbe4e9; --pov2-tx:#9d2f4d;
  --pov3-bg:#e3f0e8; --pov3-tx:#256544; --pov4-bg:#e1edf6; --pov4-tx:#235d86;
  --pov5-bg:#eceaf0; --pov5-tx:#4c4a59; --pov6-bg:#fdeadf; --pov6-tx:#9a3412;
  --shadow-card:0 1px 2px rgba(45,38,24,.06); --shadow-panel:0 2px 10px rgba(45,38,24,.08); --shadow-popover:0 8px 24px rgba(45,38,24,.14);
  --topbar-h:52px; --statusbar-h:32px; --rail-w:56px; --tree-w:232px; --codex-sidebar-w:300px; --inspector-w:360px; --timeline-rail-w:54px; --chapter-col-w:280px;
}
[data-woa=dark] {
  --bg:#1b1712; --bg-subtle:#15120d; --surface:#252019; --surface-soft:#211c15; --surface-muted:#2e2820;
  --border:#43392a; --border-strong:#5b4d36;
  --text:#f0e8d6; --text-soft:#d8cdb4; --text-muted:#b5a98b; --text-faint:#857a61;
  --accent:#d9a84e; --accent-strong:#d9a84e; --accent-hover:#e6ba66; --accent-muted:#3a2f17; --accent-text:#e9c87e; --accent-fg:#241a06;
  --ai:#6ea8e8; --ai-muted:#1c2a3d; --ai-text:#9dc3ef;
  --success:#5fb286; --success-muted:#15281e; --success-text:#7ec79e; --success-fg:#0d1f15;
  --warning:#d9a441; --warning-muted:#2a2110; --warning-text:#e6b860;
  --danger:#e07a4f; --danger-muted:#2a160d; --danger-text:#f0a07f;
  --pov1-bg:#3a2c10; --pov1-tx:#e6b860; --pov2-bg:#3a1b24; --pov2-tx:#f0a0b8;
  --pov3-bg:#16291f; --pov3-tx:#7ec79e; --pov4-bg:#16283a; --pov4-tx:#9dc3ef;
  --pov5-bg:#26242c; --pov5-tx:#c5c2cf; --pov6-bg:#2e1a10; --pov6-tx:#f0a07f;
  --shadow-card:0 1px 2px rgba(0,0,0,.3); --shadow-panel:0 2px 10px rgba(0,0,0,.35); --shadow-popover:0 8px 24px rgba(0,0,0,.5);
}
```

**Fontok (next/font/google):** UI = `Source Sans 3` (400/500/600/700); manuscript/serif = `Literata` (ital, opsz, 400–700); mono = `ui-monospace`.

**Hardcode-olt gradiensek (nem token):** könyv-gerinc arany `linear-gradient(150deg,var(--accent) 0%,#b8893f 55%,#8a6a2e 100%)`; kék-szürke alt `linear-gradient(150deg,#5b7a8c,#42606f 60%,#2f4855)`; chart bar `linear-gradient(180deg,var(--accent),#b8893f)`; modal scrim `rgba(24,18,9,.45)` (delete .5, thesaurus .4); generate CTA glow `0 2px 14px rgba(184,134,43,.35)`.

**Keyframe-ek (globals.css):** woaReveal, woaToastIn, woaViewIn, woaFade, woaToastPop, woaSpin, woaProgress, woaTwinkle, woaFloat, woaFlash, woaStagger, woaSweep, woaShimmer, woaSpark, woaGrow, woaRailPop, woaGlow. `prefers-reduced-motion` tisztelve + sparkfield kikapcsolva.

---

## Képernyő-inventár (prioritással)

**MVP:** AppShell (TopBar/sidebar/StatusBar) · Write View (hero) · AI Inspector + AI flow · Plan Board · Codex sidebar + Karakter Detail · Projektek dashboard · New-book Wizard · Export (Markdown) · Beállítások (Local/Ollama) · alap modalok (Delete, Toast, Sparkfield, Pin).

**V1:** Chat/Thread · Diff modal · Verzióelőzmények · Áttekintés (continuity + statok) · Idősor · Kapcsolatok (React Flow) · Cselekményszálak · AI feladatok (RQ polling) · Prompt Library + szerkesztő · Archívum · Codex Relations/Progresszió/Kutatás tabok · Outline import · Cloud providerek.

**V2 (vizuális stub):** Hangkönyvtár + hang-szövegrészhez + EPUB-3 media overlay · képbeszúrás pipeline · kollaboráció/Megosztás · MCP · NSFW/reasoning · daily-spark/analytics.

---

## Megosztott komponens-kit (Milestone 1 — előbb épül, mint a képernyők)

BrandStar, Icon (Lucide wrapper), IconButton, Button (cta/secondary/ghost/success/destructive/accent-outline/dashed), PillButton/FilterChip, SegmentedControl, Tab/TabBar, Card (+ hover-lift/selected/left-status-border/cover-top), Badge/StatusPill, StatusDot, Avatar (+ stack/graph/presence), PopoverMenu/MenuRow, SplitButtonDropdown, SectionEyebrow, FormInput/Textarea/Password, ToggleSwitch, Checkbox/RadioRow, RangeSlider, DashedTile/Dropzone, QuoteBlock, ProgressBar (det+indet), Spinner, Skeleton, ModalShell/Header/Close, Toast (Sonner), VariableTokenChip, BookSpineCard/CoverThumbnail, BarChart/Sparkline, AIResultCard, ContextChips, ModelSelector, CodexMention(+popover), SelectionBubbleMenu, AudioMark(stub), TimelineNode/Marker/Spine, DiffPane.

---

## Backend-gapek és stub-stratégia

- **Képbeszúrás** (kézirat/Codex/portré/borító): Tiptap image-placeholder node-view, csak lokális objectURL + alt/caption/layout a doc JSON-ban (nincs feltöltés); klikk → toast „Kép helye — a feltöltés a V2-ben érkezik". Adatforma megőrizve a későbbi media-table + EPUB-embedhez.
- **Hang szövegrészhez (EPUB)** — *a legnagyobb halasztott domain*: Hangkönyvtár + ♪ mark + „Hang csatolása" modal teljesen vizuális, hardcode demo trackekkel; play/upload/attach → toast „(prototípus)". A ♪ mark a doc JSON-ba `{audioId, scope, type}` formában mentődik a jövőbeli EPUB-3 media-overlay (SMIL) exporthoz. **V2 feature-flag mögött, MVP/V1 exportból kizárva.** Saját adat-modell+csomagolási spec kell hozzá.
- **Táblázat:** Tiptap Table extension (valódi), de a Markdown export GFM pipe-táblát kell szerializáljon — ha nem megy, V1-ig flag + toast.
- **Kollaboráció / Megosztás / komment:** CLAUDE.md szerint MVP+V1-en kívül (single-user JWT). Statikus vizuál + „Hamarosan" toast, collab feature-flag (alap: ki).
- **RAG/continuity/jobs-függő AI** (Kutatás Q&A, Áttekintés warnings, AI feladatok élő sor, Progresszió, AI alias-javaslat, auto-extract): MVP-scope-os AI (rewrite/describe/scene-gen/summary) valódi ModelRouter endpointra kötve; a többi mock + „Generálás" 501 → toast, vagy flag.
- **MCP / NSFW / reasoning / model-packs / LM Studio / Ollama model-letöltés / health-check / JSON backup / szerver-oldali téma-perzisztencia:** Settings MVP = csak Ollama Local + Temperature/MaxTokens (valódi) + health-check toast-stub; Cloud (Gemini/OpenRouter) V1; a többi V2 vizuális stub.
- **Tezaurusz / Vizualizáció / daily-spark / streak-analytics / outline-sablonok / import:** stub vagy mock; outline-import kliens-oldali markdown parser (megvalósítható); import V1+ (előbb DOCX Pandoc-kal); fájlnév ASCII-folding = kis szerver-oldali transzliterációs util (MVP exporthoz kész).
- **Sorozat-scope Codex:** MVP-ben csak könyv-scope; a „Sorozat" tab empty-state + disabled (V1).

---

## Mappa-struktúra (`apps/web`)

```
app/(app)/…                  route-ok + layoutok (AppShell)
components/kit/               megosztott primitívek
components/shell/             TopBar, IconRail, ChapterTree, CodexSidebar, AIInspector, StatusBar, Sparkfield
components/editor/            Tiptap setup + extensionök (CodexMention, AudioMark[stub], ImagePlaceholder[stub], SelectionBubble, BeatCard)
components/screens/           képernyőnként egy mappa
lib/                          api kliens, zustand store-ok, utils, povColor hash, slugify, theme
styles/globals.css           token-réteg
packages/shared/src/         zod sémák + TS típusok + enumok (SceneStatus, CodexType, JobState…)
```

---

## Mérföldkövek

- **M0 — Alapozás:** `apps/web` scaffold (Next.js 15 App Router, TS strict, Tailwind 4, pnpm/turbo wiring). `globals.css` token-réteg (teljes light+dark + woa* keyframe-ek + data-woa dark variant + focus-visible/reduced-motion). Tokenek `@theme`-be. Literata + Source Sans 3 next/font. shadcn/ui, Framer Motion, lucide-react, Zustand, TanStack Query, RHF+Zod, dnd-kit, Tiptap telepítés. next-themes(data-woa) + ThemeToggle. **Acceptance:** üres témázott oldal vált light/dark között a helyes palettával és fontokkal.
- **M1 — Megosztott kit:** a fenti primitívek izoláltan (kitchen-sink route), mindegyik a `style-hover`/`style-focus` → valódi variant és `data-on` → `data-state` CSS konverzióval. **Acceptance:** kitchen-sink minden primitívet pixel-pontosan renderel light+dark.
- **M2 — AppShell + navigáció:** (app) layout TopBar/IconRail+Tools flyout/StatusBar/Sparkfield/Toaster; route-ok magyar slugokkal; useUIStore (view→sidebar, single-open menü, overlay flagek); navTo→router+sparkfield; command palette. **Acceptance:** minden top-level route navigál, route-onként a helyes sidebar, téma+menük+toast+command palette működik.
- **M3 — Projektek + New-book Wizard:** dashboard + 3-lépéses wizard (RHF+Zod) → könyv létrehozás (valódi CRUD). **Acceptance:** wizardból projekt létrejön, Plan-re visz.
- **M4 — Write View (hero):** chapter-tree, AI toolbar (split-buttonök+menük), Tiptap kézirat token-vezérelt stílussal, CodexMention+popover, SelectionBubbleMenu, StatusBar szószám+autosave, story-timeline rail, Format menü live-binding, Fókusz + Tiszta írás mód. Image/table/audiomark node-view STUB. **Acceptance:** írás, autosave, kijelölés→bubble menü, format menü stílust vált, chapter-tree navigál.
- **M5 — AI Inspector + AI flow (human-in-the-loop):** InspectorTabBar, AI action grid + custom instruction + ModelSelector, Generálás→GeneratingCard→AIResultCard (kontextus-chipek+verzió+Elfogad/Elvet) → Revision POST + suggestion-beszúrás (woaFlash). Describe 6-csatorna accordion (MVP) + Snippet-mentés. Inline BeatCard state machine. Valódi ModelRouter/LiteLLM→Ollama rewrite/describe/scene-gen/summary. **Acceptance:** kijelölés→Átírás→eredmény-kártya modellel+kontextussal→Elfogad revíziót ment és beszúr; Describe 6 csatornát ad, Snippetbe csillagozható.
- **M6 — Codex (sidebar + Karakter Detail):** sidebar (könyv-fejléc, tabok, keresés, Új→modal, scope toggle, csoportosított entryk) + Karakter Detail (Részletek/Megemlítések/Nyomon követés: ai_visible + aliasok). New-Codex modal két lépés. Valódi Codex CRUD. **Acceptance:** karakter létrehoz/szerkeszt, aliasok+ai_visible perzisztál, megemlítések tükrözik a kéziratot.
- **M7 — Plan Board + DnD:** Rács (dnd-kit chapter+scene drag, optimista moveScene/moveChapter+toast)/Mátrix/Vázlat, density módok, scene kebab, status pillek. **Acceptance:** jelenet áthúzása fejezetek közt perzisztál, mindhárom nézet ugyanazt az adatot mutatja.
- **M8 — Export (MVP) + Beállítások (MVP):** Export (Markdown valódi; DOCX V1; EPUB/PDF/TXT vizuál + audio V2-stub) slugify-jal; Settings hub + Local(Ollama) + Temperature/MaxTokens. **Acceptance:** könyv Markdown-export ASCII-folded fájlnévvel; temperature állítható.
- **M9 — Modalok/overlay + MVP polish:** Delete confirm (AlertDialog), Toast-variánsok, Sparkfield, Pin panel; reduced-motion + a11y pass (aria-label, focus-visible, AlertDialog destruktívhoz). **Acceptance:** teljes MVP flow end-to-end + tiszta a11y audit.
- **M10 — V1 képernyők:** Chat, Diff, Verzióelőzmények, Áttekintés, Idősor, Kapcsolatok (React Flow), Cselekményszálak, AI feladatok (RQ), Prompt Library+szerkesztő, Archívum, Codex Relations/Progresszió/Kutatás, Outline import, Cloud providerek — feature-flag mögött, ahogy a backend (RAG, continuity, jobs) elkészül.
- **M11 — V2 stub→valódi:** Hangkönyvtár + hang-szövegrészhez + EPUB-3 media overlay, képbeszúrás pipeline, kollaboráció/Megosztás, MCP, NSFW/reasoning, daily-spark/analytics — mindhez előbb saját adat-modell+endpoint spec.

---

## Tesztelés (FTDD)

- Vitest + Testing Library + MSW a kit/komponensekhez.
- Playwright E2E a Write flow-ra (kijelölés→átírás→elfogad→revízió).
- Backend: pytest a CRUD + AI workflow input/output kontraktusokra (CLAUDE.md).

### KÖTELEZŐ per-mérföldkő záró kapu (minden M0–M11 végén)

Egy mérföldkő CSAK akkor „kész", ha mindkét kör lefutott és tiszta:

1. **Teszt-kör** — a mérföldkő által termelt kódra tesztek íródnak ÉS lefutnak (zöld). Frontend: Vitest/Testing Library (+ Playwright a flow-kra); backend: pytest. A teszt-suite nem maradhat piros.
2. **Validáló-kör** — aktív keresés és kiirtás: **silent error, üres `try/catch`, elnyelt/no-op hibakezelés** (csak logoló catch), kezeletlen promise-rejection, `any` szivárgás, halott hibaág. Plusz `lint` + `type-check` tisztán fut. Üres/elnyelő catch tilos — minden catch vagy érdemben kezel, vagy továbbdob.

A subagent-driven végrehajtásban ez a per-task review-kapu RÉSZE: az implementer-ágens csak akkor jelenthet DONE-t, ha mindkét kör zöld; a code-quality review-ágens kifejezetten ellenőrzi a silent-error/üres-catch hiányát.

---

## Fő kockázatok (a teljes lista a review-ban)

1. **Token-mismatch** (lila DESIGN.md vs arany prototípus) — a `globals.css` a prototípus pontos hexeit kódolja; DESIGN.md csak strukturális.
2. **`style-hover` (482×) + `data-on` (~13 token)** a legnagyobb mechanikus konverzió — a kit ELŐBB épül, ott nyeli el az összeset.
3. **Szerkesztő** a legnehezebb egyetlen darab — saját mérföldkő (M4), FTDD.
4. **Async fake (setTimeout) + hardcode adat** — MVP-AI valódi endpointra, a többi mock + stub-badge; V1 képernyők feature-flag.
5. **Hang-szövegrészhez (EPUB)** scope-creep veszély — kemény V2-gate, csak vizuális stub.
6. **Plan Board DnD** újraírás (dnd-kit) — MVP-ben mehet statikus Rács + lista, teljes DnD V1.
