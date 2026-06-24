# 09 — Design system (Wisdom of Alexandria, élő referencia)

> **Állapot:** ez a fájl a **jelenlegi** design-rendszer autoritatív referenciája. A
> projekt re-skinelve lett a **Claude Design** purple-accent irányra — az **accent
> ma LILA** (`#6d5dfc`), nem arany. A korábbi arany / Source Sans 3 irány (lásd a
> régi dokumentum-történet) **leváltva**.
>
> Az értékek a kódból származnak: `apps/web/app/globals.css`
> (`:root` + `[data-woa=dark]` + `@theme inline`), `apps/web/lib/fonts.ts`,
> `apps/web/components/kit/index.ts`. A teljes vizuális forrás a Claude Design
> fájl, az **`Alexandria.dc.html`** (lásd `docs/18`). Ahol egy szám eltér ettől
> a fájltól, a kód az igazság.

---

## a) Brand

A termék neve **Wisdom of Alexandria** (munkanév: ForgeWriter AI). A wordmark a
shellben **Caveat** (kézírás-betű) **aranyban** szedve, mellette egy arany csillag
(`BrandStar`). A hangulat: **nyugodt, irodalmi, strukturált, meleg** — egy csendes
íróműhely erős szervezőeszközökkel, nem általános chatbot.

Vizuális kulcsszavak: `calm` · `structured` · `warm` · `literary` · `focused` ·
`dense` · `soft` · `editorial` · `professional`.

A lila a **funkcionális accent** (gombok, fókuszgyűrű, aktív állapot, AI-jelölés
közeli). Az arany a **másodlagos, szerkesztői accent** (wordmark, eyebrow-k,
daily-spark, kézirat-dekoráció) — lásd a `--gold*` token-szettet lent.

---

## b) Színtokenek

A tokenek CSS custom property-ként élnek a `:root`-on (light) és a
`[data-woa="dark"]`-on (dark), és `@theme inline`-on át lesznek Tailwind
`--color-*` utility-kké kötve, így minden utility live, téma-tudatos var-ra oldódik
fel. A dark variánst a `@custom-variant dark (&:where([data-woa=dark], …))` köti a
`data-woa` attribútumhoz (nem `.dark` osztály).

> **POV token-konvenció:** a POV-pár szöveg-szuffixe `-tx` (NEM `-text`):
> `--pov1-bg` / `--pov1-tx` … `--pov6`.

### Bg / surface / border skála

| Token | Light | Dark |
|---|---|---|
| `--bg` | `#f8f6f2` | `#17150f` |
| `--bg-subtle` | `#f3f0ea` | `#120f0a` |
| `--surface` | `#ffffff` | `#211d16` |
| `--surface-soft` | `#fbfaf7` | `#1b1812` |
| `--surface-muted` | `#f1eee8` | `#2a261e` |
| `--border` | `#ded8ce` | `#3b342a` |
| `--border-strong` | `#c9c0b4` | `#534a3c` |

### Szöveg-skála

| Token | Light | Dark | Megjegyzés |
|---|---|---|---|
| `--text` | `#2f2a24` | `#f0e8d8` | elsődleges |
| `--text-soft` | `#4c453d` | `#d6ccba` | másodlagos / kézirat-body |
| `--text-muted` | `#6f675f` | `#b6aa96` | tompított |
| `--text-faint` | `#766d64` | `#978c78` | **AA-derived** (lásd lent) |
| `--text-muted-strong` | `#635c54` | `#c2b6a1` | erősebb tompított |

A `--text-faint` **nem** a design eredeti `#9b9187` (light) / `#857a68` (dark)
értéke: azok megbuktak a 4.5:1 AA-küszöbön. A kódban a **legközelebbi azonos hangú
meleg-szürke**, ami clear-eli az AA-t minden releváns felületen:

- light `#766d64` — `--bg`-n **4.70:1**, `--surface`-en **5.07:1** (PASS)
- dark `#978c78` — `--bg`-n **5.51:1**, `--surface`-en **5.06:1**,
  `--surface-muted`-on **4.55:1** (PASS, a dark surface-muted épp a küszöb felett)

### Accent (LILA)

| Token | Light | Dark | Szerep |
|---|---|---|---|
| `--accent` | `#6d5dfc` | `#9187ff` | accent felület / él / aktív |
| `--accent-strong` | `#5b4de0` | `#9187ff` | **AA gomb-fill** (lásd lent) |
| `--accent-hover` | `#5b4de0` | `#a39bff` | hover |
| `--accent-muted` | `#ebe9ff` | `#282343` | halvány accent háttér |
| `--accent-text` | `#342a91` | `#c4bdff` | accent szöveg |
| `--accent-fg` | `#ffffff` | `#0f0d1a` | címke accent-fill-en |
| `--ring` | `#6d5dfc` | `#9187ff` | fókuszgyűrű (raw var, lásd lent) |

> **Fontos AA-megkötés:** maga az `--accent` (`#6d5dfc`) csak **3.93:1** fehéren —
> NEM elég normál szöveghez. Ezért a CTA-gomb fill-je `--accent-strong` (`#5b4de0`)
> fehér címkével = **5.86:1 AA PASS** (dark: `#9187ff` / `#0f0d1a` = 6.51:1). A
> `button.tsx` `cta` variánsa már a biztonságos `bg-accent-strong text-accent-fg`-re
> mutat.

A `--ring` definiálva van CSS var-ként, de szándékosan **nincs** `--color-ring`
Tailwind-utility-re kötve; a fókuszgyűrű a globals.css `:focus-visible` szabályából
jön (`outline: 2px solid var(--accent)`).

### AI

| Token | Light | Dark |
|---|---|---|
| `--ai` | `#7c3aed` | `#b79bff` |
| `--ai-muted` | `#f0e9ff` | `#2a2140` |
| `--ai-text` | `#5b21b6` | `#d2c4ff` |
| `--ai-fg` | `#ffffff` | `#0f0d1a` |

### Státusz (success / warning / danger)

| Token | Light | Dark |
|---|---|---|
| `--success` / `-muted` / `-text` / `-fg` | `#2f7d55` / `#e6f3ec` / `#256544` / `#ffffff` | `#5fb286` / `#16291f` / `#7ec79e` / `#0d1f15` |
| `--warning` / `-muted` / `-text` | `#b7791f` / `#fff4da` / `#8a5a13` | `#d9a441` / `#2a2110` / `#e6b860` |
| `--danger` / `-muted` / `-text` | `#c2410c` / `#fff0e8` / `#9a3412` | `#e07a4f` / `#2a160d` / `#f0a07f` |
| `--danger-solid` / `-fg` | `#c2410c` / `#fffdf7` | `#b5431f` / `#fff7f3` |

A `--danger-solid` / `--danger-solid-fg` pár az **AA-biztos destruktív gombhoz** van
(a sima `--danger` fill nem mindig clear-elne fehér címkével minden témán).

### Gold — MÁSODLAGOS token-szett

A `--gold*` az **editorial / szerkesztői accent**: wordmark, eyebrow-k, daily-spark
kártya, kézirat-dekoráció. Soha nem funkcionális (gomb/fókusz) szerepben.

| Token | Light | Dark |
|---|---|---|
| `--gold` | `#b8893f` | `#d8b06a` |
| `--gold-deep` | `#8a6a2e` | `#b8893f` |
| `--gold-soft` | `#f3e7cf` | `#2b2113` |
| `--gold-text` | `#7a5a26` | `#e8cd8e` |
| `--gold-line` | `#e3cfa3` | `#4a3c24` |

### POV-párok (1–6)

Jelenet-POV chipek háttér+szöveg párjai. Light / dark:

| | bg (light) | tx (light) | bg (dark) | tx (dark) |
|---|---|---|---|---|
| pov1 | `#fdf0d5` | `#8a5a13` | `#3a2c10` | `#e6b860` |
| pov2 | `#fbe4e9` | `#9d2f4d` | `#3a1b24` | `#f0a0b8` |
| pov3 | `#e3f0e8` | `#256544` | `#16291f` | `#7ec79e` |
| pov4 | `#e1edf6` | `#235d86` | `#16283a` | `#9dc3ef` |
| pov5 | `#eceaf0` | `#4c4a59` | `#26242c` | `#c5c2cf` |
| pov6 | `#fdeadf` | `#9a3412` | `#2e1a10` | `#f0a07f` |

---

## c) Típus-skála (`@theme`)

Szemantikus, **nem ütköző** méret-nevek. A `text-micro/tiny/small/body/field/lead/
title/display/hero` szándékosan NEM árnyékolja le a Tailwind v4 default
`text-xs/sm/base/lg/xl/2xl/3xl` neveit — tisztán additív a skála, így a kit-migráció
nulla-vizuális-változással ment (a nevek pontosan a komponensek korábbi
`text-[Xpx]` arbitrary értékeire mappelnek). A radius-tokenek szándékosan
elhalasztva (a radius-nevek ütköznének a Tailwind defaultokkal).

| Név | Méret | line-height |
|---|---|---|
| `--text-micro` | 10px | 1.4 |
| `--text-tiny` | 11px | 1.45 |
| `--text-small` | 12px | 1.5 |
| `--text-body` | 13px | 1.55 |
| `--text-field` | 14px | 1.55 |
| `--text-lead` | 15px | 1.5 |
| `--text-title` | 17px | 1.45 |
| `--text-display` | 24px | 1.2 |
| `--text-hero` | 26px | 1.25 |

---

## d) Betűk

A négy face-t a `next/font/google` tölti (`apps/web/lib/fonts.ts`), és a root
layout köti a `<html>`-re; a `@theme inline` mappeli őket utility-kre.

| Face | CSS var | Tailwind | Hol használjuk |
|---|---|---|---|
| **Inter** | `--font-sans` | `font-sans` | teljes UI (body alapértelmezett); Source Sans 3-at váltotta |
| **Literata** | `--font-literata` | `font-serif` | kézirat (Write view body), serif blokkok; normal+italic, 400–700 |
| **Cormorant Garamond** | `--font-display` | `font-display` | display: hero-címek, fejezet-/oldal-címek, emelt szerkesztői felületek |
| **Caveat** | `--font-hand` | `font-hand` | kézírás / brand: a „Wisdom of Alexandria" wordmark, annotációk |

(Mono: `--font-mono`, rendszer-monospace stack a kódhoz.)

---

## e) Árnyékok

| Token | Light | Dark |
|---|---|---|
| `--shadow-card` | `0 1px 2px rgba(47,42,36,.06)` | `0 1px 2px rgba(0,0,0,.4)` |
| `--shadow-hover` | `0 6px 22px rgba(47,42,36,.12)` | `0 8px 26px rgba(0,0,0,.5)` |
| `--shadow-panel` | `0 2px 10px rgba(47,42,36,.08)` | `0 2px 12px rgba(0,0,0,.45)` |
| `--shadow-popover` | `0 12px 34px rgba(47,42,36,.14)` | `0 14px 40px rgba(0,0,0,.6)` |
| `--shadow-modal` | `0 24px 60px rgba(47,42,36,.20)` | `0 24px 70px rgba(0,0,0,.7)` |

Halk, meleg árnyékok — semmi nehéz drop-shadow.

---

## f) Layout-konstansok

A shell méretei `@theme inline`-on `--spacing-*` utility-ként is elérhetők:

| Token | Érték | Szerep |
|---|---|---|
| `--topbar-h` | 52px | felső sáv |
| `--statusbar-h` | 32px | alsó státusz-sáv |
| `--rail-w` | 56px | ikon-rail |
| `--tree-w` | 232px | fejezet/jelenet-fa |
| `--codex-sidebar-w` | 300px | Codex oldalsáv |
| `--inspector-w` | 360px | jobb inspector |
| `--timeline-rail-w` | 54px | idősor-rail |
| `--chapter-col-w` | 280px | Plan board fejezet-oszlop |

---

## g) Motion

- **Csak ease-out** (nincs bounce / túllövő easing — egy korábbi anti-pattern-kör
  kivezette a bounce-ot). A téma-crossfade 0.2s a themable property-ken
  (`[data-woa] *`).
- A `woa*` keyframe-ek a prototípusból verbatim portolva (`globals.css`):
  `woaReveal`, `woaToastIn`/`woaToastPop`, `woaViewIn`, `woaFade`,
  `woaSlideInLeft`/`woaSlideInRight` (responsive drawer edge-slide),
  `woaSpin`, `woaProgress`, `woaTwinkle`, `woaPulse` (nyugodt „AI dolgozik"
  opacity-lélegzés, nincs scale/bounce), `woaFloat`, `woaFlash` (frissen beszúrt
  AI-szöveg villanása), `woaStagger`, `woaSweep` (CTA gold-sweep), `woaShimmer`
  (skeleton), `woaSpark` (sparkfield), `woaGrow`, `woaRailPop`, `woaGlow`.
- **Reduced-motion-safe:** `@media (prefers-reduced-motion: reduce)` minden
  animációt/transition-t ~0.01ms-re húz le és elrejti a `.woa-sparkfield`-et.

---

## h) Dark téma

A dark a `data-woa="dark"` attribútumon él (a `next-themes` állítja a `<html>`-en),
nem `.dark` osztályon. Teljes paletta-újradefiniálás a `[data-woa="dark"]` blokkban
(lásd a fenti táblák dark oszlopait), beleértve a mélyebb árnyékokat is.

---

## i) Akadálymentesség

- **WCAG-AA kontraszt — 0 bukás mindkét témán.** A `--text-faint` AA-derived
  (lásd b), a CTA-gomb fill `--accent-strong` (5.86 / 6.51:1), a destruktív gomb
  `--danger-solid`.
- **Lighthouse a11y 100** (advisory, non-blocking CI-job).
- **axe-core unit-gate** a shellen (a komponens-tesztekben).
- **Determinista kontraszt-teszt:** `apps/web/components/kit/__tests__/contrast.test.ts`
  — fix paletta-fixture-ök + accent-gomb-fill assertion-ök (light + dark), így a
  paletta-regresszió fordításidőben/teszt-időben bukik.

---

## j) Komponens-kit

A felületek a megosztott kitből importálnak (`apps/web/components/kit/index.ts`),
nem nyúlnak az egyedi fájlokba. Főbb csoportok:

- **Kontroll / display:** `Button` (+ `cta` variáns), `IconButton`, `PillButton`/
  `FilterChip`, `SegmentedControl`, `Tab`/`TabBar`, `Badge`/`StatusPill`,
  `StatusDot`, `Avatar`, `Card`, `QuoteBlock`, `ProgressBar`, `Spinner`,
  `Skeleton`, `BrandStar`, `Icon`, `SectionEyebrow`, `PageHero`,
  `BookSpineCard`/`CoverThumbnail`, `ContextChips`, `BarChart`, `Sparkline`,
  `Timeline*`, `ThemeToggle`, `VariableTokenChip`.
- **Radix-alapú interaktív / kompozit:** `FormInput`/`FieldLabel`, `Textarea`,
  `PasswordInput`, `ToggleSwitch`, `CheckboxRow`/`CheckBox`, `RadioGroup`,
  `RangeSlider`, `PopoverMenu` + `MenuRow`/`MenuSection`, `SplitButtonDropdown`,
  `Modal*`, `AlertDialog`/`ConfirmDialog`, `Toaster`/`toast`, `Tooltip*`,
  `DashedTile`, `ModelSelector`, `AIResultCard`, `ErrorBoundary`, `DiffPane`,
  `Select`, `Accordion`.
- **State-pattern könyvtár:** `SkeletonCard`/`SkeletonList`/`SkeletonTable`,
  `EmptyState`, `ErrorState`.

A `Card` az app magja: `--surface` háttér, `--border` szegély, halk
`--shadow-card`, lekerekített sarkok; hover-en sötétedő szegély; kijelölt kártya
accent-szegély + `--accent-muted` háttér.

---

## k) Layout-filozófia (változatlan)

Három-zónás termékstruktúra: bal nav (projekt-/könyv-/fejezet-fa) + központi
munkaterület (board / editor / Codex / timeline / export) + jobb inspector
(AI / Codex-kontextus / metaadat / beat-ek / warnings). A kézirat-szerkesztő
szándékosan eltér az admin-nézetektől: szélesebb sorköz, kényelmes írási szélesség,
opcionális focus-paragraph mód, semmi vizuális zaj.

> A részletes komponens-anatómia (AppShell / TopBar / LeftSidebar / RightInspector /
> kártyák / státusz-badge-ek / üres- és hibaállapotok) változatlan a korábbi
> tervezési prózához képest — a re-skin csak a tokeneket / betűket / accentet
> cserélte, a struktúrát nem.
