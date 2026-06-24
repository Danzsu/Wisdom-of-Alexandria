# 18 — Design rollout és ami hátra van (élő)

Ez a dokumentum a **Claude Design** re-skin kigördülését írja le, és listázza a
design-ból még **hátralévő** felületeket / delight-tételeket. A token- és
betű-referencia a `docs/09`-ben él; ez a fájl a „mi készült el / mi van hátra"
nézet a design felől.

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

## d) DESIGN-C — ami hátra van (új surface-ek a designból)

A design net-új felületei, amelyek **még nincsenek** implementálva. Mind vagy
`ScreenPlaceholder`, vagy teljesen hiányzik:

| Felület | Állapot ma | Megjegyzés |
|---|---|---|
| **Landing page** (marketing) | **hiányzik** — `app/page.tsx` `redirect(/projekt)` | hero + features + filozófia-sáv + showcase + footer CTA; net-új, app-on kívüli route kell |
| **Profil** képernyő | **hiányzik** — a user-menü „Profil" sora `toast(comingSoon)`-t lő | dedikált képernyő/route nincs |
| **Prompt Library** | **`ScreenPlaceholder`** — `/konyv/[bookId]/promptok` | egyben **V1-gap** (a roadmap M10/V1 alá esik) |
| **Áttekintés** (overview) | **`ScreenPlaceholder`** — `/konyv/[bookId]/attekintes` | a design overview-képernyője; placeholder |

(A `promptok` és `attekintes` route-ok valódi fájlok, de `ScreenPlaceholder`-t
renderelnek a `hu.placeholders.*` szöveggel.)

---

## e) Elhalasztott design / delight tételek

- **`woa-embers` dekoratív háttér-canvas:** a design hangulati parázs-/szikra-háttere;
  a sparkfield (`.woa-sparkfield` / `woaSpark`) megvan, a teljes embers-canvas még
  nem adoptálva.
- **Inspector szegmentált-kontroll konszolidáció:** a Write inspector saját, egyedi
  szegmentált kontrollt használ — érdemes a kit `SegmentedControl`-jára húzni
  (`apps/web/components/kit/segmented-control.tsx`), hogy egy primitív legyen.

---

## f) Hogyan iteráljunk tovább (design → kód)

A design→kód kézfogás az **artifact / DesignSync URL**-en megy: a Claude Design
fájl (`Alexandria.dc.html`) frissül a design-projektben, onnan a `claude_design`
MCP (`DesignSync` / `/design-login`) szinkronizálja, a referencia-példány pedig
lokálisan a `.superpowers/sdd/design/Alexandria.dc.html`-ben él scratch-ként
(untracked, nem commitoljuk — csak fejlesztési referencia). Egy-egy képernyő
ráhúzása a DESIGN-B mintáját követi: a designból kiolvasott pontos méretek/színek a
meglévő tokenekre / kit-primitívekre mappelve, AA-ellenőrzéssel, nulla-token-drift
elvárással.
