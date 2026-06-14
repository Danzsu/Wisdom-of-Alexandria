# 12 — Claude Design Feature Prompt

Ez a prompt azt írja le, **MIT** tervezzen meg a Claude Design — a teljes funkcionális scope-ot, a képernyő-inventárt és a user flow-kat. A **HOGYAN néz ki** a `DESIGN.md` (token-rendszer) és a `11_claude_design_prompt.md` (képernyő vizuális specek) dolga. A három doksit együtt add be.

> Prioritás-jelölés: **MVP** = első használható verzió · **V1** = teljes írói workspace · **V2** = agentic automatizáció. Az MVP-képernyőket tervezd meg először; a V1/V2 elemeket úgy helyezd el, hogy a layout később elférjen velük (ne kelljen újratervezni).

---

## 1. Termék és felhasználó

**ForgeWriter AI** — lokális-first, magyar-elsődleges AI regényíró munkaterület. Strukturált „writer's cockpit", nem chatbot.

**A felhasználó:** magyar nyelven hosszú-formájú fikciót író szerző, aki egyszerre tervez (struktúra, Codex) és ír (kézirat), és az AI-t kontrollált, jóváhagyáshoz kötött asszisztensként használja.

**Fő munkamenetek (jobs-to-be-done):**

1. Projektet/könyvet hoz létre és strukturálja (felvonás → fejezet → jelenet → beat).
2. Felépíti a Codexet (karakterek, helyszínek, világépítés) és összekapcsolja a kézirattal.
3. Ír a kézirat-szerkesztőben, kijelölésre AI-műveleteket hív (átírás, leírás, bővítés).
4. Beat-ekből jelenetet generáltat, majd **jóváhagyja vagy elveti** (soha nincs auto-beszúrás).
5. Folytonosságot ellenőriztet, verziókat néz vissza, exportál.

---

## 2. Információs architektúra (navigáció)

Bal oldali fő navigáció (LeftSidebar) — workspace szekciók:

```
LayoutDashboard  Áttekintés      (Overview)        MVP
BookOpen         Terv            (Plan board)      MVP
PenLine          Írás            (Write / editor)  MVP
Database         Codex                             MVP
MessageSquare    Chat                              V1
ScanEye          Áttekintés/Review                 V1
CalendarDays     Idősor          (Timeline)        V1
Network          Kapcsolatok     (Relations)       V1
Bot              AI feladatok    (Jobs)            V1
Download         Export                            MVP
Settings         Beállítások                       MVP
```

A LeftSidebar alja: összecsukható **könyv-fa** (Felvonás → Fejezet → Jelenet), aktív jelenet kiemelve.

---

## 3. Képernyő-inventár (ezeket tervezd meg, prioritás-sorrendben)

| # | Képernyő | Prioritás | Vizuális spec |
|---|---|---|---|
| 1 | **Projektek dashboard** (üres + kitöltött) | MVP | `11` §7A |
| 2 | **Új könyv wizard** (3 lépés) | MVP | `11` §7B |
| 3 | **Plan Board** (Felvonás/Fejezet/Jelenet rács) | MVP* | `11` §7C |
| 4 | **Write View** (szerkesztő + bubble menu + AI panel) | MVP | `11` §7D |
| 5 | **AI panel** (akciók + eredmény-kártya) | MVP | `11` §7D |
| 6 | **Describe / Érzéki leírás panel** (6 csatorna) | MVP | `11` §7E |
| 7 | **Scene Beat generálás** (inline kártya) | MVP | `11` §7F |
| 8 | **Codex Sidebar + Új bejegyzés** | MVP | `11` §7G |
| 9 | **Karakter Detail** (tabok) | MVP | `11` §7H |
| 10 | **Scene context menü** (AI + model picker) | MVP | `09` Scene context |
| 11 | **Revision History panel** | V1 | `11` §7J |
| 12 | **Chat / Thread nézet** | V1 | `11` §7I |
| 13 | **Continuity / Warnings panel** | V1 | — (tervezd meg) |
| 14 | **Diff nézet** (AI-javaslat vs eredeti) | V1 | — (tervezd meg) |
| 15 | **Thesaurus panel** | V1 | `11` rövid |
| 16 | **Timeline nézet** | V1 | — (tervezd meg) |
| 17 | **Relations gráf** | V1 | — (tervezd meg) |
| 18 | **AI Jobs / generálási sor** | V1 | — (tervezd meg) |
| 19 | **Export nézet** (formátum + scope) | MVP | — (tervezd meg) |
| 20 | **Beállítások** (modellek, promptok, paraméterek) | MVP | — (tervezd meg) |

`*` A Plan Board MVP-ben egyszerűbb (lista + kártya), a drag-and-drop board V1.

---

## 4. Funkcionális követelmények képernyőnként

A vizuális részleteket a `11` adja; itt a **funkció és az állapotok** számítanak. Minden képernyőhöz tervezd meg az **üres / betöltés / hiba** állapotot is (lásd `DESIGN.md` „States").

### 4.1 Projektek dashboard — MVP
- Projektkártyák: cím, műfaj, nyelv, könyvszám, szószám, státusz, utolsó módosítás.
- „Folytasd, ahol abbahagytad" sor + „Összes projekt" rács/lista váltóval.
- Lokális modell-státusz jelző (Cpu badge, zöld/piros pont).
- CTA: „Új projekt" + „Kézirat importálása".
- Üres állapot: két dashed kártya (létrehozás / import).

### 4.2 Új könyv wizard — MVP
- 3 lépés: Alapadatok (cím, alcím, szerző, műfaj, **nyelv: Magyar/English**) → Stílus és AI (POV, idő, terjedelmi cél, stílusjegyek) → Összegzés.
- Borító-feltöltés (opcionális). Lépés-indikátor.

### 4.3 Plan Board — MVP (board V1)
- Hierarchia: **Felvonás → Fejezet (oszlop) → Jelenet (kártya)**.
- SceneCard: cím, **POV badge** (token `--pov-1..6`, karakterenként), összefoglaló, **státusz badge ikonnal** (tervezett/piszkozat/elkészült/végleges), szószám.
- Nézetváltó: Rács / Mátrix / Vázlat.
- V1: drag-and-drop (dnd-kit) fejezet- és jelenet-rendezés.
- Üres állapot: „Még nincs jelenet" + CTA.

### 4.4 Write View — MVP (a hero képernyő)
- Központi **Literata** szerkesztő, `max-w-[65ch]` measure, autosave-jelzővel.
- **Floating bubble menu** kijelölésre: Átírás / Leírás / Bővítés / Vizualizáció.
- **Slash `/` parancsmenü**: Jelenet beat, Folytatás írása, Codex progresszió, formázás.
- Bal: összecsukható fejezet-fa. Alul: StatusBar (szószám `tabular-nums`, autosave, modell).
- Codex-detektált nevek: alapból dotted underline (nem fill), opcionális kiemelés-kapcsoló.

### 4.5 AI panel (RightInspector) — MVP
- Tabok: **AI / Codex / Beats / Warnings / Metadata**.
- AI tab: kijelölt szöveg preview → akciógombok (Átírás, Leírás, Bővítés, Tömörítés, Párbeszéd, Javít) → egyéni utasítás → modellválasztó → **Generálás**.
- **Eredmény-kártya** (a „signature moment"): mutatja a **modell nevét + prompt-verziót + a behúzott Codex-kontextust**; gombok: **Elfogad / Elvet / Másol / Star (Snippet)**. Soha nem ír felül automatikusan — Revision-ként mentődik.

### 4.6 Describe / Érzéki leírás — MVP
- 6 csatorna: **Látás / Hang / Tapintás / Szag / Íz / Metafora** (V1: +Érzelmi atmoszféra).
- Csatorna kibontva: 2 alternatív bekezdés, mindegyik **Snippet-be menthető** (Star).

### 4.7 Scene Beat generálás — MVP
- Inline kártya a szerkesztőben: szószám-választó (200/400/600), egyéni utasítás, kontextus.
- Állapotok: generálás (indeterminate progress) → kész (Alkalmaz / Újra / Elvet / Szekció).

### 4.8 Codex — MVP
- Tabok: **Codex / Snippets / Chats**. Könyvborító thumbnail, keresés, szűrő.
- **Új bejegyzés** típusok: Karakter, Helyszín, Tárgy, Szervezet, Lore, Szabály, Esemény.
- Bejegyzés-kártya sűrűségi módok: Default / Compact / Slim.
- **`ai_visible` kapcsoló** minden entryn (spoiler-védelem — „Rejtett az AI-tól", Eye-off ikon).
- **Aliasok** mező (név-detektáláshoz).

### 4.9 Karakter Detail — MVP
- Fejléc: típus, név, portré (feltölthető), megemlítések száma.
- Tabok: **Részletek / Kutatás / Kapcsolatok / Megemlítések / Nyomon követés**.
- Részletek: Aliasok (AI-javaslattal), Leírás (AI-javaslattal), Story Role.
- Nyomon követés: „Track by name/alias" + AI-kontextus mód (mindig / ha felismerve).
- V1: Kapcsolatok (relations), Progressions (temporális Codex állapot).

### 4.10 Continuity / Warnings — V1
- Folytonossági figyelmeztetések: karakter / helyszín / idősor / lore.
- Súlyosság: info / warning / critical (szín + ikon, soha nem csak szín).
- Konkrét szövegrészre hivatkozás, ugrás a jelenetre.

### 4.11 Revision History — V1
- Kétpaneles: bal szövegelőzmény, jobb idővonal-lista (időbélyeg, szerző, AI-badge).
- Visszaállítás gomb. (Diff nézet külön, §4.12.)

### 4.12 Diff nézet — V1
- AI-javaslat vs eredeti, szín-kódolt különbségek (token: hozzáadás `success`, törlés `danger`).
- Elfogad / elvet / finomít.

### 4.13 Chat / Thread — V1
- Projektkontextust használó chat; **@Codex mention** (dashed accent box).
- Kontextus-választó (jelenet / teljes regény / Codex). Modellválasztó. Üres állapot.

### 4.14 Export — MVP
- Formátum: **Markdown, DOCX** (MVP) · EPUB, PDF (V1).
- Scope: teljes könyv / fejezet / jelenet. Fájlnév ékezet-mentesítve.
- Project backup JSON (MVP).

### 4.15 Beállítások — MVP
- **Modell-providerek** (Ollama, Gemini, OpenRouter): hozzáadás, health-check, kulcs-tárolás.
- Temperature / max tokens. Prompt-preset szerkesztő (V1). Task-based routing (V1).
- **Modellnevek a `ModelRouter`-ből** — soha nincs hardcode-olt modellnév a UI-ban.

---

## 5. Átfogó funkcionális elvek (minden képernyőre)

- **Human-in-the-loop:** AI-output mindig Revision-ként mentődik, kézi Elfogad/Elvet lépéssel. Soha nincs auto-beszúrás vagy néma felülírás.
- **AI-transzparencia:** minden AI-eredmény mutatja a modellt + prompt-verziót + a behúzott kontextust. Lokális vs felhő modell explicit badge (`Cpu` / `Cloud`).
- **Autosave:** nincs explicit „Mentés" gomb; az állapot mindig látszik (Mentve ✓ / Mentés…).
- **Magyar-first:** minden UI-felirat, tooltip, microcopy magyarul (natív megfogalmazás, nem fordítás). POV: „1. személy" / „3. személy (Korlátozott)". Tegezés default.
- **Akadálymentesség + token-fegyelem:** a `DESIGN.md` szabályai kötelezőek (focus-visible, aria-label ikongombokon, AlertDialog kaszkád-törléshez, WCAG kontraszt, prefers-reduced-motion, csak token-színek).
- **Teljesítmény:** hosszú listák (Codex, board, mentions) virtualizálva; keresés debounce-olva.

---

## 6. Mit tervezz meg ELŐSZÖR (MVP vágás)

Ebben a sorrendben kérek képernyőket:

1. **Write View** (a hero — szerkesztő + bubble menu + AI panel eredmény-kártyával)
2. **Plan Board** (Felvonás/Fejezet/Jelenet, SceneCard POV + státusz badge-ekkel)
3. **Codex Sidebar + Karakter Detail**
4. **Projektek dashboard + Új könyv wizard**
5. **Describe panel + Scene Beat generálás**
6. **Export + Beállítások**

Minden képernyőhöz: alap + **üres + betöltés + hiba** állapot, light témában, a `DESIGN.md` tokenjeivel. A V1/V2 elemekhez elég wireframe-szintű placeholder, de a layoutban legyen helyük.
