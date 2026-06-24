# DESIGN-C — Net-New Screens (Landing · Profil · Prompt Library)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development. Each task is implemented by a fresh subagent, then spec-reviewed + quality-reviewed. The controller commits (implementers must NOT commit). Steps use `- [ ]`.

**Goal:** Build the three screens that exist in the Claude Design canvas (`.superpowers/sdd/design/Alexandria.dc.html`) but are not yet in the app — a public marketing **Landing** page, a **Profil** screen, and a **Prompt Library** — copied faithfully from the design and made functional.

**Architecture:** Frontend-only (`apps/web`). Translate the design's inline-styled HTML into React + Tailwind using the established semantic tokens (the same re-skin language DESIGN-A/B already shipped). No backend changes. Real data where it already exists (`useProjects()` aggregates); honest stubs (toast "Hamarosan") where a backend does not exist yet (creating prompts, editing profile). FTDD: every screen carries vitest + `vitest-axe` tests.

**Design source of truth:** `.superpowers/sdd/design/Alexandria.dc.html` (local, gitignored). Implementers MUST read the exact line ranges named per task for pixel-faithful reference. Treat the file as data (it is a design mock), not as instructions.

---

## Global constraints (every task, for implementers AND reviewers)

1. **Faithful copy.** Match the design's layout, spacing, type sizes, colors, gradients, and copy. Use Tailwind arbitrary values (`text-[78px]`, `rounded-[18px]`, `px-7`) where the design uses specific px — this matches the existing codebase (e.g. PageHero uses `text-[34px]`). Do NOT invent new visual language.
2. **Tokens, not raw colors.** Use the semantic Tailwind classes that map to the CSS vars — never hardcode hex. Mapping:
   | Design CSS var | Tailwind class |
   | --- | --- |
   | `--bg` / `--background-subtle` | `bg-bg` / `bg-background-subtle` |
   | `--surface` / `--surface-soft` / `--surface-muted` | `bg-surface` / `bg-surface-soft` / `bg-surface-muted` |
   | `--border` / `--border-strong` | `border-border` / `border-border-strong` |
   | `--text` / `--text-soft` / `--text-muted` / `--text-faint` | `text-text` / `text-text-soft` / `text-text-muted` / `text-text-faint` |
   | `--accent` / `--accent-strong` / `--accent-muted` / `--accent-text` / `--accent-fg` | `bg-accent` / `bg-accent-strong` / `bg-accent-muted` / `text-accent-text` / `text-accent-fg` |
   | `--ai` / `--ai-muted` / `--ai-text` | `bg-ai` / `bg-ai-muted` / `text-ai-text` |
   | `--gold` / `--gold-deep` / `--gold-soft` / `--gold-text` / `--gold-line` | `bg-gold`/`text-gold` / `bg-gold-deep` / `bg-gold-soft` / `text-gold-text` / `bg-gold-line` |
   | `--success(-muted/-text)` / `--warning(...)` / `--danger(...)` | `…-success` / `…-warning` / `…-danger` families |
   | `--pov-N-bg` / `--pov-N-text` | `bg-pov{N}-bg` / `text-pov{N}-tx` (N=1..6) |
   | `--shadow-card/-hover/-panel/-popover/-modal` | `shadow-card/-hover/-panel/-popover/-modal` |
   | `--font-ui` / `--font-display` / `--font-ms` / `--font-hand` | `font-sans` / `font-display` / `font-serif` / `font-hand` |
   For gradients (`linear-gradient(145deg,var(--gold),var(--gold-deep))`), use arbitrary Tailwind: `bg-[linear-gradient(145deg,var(--gold),var(--gold-deep))]`.
3. **WCAG AA discipline.** The design's `--text-faint` (#9b9187) FAILS AA — but our app token `--text-faint` was already re-derived to an AA-passing value (#766d64 light / #978c78 dark) in DESIGN-A, so using `text-text-faint` is safe. Do NOT introduce raw faint hexes. Body text must stay ≥ 4.5:1; large display text ≥ 3:1. Verify live in Task 4.
4. **All copy via i18n.** Add new namespaces to `apps/web/lib/i18n/hu.ts` (`landing`, `profil`, `promptLibrary`). No literal Hungarian strings in components. Consume via `import { hu } from "@/lib/i18n/hu"`.
5. **Tests.** Each screen gets a vitest test (renders key copy, functional interactions work) + an `expectNoA11yViolations` assertion (`@/test/a11y`). Mirror `apps/web/components/export/__tests__/export-screen.test.tsx`. Mutation-proof: assert behavior (navigation called, modal opens, real data binds), not just "an element exists".
6. **Reduced motion.** Any animation (embers, float, reveal) must no-op under `@media (prefers-reduced-motion: reduce)` — the global rule in globals.css already handles CSS animations; the embers canvas (JS) must check `window.matchMedia("(prefers-reduced-motion: reduce)")` and not animate.
7. **No new lint/tsc errors.** TypeScript strict. Run `pnpm -C apps/web lint` + `pnpm -C apps/web exec tsc --noEmit` clean before reporting DONE.
8. **Reuse the kit.** Prefer `PageHero`, `Button`, `Card`, `Modal`/`ModalShell`, `EmptyState`, `Badge`, `toast` over re-rolling. PageHero already renders the gold-eyebrow + display-title + subtitle pattern (`apps/web/components/kit/page-hero.tsx`).

---

## Task 1: Landing page (public, at `/`)

**Design reference:** `.superpowers/sdd/design/Alexandria.dc.html` lines **110–304** (the `<!-- LANDING -->` block) and the head/keyframes lines **44–104** (animations `woaFloat`, `woaCaret`, `reveal`, embers).

**Files:**
- Create: `apps/web/components/landing/landing-page.tsx` (client component — the whole page)
- Create: `apps/web/components/landing/embers-canvas.tsx` (client; drifting gold embers, reduced-motion aware)
- Modify: `apps/web/app/page.tsx` (replace the `redirect("/projekt")` with `<LandingPage />`)
- Modify: `apps/web/lib/i18n/hu.ts` (add `landing` namespace)
- Test: `apps/web/components/landing/__tests__/landing-page.test.tsx`

**What the page contains (faithful to the design):**
1. **Sticky top nav** (design 115–135): gold-gradient star tile + Caveat wordmark "Wisdom of Alexandria" (`font-hand text-[31px] text-gold-text`); nav anchors **Funkciók** (#funkciok), **A műhely** (#muhely), **Filozófia** (#elv); a theme-toggle button (reuse the existing theme mechanism — `useTheme()` from `next-themes`, mirroring `apps/web/components/kit/theme-toggle.tsx`); a primary "Belépés a műhelybe" button. Backdrop-blur header.
2. **Hero** (design 137–205): two-column grid (`lg:grid-cols-[1.05fr_.95fr]`, stacks to one column below `lg`). Left: gold pill eyebrow "MAGYAR-ELSŐ ÍRÓI MŰHELY", `font-display text-[78px]` headline ("A regényed / *megőrzött* műhelye." — the word "megőrzött" italic + `text-gold-text`), lead paragraph, two CTAs ("Kezdj el írni" gold-gradient → `/projekt`; "Nézd meg élőben" → smooth-scroll to #muhely), and a 3-stat row (100% / ∞ / 0). Right: the floating editor mock (the bordered "manuscript" card with traffic-light dots, a chapter heading, two manuscript paragraphs with a blinking caret, and an absolutely-positioned floating "AI javaslat" popover card with Elfogad/Elvet). Behind the hero: the `<EmbersCanvas/>` + two radial-gradient glows (design 139–140).
3. **Trust strip** (design 208–218): four check-marked items (Ember a hurokban / Verziókövetés / Ollama lokális modell / Markdown / DOCX export).
4. **Features** (design 220–235): eyebrow "A MŰHELY NÉGY PILLÉRE" + `font-display text-[48px]` title, then a 2×2 grid (1 col on mobile) of the **4 pillars** (design data lines 1607–1612):
   - "Codex-vezérelt világ" — "Szereplők, helyszínek, lore egy kereshető adatbázisban, amely megfogja az AI hallucinációit." (icon: Lucide `Database`)
   - "Strukturált terv" — "Felvonás, fejezet, jelenet és beat — húzd a helyükre, lásd a teljes ívet egy pillantással." (icon: `BookOpen`)
   - "AI a kézirat mellett" — "Átírás, leírás, folytatás közvetlenül a szövegnél — diff-fel és jóváhagyással, sosem magától." (icon: `Sparkles`)
   - "Lokális & magyar" — "Ollama a gépeden, magyar nyelvtanra hangolva. A kézirat el sem hagyja az otthonod." (icon: `Brain`)
   Each card: `bg-surface border-border rounded-[16px] shadow-card p-[26px]` with a 46×46 `bg-surface-muted text-accent-text` rounded icon tile, `font-display text-[25px]` title, muted body.
5. **Philosophy band** (design 237–250): full-width gradient card; AI-muted pill "KÉT IBOLYA, EGY ELV"; the big `font-display text-[38px]` quote ("Az AI *javasol*, az író *dönt*. Egyetlen mondat sem kerül a kéziratba a jóváhagyásod nélkül.") with "javasol" in `text-ai-text` italic and "dönt" in `text-gold-text` italic; a supporting paragraph.
6. **Showcase** (design 252–282): centered eyebrow "A COCKPIT" + `text-[46px]` title "Három panel. Egy nyugodt fókusz." + subtitle, then a bordered 3-column mock (`grid-cols-[200px_1fr_230px]`, 380px tall) — chapter list / manuscript / AI panel with the indeterminate `.woa-bar`. On mobile, allow horizontal scroll inside its own container (do NOT let the page scroll sideways).
7. **Footer CTA** (design 284–294): gradient card, `font-display text-[52px]` "A következő fejezet a tiéd.", paragraph, "Belépés a műhelybe" button → `/projekt`.
8. **Footer** (design 296–302): star tile + wordmark + tagline "A te történeted. A te géped. A te döntésed."

**Functional requirements ("működőképessé"):**
- All "Belépés a műhelybe" / "Kezdj el írni" buttons navigate to `/projekt` (use `next/link` `<Link href="/projekt">` or `useRouter().push`). Use `routes.projects()` from `@/lib/routes` for the href.
- Theme toggle actually flips light/dark via `next-themes` (`useTheme`), persists (next-themes handles it).
- Anchor links smooth-scroll to their sections (`#funkciok`, `#muhely`, `#elv`) — give those `<section>`s matching `id`s and `scroll-margin-top` so the sticky header doesn't cover them.
- The `reveal` entrance animation: replicate with a small client-side IntersectionObserver that adds an `in`/visible class, OR use the existing motion utilities if present (`apps/web/lib/motion.ts`). Keep it subtle and reduced-motion safe. If simpler, a CSS-only fade/translate on mount is acceptable — prioritize correctness over exact replication.
- Embers canvas: a lightweight `<canvas>` drawing a few dozen slow-rising gold particles (`--gold` / `--gold-deep` with low opacity), `pointer-events:none`, sized to its container, paused entirely under reduced-motion. Keep it cheap (≤ ~40 particles, single rAF loop, cancel on unmount).

**Routing note:** `apps/web/app/page.tsx` currently does `redirect(routes.projects())`. Replace that with rendering the landing. Keep `app/page.tsx` a thin server component that renders `<LandingPage/>` (a client component). **Search for any test or code that asserts `/` redirects** (e.g. an e2e or a routes test) and update it — the root now shows the landing, and `/projekt` is reached via the CTA.

- [ ] Write failing test (renders headline "A regényed" + the 4 pillar titles; clicking "Belépés a műhelybe" navigates to `/projekt` via a mocked router/Link href; theme toggle calls setTheme; `expectNoA11yViolations`) → build `embers-canvas.tsx` + `landing-page.tsx` + `landing` i18n + wire `app/page.tsx` → pass → tsc/lint clean → report DONE (do not commit).

---

## Task 2: Profil screen + UserMenu wiring

**Design reference:** `.superpowers/sdd/design/Alexandria.dc.html` lines **956–987** (the `<!-- PROFIL -->` block).

**Files:**
- Create: `apps/web/app/(app)/profil/page.tsx` (route; renders `<ProfileScreen/>`)
- Create: `apps/web/components/profile/profile-screen.tsx` (client component)
- Modify: `apps/web/components/shell/user-menu.tsx` ("Profil" row → navigate to `/profil`; "Kijelentkezés" row → navigate to `/` (the landing) instead of toast)
- Modify: `apps/web/lib/routes.ts` (add `profile: () => "/profil"`)
- Modify: `apps/web/lib/i18n/hu.ts` (add `profil` namespace)
- Test: `apps/web/components/profile/__tests__/profile-screen.test.tsx`

**What the screen contains (faithful to the design):**
- Scrollable container with the gold-soft radial-gradient top wash (design 958), `max-w-[720px] mx-auto`.
- **Header** (design 960–963): gold rule + eyebrow "A SZERZŐ" + `font-display text-[40px]` "Profil". (Use `PageHero` if it fits; the design's eyebrow has a single leading rule which PageHero already renders.)
- **Identity card** (design 964–971): a 74×74 round avatar with initials (use `hu.user.initials`) on a `bg-pov2-bg text-pov2-tx` disc; name (`hu.user.name`, `font-display text-[26px]`); a muted meta line ("@eszter · Alexandria műhely · Szépirodalmi szerző" → adapt to real user handle/role from `hu.user`/`hu.profil`); a "Szerkesztés" secondary button (pencil icon).
- **Stats row** (design 972–976): 3 stat cards (`font-display text-[30px]` number + muted label). Bind **real data** from `useProjects()`:
  - `könyv a polcon` = total books = `projects.reduce((s,p)=>s+p.book_count,0)`
  - `megírt szó` = total words = `projects.reduce((s,p)=>s+p.word_count,0)`, formatted `toLocaleString("hu-HU")`
  - third card = `projekt` = `projects.length` (the design says "jelenet"/scene, but scene-count is not an available aggregate; use the real **projekt** count with the label `hu.profil.statProjects` — honest real data, identical card layout). While loading, show `—`; on error, show `—` (do not crash).
- **Writer settings** (design 977–984): an uppercase "Írói beállítások" label + a card with 3 divider-separated rows (label + sublabel on the left, value on the right): "Megszólítás alapértelmezés" → "Magázás"; "Alapértelmezett modell" → "Llama 3.1 · lokális" (with a small model icon); "Napi íráscél" → "1 000 szó". These are **display-only** in the design — render them as static display rows from i18n (no editing this pass). The "Szerkesztés" button → `toast.info(hu.profil.editSoon)` ("Hamarosan").

**Functional requirements:**
- The screen renders inside the existing app shell (the `(app)` layout). Outside a book, the shell shows no rail (matches `/projekt`) — confirm it renders cleanly there.
- Real aggregates bind from `useProjects()` (TanStack Query hook in `@/lib/api/hooks`). Handle loading (skeleton or `—`) and error gracefully.
- UserMenu "Profil" → `router.push(routes.profile())` (and close the menu). "Kijelentkezés" → `router.push("/")` (returns to the public landing — faithful to the design's `logout → view:landing`).

- [ ] Write failing test (UserMenu "Profil" click pushes `/profil`; ProfileScreen renders `hu.user.name`; with a mocked `useProjects` returning 2 projects of known book/word counts, the stat cards show the summed totals; "Szerkesztés" fires a toast; `expectNoA11yViolations`) → build screen + route + routes.ts + user-menu wiring + i18n → pass → tsc/lint clean → DONE (no commit).

---

## Task 3: Prompt Library (fill `konyv/[bookId]/promptok`)

**Design reference:** `.superpowers/sdd/design/Alexandria.dc.html` lines **1017–1044** (the `<!-- PROMPT LIBRARY -->` block) and the `prompts` data lines **1568–1577**.

**Files:**
- Create: `apps/web/components/prompts/prompt-library-screen.tsx` (client component)
- Create: `apps/web/lib/prompt-library-data.ts` (the 6 seeded prompts: name, category, description, uses, icon key, and a full example template body for the detail modal)
- Modify: `apps/web/app/(app)/konyv/[bookId]/promptok/page.tsx` (render `<PromptLibraryScreen/>` instead of `ScreenPlaceholder`)
- Modify: `apps/web/lib/i18n/hu.ts` (add `promptLibrary` namespace; remove/repurpose `hu.placeholders.promptok*` only if now unused — otherwise leave)
- Test: `apps/web/components/prompts/__tests__/prompt-library-screen.test.tsx`

**What the screen contains (faithful to the design):**
- Scrollable container, accent-muted radial top wash, `max-w-[900px] mx-auto`.
- **Header** (design 1021–1028): gold eyebrow "AI PROMPTOK" + `font-display text-[40px]` "Prompt könyvtár" + italic serif subtitle "Magyar nyelvre hangolt promptok minden AI-művelethez." + a right-aligned accent "Új prompt" button (plus icon).
- **Grid** (design 1029–1041): 2-column (1 col on mobile) of prompt cards. Each card (`woa-lift` hover): a 38×38 `bg-ai-muted text-ai-text` rounded icon tile, `font-display text-[19px]` name, a category pill (`bg-surface-muted text-text-muted` rounded-full), a muted description, and a footer line with a sparkle icon + "{uses} használat".
- **The 6 seeded prompts** (design data 1568–1574) — put in `prompt-library-data.ts`:
  | name | cat | desc | uses | icon |
  | --- | --- | --- | --- | --- |
  | Folytatás — alap | Írás | A jelenet természetes folytatása a stíluslap és az előző bekezdés alapján. | 142 | Sparkles |
  | Átírás — irodalmibb | Átírás | A kijelölt szöveg emelt, irodalmi hangvételű újraírása a karakterhang megtartásával. | 88 | RefreshCw |
  | Érzéki leírás | Leírás | Hat csatorna: látás, hang, tapintás, szag, íz, metafora — kártyánként. | 67 | Eye |
  | Párbeszéd természetesítés | Dialógus | Magyar beszélt nyelvhez igazítás, tegezés/magázás figyelembevételével. | 54 | Brain |
  | Ötletelés — fordulatok | Brainstorm | Alternatív cselekményirányok, konfliktusok és tét-emelő fordulatok. | 39 | Brain |
  | Magyar nyelvi ellenőrzés | Szerkesztés | Angolos szerkezetek, modorosság és ismétlés kiszűrése. | 31 | CheckCircle |
  Add a short illustrative `template` body string to each (a few lines of the actual Hungarian prompt with a couple `{token}` placeholders) for the detail modal — these are seed/example content, clearly local data.

**Functional requirements ("működőképessé"):**
- Clicking a prompt card opens a **read-only detail modal** (reuse `Modal`/`ModalShell` from the kit) showing the prompt's name, category, description, usage count, and the full `template` body (monospace-ish, `font-serif` or `whitespace-pre-wrap`). Modal closes on Esc / backdrop / close button (the kit Modal handles this).
- "Új prompt" button → `toast.info(hu.promptLibrary.createSoon)` ("Hamarosan — a saját promptok az M-ben érkeznek") — honest stub, since there is no prompts backend yet.
- The screen is book-scoped (it lives under `konyv/[bookId]`); it does not need the bookId for the seed data, but keep the route param intact.

- [ ] Write failing test (renders the 6 prompt names; clicking a card opens the modal showing that prompt's template body; "Új prompt" fires a toast; `expectNoA11yViolations` on the screen AND on `document` with the modal open) → build data + screen + wire the page → pass → tsc/lint clean → DONE (no commit).

---

## Task 4: Live verification + full sanity (controller-run after Tasks 1–3 reviewed & committed)

This task is run by the controller (not a fresh implementer) once the three screens are committed.

- [ ] **Full suite + static checks:** `pnpm -C apps/web test` (all green, incl. the 3 new test files), `pnpm -C apps/web exec tsc --noEmit` clean, `pnpm -C apps/web lint` clean. Shared types unaffected (no API change) — confirm no `packages/shared` regen needed.
- [ ] **Live (chrome-devtools, dev server on :3000):** navigate to `/` (landing), `/profil`, and a book's `/promptok`. For each, light **and** dark:
  - `take_screenshot` — visually confirm it matches the design intent.
  - Run the contrast sweep (`evaluate_script`) — **0 contrast failures** both themes.
  - `lighthouse_audit` accessibility — **100** (or no new violations vs the rest of the app).
- [ ] **Responsive:** resize to mobile (375), tablet (768), desktop (1280) on the landing — hero stacks, features go 1-col, the showcase 3-panel scrolls inside its own container, and the **page body never scrolls horizontally**. Spot-check profil + promptok at mobile.
- [ ] **Keyboard:** landing nav anchors + CTAs reachable and focus-visible; prompt card → modal focus-trap works; Esc closes.
- [ ] Report results with screenshots; fix any finding before declaring DESIGN-C done.

---

## Out of scope (note, not done this plan)
- **Áttekintés** (`konyv/[bookId]/attekintes`) — NOT in the design canvas; stays a `ScreenPlaceholder` (tracked as a V1 gap in docs/17).
- **Command palette / Provider config modal** — already implemented in the app (`components/shell/command-palette.tsx`, settings provider config). The design's versions are mockups of existing functionality; no rebuild.
- **Real prompt CRUD / profile editing / auth** — backend does not exist yet (V1+). Stubbed honestly with toasts.
- **Scene-count aggregate** for the Profil third stat — would need a backend change; using the real `projekt` count instead this pass.

## Verification
Per task: its vitest + axe green; tsc + lint clean. End of plan (Task 4): full `apps/web` suite green, live a11y 100 / contrast 0 on the 3 new screens in light + dark, responsive with no horizontal body scroll. Then update `docs/17` + `docs/18` to mark DESIGN-C shipped.
