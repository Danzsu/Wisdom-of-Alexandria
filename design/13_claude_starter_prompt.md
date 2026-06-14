# 13 — Claude Design indító prompt

Ez az **első üzenet**, amit a Claude Designba (vagy bármely AI design/build eszközbe) bemásolsz, miután csatoltad a 3 forrásdokumentumot:

1. `DESIGN.md` — token-rendszer, kontraszt, állapotok, mozgás, dark theme (kanonikus forrás)
2. `11_claude_design_prompt.md` — képernyő vizuális specek (A–J) + animációs rendszer
3. `12_claude_feature_prompt.md` — funkcionális scope, képernyő-inventár, user flow-k

Csatold a referenciaképeket is (`design/01_nc_*.png` … `25_sw_*.png`) kontextusként.

---

## Indító prompt (másold be ezt)

```
Egy AI regényíró webalkalmazás UI-ját tervezzük: ForgeWriter AI — lokális-first, magyar-elsődleges, hosszú-formájú fikcióhoz. Strukturált „writer's cockpit", NEM chatbot, NEM Notion-klón, és NEM a NovelCrafter másolata.

HÁROM CSATOLT DOKUMENTUM AZ IRÁNYADÓ — ezekből dolgozz, ne találj ki saját rendszert:
1. DESIGN.md — a token-rendszer kanonikus forrása (szín, tipográfia, radius, árnyék, z-index, mozgás, dark theme). MINDEN érték innen jön.
2. 11_claude_design_prompt.md — a fő képernyők pixel-szintű vizuális specje + animációk.
3. 12_claude_feature_prompt.md — mit építünk: a teljes funkció- és képernyő-inventár, user flow-k, állapotok.
Ütközés esetén a DESIGN.md > 11 > 12 sorrend dönt.

NEM ALKUDHATÓ MEGKÖTÉSEK (a DESIGN.md-ből):
- Szín: kizárólag a szemantikus tokenek (bg #f8f6f2, surface #fff, accent #6d5dfc, ai #7c3aed, text #2f2a24). Nincs nyers hex, nincs nyers Tailwind hue (bg-amber-100 stb.), nincs #1a1a1a/fekete pill — aktív pill = accent-strong.
- Az `accent` (felhasználói akció) és az `ai` violet (AI-tartalom) két KÜLÖN szerep — soha ne mosd össze. A violet az AI egyetlen jele.
- Accent színű szöveg/link: accent-text (#342a91), soha nyers accent. Elsődleges gomb: accent-strong.
- text-faint csak dekoratív; információs kisszöveg text-muted.
- Kontraszt WCAG AA; focus-visible ring minden interaktív elemen; aria-label minden ikongombon.
- Mozgás: csak transform+opacity, prefers-reduced-motion tisztelve, semmi gradiens (kivéve az egyetlen AI-státusz mikro-highlight), semmi bounce, semmi >0.4s panelnyitás.
- Human-in-the-loop: AI-output SOHA nem íródik be automatikusan — eredmény-kártya Elfogad/Elvet gombbal, mindig látható modellnévvel + prompt-verzióval.
- Minden UI-felirat MAGYARUL (natív megfogalmazás).
- Layout: 3 panel — LeftSidebar 260px + MainWorkspace + RightInspector 360px + TopBar 52px + StatusBar 32px. h-dvh. Reszponzív összecsukás a DESIGN.md breakpointjai szerint.
- Stack-célzott kód: Next.js 15 (App Router) + React + TypeScript + Tailwind CSS 4 + shadcn/ui (Radix) + Framer Motion 11 + Tiptap + Lucide React.

KIMENET FORMÁTUMA minden képernyőhöz:
- Rövid layout-leírás (mely zónák, mely komponensek).
- A képernyő light témában, a DESIGN.md tokenjeivel; mutasd az alap + ÜRES + BETÖLTÉS + HIBA állapotot.
- Konkrét Tailwind/shadcn osztályok és Lucide ikonnevek (a DESIGN.md ikon-referenciájából).
- Hol és milyen Framer Motion animáció (a DESIGN.md motion-tokenjeivel).

KEZDD EZZEL — a Write View-val (ez a hero képernyő):
A központi Literata kézirat-szerkesztő (max-w-65ch), bal oldali összecsukható fejezet-fával, kijelölésre megjelenő floating bubble menüvel (Átírás/Leírás/Bővítés/Vizualizáció), és a jobb oldali AI panellel, amelynek eredmény-kártyája mutatja a modellt + prompt-verziót + Codex-kontextust, Elfogad/Elvet gombokkal. Alul StatusBar: szószám (tabular-nums) + autosave + modell-badge.

Mutasd a Write View-t, majd álljunk meg — utána lépünk a Plan Boardra, a Codexre, és a többi képernyőre a 12-es doksi sorrendjében. Tegyél fel kérdést, ha bármelyik megkötés ütközik.
```

---

## Rövid indító prompt (ha nem fér be a teljes)

```
Tervezd meg a ForgeWriter AI UI-ját — lokális-first, magyar AI regényíró „writer's cockpit" (NEM chatbot, NEM NovelCrafter-klón). Kövesd a 3 csatolt doksit: DESIGN.md (token-rendszer = igazságforrás), 11 (képernyő vizuális specek), 12 (funkciók/képernyők). Megkötések: csak szemantikus tokenek (accent #6d5dfc = felhasználó, ai #7c3aed = AI, külön szerep), WCAG AA kontraszt, focus-visible, csak transform/opacity animáció, human-in-the-loop (AI sosem ír be auto), minden felirat magyarul, 3-panel layout (260/­flex/360, TopBar 52, StatusBar 32). Next.js 15 + Tailwind 4 + shadcn/ui + Framer Motion + Tiptap + Lucide. Kezdd a Write View-val (Literata editor + bubble menu + AI eredmény-kártya), alap + üres + betöltés + hiba állapottal, majd állj meg.
```

---

## Folytató promptok (a Write View után)

Másold be sorban, ahogy haladsz:

```
Most a Plan Boardot — Felvonás/Fejezet/Jelenet rács. SceneCard: cím, POV badge (token --pov-1..6 karakterenként), összefoglaló, státusz badge ikonnal, szószám. Üres + betöltés állapottal. (11 §7C, 12 §4.3.)
```

```
Most a Codex Sidebart + Karakter Detailt. Sidebar: Codex/Snippets/Chats tabok, keresés, Új bejegyzés dropdown, ai_visible kapcsoló. Karakter Detail: Részletek/Kapcsolatok/Megemlítések/Nyomon követés tabok, aliasok, portré. (11 §7G–7H, 12 §4.8–4.9.)
```

```
Most a Projektek dashboardot + Új könyv wizardot (3 lépés). (11 §7A–7B, 12 §4.1–4.2.)
```

```
Most a Describe panelt (6 érzéki csatorna) + Scene Beat generáló inline kártyát. (11 §7E–7F, 12 §4.6–4.7.)
```

```
Most az Export nézetet + Beállításokat (modell-providerek, health-check, paraméterek; modellnevek a ModelRouterből, nem hardcode). (12 §4.14–4.15.)
```
