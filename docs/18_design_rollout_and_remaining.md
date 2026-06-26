# 18 — Design rollout és ami hátra van (élő)

Ez a dokumentum a **Claude Design** re-skin kigördülését írja le. A re-skin
mostanra **teljes** (DESIGN-A + B + C **és a delight-pass** mind kész); a
**2026-06-26 design-delta kör** (frissített canvas: 5 net-új képernyő + 4 igazítás,
lásd g) szakasz) tovább szűkítette a hátralevőt — design-felületből csak a 3
elhalasztott delta-tétel marad (backend / kockázatos restrukturálás kell), plusz
opcionális konszolidáció. A token- és betű-referencia a `docs/09`-ben él; ez a fájl a
„mi készült el / mi van hátra" nézet a design felől.

> **LIVE VERIFIED 2026-06-26 — Lighthouse a11y 100, 0 contrast failures both
> themes.** DESIGN-A + B + C + delight mind kész; a `PageHero` cím a design 40px-én
> (`text-[clamp(32px,5vw,40px)]`, lásd d).

---

## a) A design-forrás

A vizuális forrás a user **Claude Design** projektje
(„**Könyvíró webapp design fejlesztés**"), egyetlen fájlban:
**`Alexandria.dc.html`**. A `claude_design` MCP-n keresztül szinkronizálva
(`DesignSync` tool / `/design-login`). A fájl lokálisan scratch-referenciaként él a
`.superpowers/sdd/design/Alexandria.dc.html` alatt (nem commitolt, untracked
munkapéldány).

A design ennél jóval több felületet fed le, mint amennyi ma implementálva van.
Lefedett képernyők:

- marketing **Landing** oldal
- **App shell** (rail + fa + topbar + statusbar + inspector)
- **Dashboard** · **Write** · **Plan** · **Codex** · **Export** · **Timeline** ·
  **Relations** · **Settings** · **Profil** · **AI Jobs** · **Prompt Library** ·
  **Command Palette** · **Provider modal**

---

## b) DESIGN-A — token + betű re-skin (KÉSZ)

A teljes design-token és betű-réteg átállítva a Claude Design purple-accent
irányra. Kivonat (részletek: `docs/09`):

- Accent **arany → lila** (`#6d5dfc` light / `#9187ff` dark), AI **kék → violet**
  (`#7c3aed`).
- Betűk: **Inter** (UI, Source Sans 3-at váltotta), **Literata** (kézirat),
  **Cormorant Garamond** (display), **Caveat** (kézírás/brand). Mind a négy a
  `<html>`-re kötve.
- A `--gold*` szett **másodlagos** szerkesztői accentként megtartva.
- Teljes **dark téma** újraértékelve (`[data-woa=dark]`).
- **AA-integritás megőrizve:** `--text-faint` újraszármaztatva, hogy clear-elje a
  4.5:1-et (a design eredeti faint-jei buktak), a CTA-gomb fill `--accent-strong`
  (`#5b4de0`, 5.86:1).
- **Élőben verifikálva:** kontraszt **0/0** bukás, Lighthouse a11y **100**.

Commit: **`5b02d65`** (`feat(design): re-skin to the Claude Design system - purple
accent + new fonts`). Forrásriport: `.superpowers/sdd/briefs/design-A-report.md`.

---

## c) DESIGN-B — meglévő képernyők vizuális finomítása (KÉSZ)

Per-képernyő vizuális ráhúzás MINDEN már létező felületre (nem új surface, hanem a
meglévők összehangolása a designnal):

- **Dashboard:** Cormorant display-hero (`font-display`, 46px), arany eyebrow
  (gradient-vonalak közt, „A könyvespolcod"), lebegő `BookSpineIcon`
  (`woaFloat`), arany daily-spark treatment.
- **App shell:** Caveat arany **„Wisdom of Alexandria"** wordmark + arany
  `BrandStar` csillag, chrome (rail/topbar/statusbar) a designhoz igazítva.
- **Write:** kézirat-tónus (Literata body, radial gold dekoráció), szegmentált
  inspector.
- **Plan / Codex:** display-címek, arany accentek, card-finomítás.
- **Export / Timeline / Relations / Settings:** közös `PageHero` primitív köti
  őket egy fejlécre.

Commitok: **`da61cbe`** (dashboard) → `bed1e60` (shell) → `f06d660` (Write) →
`befe110` (Plan + Codex) → **`a74a5a3`** (Export/Timeline/Relations/Settings +
PageHero). Forrásriportok: `.superpowers/sdd/briefs/design-B-*.md`.

---

## d) DESIGN-C — net-új design-surface-ek (KÉSZ)

A design net-új felületei mostanra implementálva + commitolva. Mindhárom
design-képernyő leszállítva:

| Felület | Állapot ma | Megjegyzés |
|---|---|---|
| **Landing page** (marketing) | **KÉSZ** — publikus `/` marketing-oldal | hero + features + filozófia-sáv + showcase + footer CTA; net-új, app-on kívüli route. Commit **`9361dda`** |
| **Profil** képernyő | **KÉSZ** — `/profil` route + user-menü bekötve | dedikált képernyő; a user-menü „Profil" sora ide navigál. Commit **`3683c6d`** |
| **Prompt Library** | **KÉSZ** — `/konyv/[bookId]/promptok` (a placeholder helyén) | a `ScreenPlaceholder` valódi prompt-tár-képernyőre cserélve. Commit **`6036123`** |

Követő finomítás (commit **`b6768a6`**): a `PageHero` címek a design 40px-ére
emelve (`text-[clamp(32px,5vw,40px)]`), favicon hozzáadva, kisebb mobil-reszponzív
javítások.

> **Áttekintés** (`/konyv/[bookId]/attekintes`): a DESIGN-C körben még nem volt a
> canvasban (akkori V1-rés). A **2026-06-26 design-delta körben** a frissített canvas
> immár tartalmazza, és a képernyő **megépült** (a placeholder kitöltve, commit
> `32486eb`) — részletek a g) szakaszban.

---

## e) Delight-pass — „celestial calm" (KÉSZ)

A re-skin záró rétege egy **HSR-ihletésű, de visszafogott** „celestial calm"
delight-kör — tisztán esztétikai ráadás, nem új design-surface. Mind **token-alapú**
és **reduced-motion-safe**:

- **`CelestialBackdrop`** a dashboard-heron + az üres állapotokon — finom égi
  háttér-hangulat.
- **AI-result reveal shimmer** + **lágy kártya-aurák** az AI-result-kártyákon.

Commitok: **`6354035`** + **`1bd977a`**. Ezzel a **design-rollout teljes**
(DESIGN-A + B + C + delight) — design-felület már nincs hátra.

---

## f) Elhalasztott konszolidáció (opcionális)

A delight-pass leszállításával **design-felület már nincs hátra** — ami marad, az
kizárólag opcionális konszolidáció (javasolt, nem kötelező):

- **`woa-embers` dekoratív háttér-canvas:** a design hangulati parázs-/szikra-háttere;
  a sparkfield (`.woa-sparkfield` / `woaSpark`) megvan, és a visszafogott
  `CelestialBackdrop` delight-réteg már landolt (lásd e), de a **teljes**
  embers-canvas tudatosan nincs adoptálva (opcionális V2 — lásd `docs/17`).
- **Inspector szegmentált-kontroll konszolidáció:** a Write inspector saját, egyedi
  szegmentált kontrollt használ — érdemes a kit `SegmentedControl`-jára húzni
  (`apps/web/components/kit/segmented-control.tsx`), hogy egy primitív legyen.

---

## g) Design-delta kör (2026-06-26)

A user **Claude Design** canvasa **frissült és újra-importálva** lett (a forrásfájl
**161KB → 261KB**-ra nőtt), majd **összevetve** (reconcile) a jelenlegi appal. A
delta két fázisban szállt le a `feat/alexandria-ui` ágon (mind commitolva +
pusholva):

### Fázis 1 — net-új képernyők (5, KÉSZ)

| Felület | Állapot ma | Commit |
|---|---|---|
| **Áttekintés** (könyv-dashboard) | **KÉSZ** — a `/attekintes` placeholder kitöltve | **`32486eb`** |
| **Stíluskalauz** (Style Guide) | **KÉSZ** — net-új `/stiluskalauz` route, a StyleGuide backendhez kötve | **`1056e2f`** |
| **Verzióelőzmények** (Revision History) | **KÉSZ** — jobbról-csúszó panel diffel + restore-ral, a Write inspektorba kötve | **`06633e6`** |
| **Scene Metadata modal** | **KÉSZ** — a terv-board jelenet-kártya „Info" gombja | **`b9461c5`** |
| **Codex Image Lightbox** | **KÉSZ** — Codex képnagyító | **`d316528`** |

> Az **Áttekintés** ezzel **már nem V1-rés** (lásd a korábbi callout a d) szakaszban
> — mostantól épített képernyő, nem `ScreenPlaceholder`).

### Fázis 2 — meglévő képernyők igazítása (4, KÉSZ)

| Felület | Igazítás | Commit |
|---|---|---|
| **Write** | folytonosság-toolbar badge + `::selection` styling | **`5567069`** |
| **Onboarding** | scroll-narratíva → lépés-karusszel | **`1231540`** |
| **Import dialógus** | dropzone + fájl-infó kártya | **`63bf38d`** |
| **Új könyv wizard** | arany fejléc + recap kártya | **`10bb71b`** |

Teljes web suite **~887 zöld**; tsc + lint tiszta.

### Hátralevő design-delta munka (3, HALASZTVA — backend vagy kockázatos restrukturálás kell)

A canvas-reconcile három tételét tudatosan **elhalasztottuk**, mert vagy nem létező
backendet, vagy a működő contract kockázatos átalakítását igényelné:

1. **Write fókusz-mód lebegő toolbarok** — a működő fókusz mód (Esc-kilépés /
   chrome-rejtés contract) restrukturálását igényelné; külön tervezett task.
2. **Import „felismert struktúra" előnézet** (fejezet-lista + darabszámok az import
   *előtt*) — hiányzó backend parse-preview endpointot igényel (a darabszámok már
   megjelennek import *után*).
3. **Új könyv wizard premise-mező / tónus-pillek / „start-mode" 4. lépés** —
   backendet igényel + módosítaná a create payloadot.

---

## h) Hogyan iteráljunk tovább (design → kód)

A design→kód kézfogás az **artifact / DesignSync URL**-en megy: a Claude Design
fájl (`Alexandria.dc.html`) frissül a design-projektben, onnan a `claude_design`
MCP (`DesignSync` / `/design-login`) szinkronizálja, a referencia-példány pedig
lokálisan a `.superpowers/sdd/design/Alexandria.dc.html`-ben él scratch-ként
(untracked, nem commitoljuk — csak fejlesztési referencia). Egy-egy képernyő
ráhúzása a DESIGN-B mintáját követi: a designból kiolvasott pontos méretek/színek a
meglévő tokenekre / kit-primitívekre mappelve, AA-ellenőrzéssel, nulla-token-drift
elvárással.
