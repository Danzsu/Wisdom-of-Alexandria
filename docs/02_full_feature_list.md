# 02 — Teljes funkciólista

Ez a dokumentum a saját agentic AI könyvíró platform teljes funkciólistáját tartalmazza MVP, V1 és V2 bontásban.

Jelölések:

- **MVP**: első használható verzió
- **V1**: NovelCrafter-szerű, már komolyabban használható írói workspace
- **V2**: agentic, automatizált, Sudowrite + BookNova-szerű kreatív és chapter generation rendszer
- **Later**: későbbi, nem kritikus funkció

---

## 1. Projekt- és könyvkezelés

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Projekt létrehozása | MVP | Egy írói projekt létrehozása címmel, leírással, nyelvvel, műfajjal |
| Projekt dashboard | MVP | Projektek listája, státusz, word count, utolsó módosítás |
| Könyv létrehozása | MVP | Egy projekten belül könyv kezelése |
| Sorozat / univerzum kezelés | V1 | Több könyv egy közös univerzumban |
| Könyvmetaadatok | MVP | Cím, alcím, szerző, műfaj, cél word count, státusz |
| Projekt státusz | V1 | Planning, Drafting, Editing, Final, Exported |
| Word count tracking | V1 | Teljes könyv, chapter és scene word count |
| Progress dashboard | V1 | Haladás, készültség, hiányzó fejezetek |
| Projekt sablonok | Later | Regény, novella, non-fiction, gyerekkönyv, workbook |

---

## 2. Manuscript struktúra

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Chapter CRUD | MVP | Fejezetek létrehozása, szerkesztése, törlése |
| Scene CRUD | MVP | Jelenetek létrehozása, szerkesztése, törlése |
| Beat CRUD | MVP | Scene beat-ek kezelése: goal, conflict, turn, outcome |
| Chapter sorrend | MVP | Fejezetek kézi rendezése |
| Scene sorrend | MVP | Jelenetek sorrendezése fejezeten belül |
| Act struktúra | V1 | Act I / II / III vagy saját act struktúra |
| Scene card nézet | V1 | Jelenetek kártyaként, státusszal és összefoglalóval |
| Drag-and-drop scene board | V1 | Fejezetek és jelenetek vizuális rendezése |
| Chapter outline | MVP | Fejezet célja, summary, kulcsesemények |
| Scene outline | MVP | POV, helyszín, karakterek, konfliktus, outcome |
| Subplot hozzárendelés | V1 | Jelenetek több subplothoz kötése |
| Scene státusz | V1 | Planned, Drafted, Reviewed, Revised, Approved |
| Chapter státusz | V1 | Planned, Drafting, Needs Review, Approved |
| Chapter dependency | V2 | Fejezetek közti függések, előzmények, setup/payoff |

---

## 3. Codex / Story Bible

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Codex dashboard | MVP | Karakterek, helyszínek, világépítési elemek listája |
| Codex típusok | MVP | Character, Location, Object, Organization, Lore, Rule, Event |
| Egyedi Codex típusok | V1 | Felhasználó által létrehozható típusok |
| Karakterprofil | MVP | Név, szerep, leírás, cél, motiváció, félelem, konfliktus |
| Karakter aliasok | MVP | Több név / becenév egy entryhez (detektáláshoz és contexthez) |
| Codex AI láthatóság | MVP | ai_visible boolean — entry elrejtése az AI elől (spoiler védelem) |
| Codex Relations (séma) | MVP | CodexRelation tábla — entryk közti kapcsolatok; UI V1-ben jön |
| Codex Progressions (séma) | MVP | CodexProgression tábla — temporális Codex változások séma szinten; AI V1-ben figyeli |
| Karakterhang | V1 | Beszédstílus, szóhasználat, tiltott fordulatok |
| Karakterív | V1 | Starting state, midpoint state, final state |
| Karakterkapcsolatok | V1 | Relationship graph, kapcsolat típusa és leírása |
| Codex Progressions (UI + AI) | V1 | Temporális Codex state UI-ban: mikor aktiválódik, AI figyeli scene context alapján |
| Codex Relations (UI) | V1 | Kapcsolatok vizuális megjelenítése, auto context expansion |
| AI Visibility per trait | V1 | Mezőszintű AI láthatóság (pl. csak a gyilkos motívuma rejtett) |
| Helyszínprofil | MVP | Leírás, hangulat, szabályok, kapcsolódó jelenetek |
| Világépítési bejegyzések | MVP | Társadalom, technológia, mágia, politika, szabályok |
| Snippet / notes | V1 | Félretett szövegek, töredékek, to-do-k, kutatási jegyzetek |
| Timeline event | V1 | Események időrendben |
| Scene archive (soft delete) | V1 | Jelenetek archiválása törlés helyett |
| Codex quick create | V1 | AI vagy kijelölt szöveg alapján gyors Codex bejegyzés |
| AI character extraction | V2 | Szövegből karakterek automatikus kinyerése |
| AI location extraction | V2 | Szövegből helyszínek automatikus kinyerése |
| Codex consistency check | V2 | Ellentmondások keresése Codex és kézirat között |
| Codex RAG index | V1 | Codex bejegyzések pgvector-alapú vektorizálása retrievalhez |

---

## 4. Írói editor

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Rich text editor | MVP | Tiptap-alapú szerkesztő jelenetekhez |
| Markdown kompatibilis mentés | MVP | Exportbarát belső tárolás |
| Autosave | MVP | Automatikus mentés |
| Scene title és metadata panel | MVP | POV, helyszín, idő, karakterek |
| Split view | V1 | Bal: scene lista, közép: editor, jobb: Codex/AI panel |
| Inline AI selection | V1 | Kijelölt szövegre AI-műveletek |
| Bubble menu AI actions | V1 | Rewrite, Expand, Improve dialogue, Polish Hungarian |
| Comment / annotation | V1 | Szerkesztői kommentek |
| Diff view | V1 | AI-javaslat vs eredeti szöveg |
| Revision history | V1 | Korábbi verziók visszanézése |
| Track changes jelleg | V2 | Elfogadható/elutasítható AI módosítások |
| Focus writing mode | Later | Zavaró UI nélküli írás |
| Typewriter mode | Later | Írói UX extra |

---

## 5. AI Assistant panel

| Funkció | Prioritás | Leírás |
|---|---:|---|
| AI chat panel | MVP | Projektkontextust használó chat |
| Model választás | MVP | Local / cloud model kiválasztása |
| Prompt preset választás | MVP | Brainstorm, rewrite, draft, review sablonok |
| Kijelölt szöveg beküldése | MVP | Editor selection alapján AI kérés |
| Kontextusválasztó | V1 | Codex, chapter summary, previous scene, style guide kiválasztása |
| AI válasz mentése revisionként | MVP | Output mentése, nem automatikus felülírás |
| AI output beszúrás | MVP | Insert / Replace / Append opciók |
| Quick Edit (Ctrl+K) | V1 | Inline AI szerkesztés: instrukció → áthúzott eredeti + új szöveg → accept/reject/refine |
| Prompt Preview | V1 | Pontosan látható / másolható, mi megy az AI-nak (kontextus transzparencia) |
| Saliency Engine | V1 | Okos context selection: az AI nem kap mindent, csak a relevánsat |
| Streaming válasz | V1 | SSE vagy WebSocket streaming |
| AI history | V1 | Korábbi promptok és válaszok listája |
| Prompt debugger | Later | Milyen kontextust kapott az AI |

---

## 6. Sudowrite-szerű kreatív funkciók

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Brainstorm | V1 | Ötletek, konfliktusok, fordulatok |
| Brainstorm Keepers List | V1 | Jó ötletek mentése listába, rosszak eldobása |
| Alternative plot ideas | V1 | Több cselekményirány |
| Scene continuation (Auto) | MVP | Jelenet folytatása instrukció nélkül |
| Scene continuation (Guided) | V1 | Jelenet folytatása user instrukció alapján |
| Rewrite | MVP | Kijelölt szöveg újraírása |
| Rewrite modes | V1 | Rövidebb, drámaibb, természetesebb, irodalmibb, sötétebb |
| Expand | V1 | Rövid szöveg kibővítése |
| Compress | V1 | Túl hosszú szöveg tömörítése |
| Describe (sensory) | MVP | Érzékletes leírás generálása érzékszervenként: Látás, Hang, Tapintás, Szag, Íz, Metaforák — kártyánként, Snippet-be menthetők |
| Describe — Érzelmi atmoszféra (7. csatorna) | V1 | Magyar prózára specifikus extra csatorna: érzelmi és hangulati atmoszféra leírása |
| Dialogue improvement | V1 | Párbeszéd természetesebbé tétele |
| Show, don’t tell | V1 | Magyarázó részek jelenetszerűsítése |
| Character voice rewrite | V2 | Adott karakter hangjára írás |
| Mood shift | V2 | Hangulatváltás: feszültebb, könnyedebb, baljósabb |
| Feedback (margin comments) | V1 | Szerkesztői margókommentek jelenetre/fejezetre, Story Bible-aware |
| Beta reader simulation | V2 | Olvasói reakciók szimulálása |
| Visualize prompt | Later | Képalkotó prompt karakterhez/helyszínhez |

---

## 7. BookNova-szerű automatizáció

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Plotból chapter outline | V1 | Fő plotpontokból fejezetvázlat |
| Chapterből scene lista | V1 | Fejezetcélból jelenetlista |
| Scene beat generation | MVP | Jelenetcélból beat lista |
| Beatből scene draft | MVP | Beat-ekből jelenet első draftja |
| Chapter batch generation | V2 | Több jelenet/fejezet háttérben generálása — **megvalósítva (V2 első szelet, fejezet-szint)** (`POST /ai/chapters/{id}/generate` + `run_chapter_generation_job` RQ worker: jelenetenként a beat-ekből, egyetlen RQ háttér-job, jelenetenként egy jóvá nem hagyott Revision = HITL, opcionális folytonosság-ellenőrzés; a könyv-szint későbbi bővítés). Lásd `docs/17` |
| Chapter opening variation | V2 | Nyitási technikák rotálása |
| Chapter ending awareness | V2 | Következő chapter előkészítése |
| Setup/payoff tracking | V2 | Elültetés és későbbi kifizetés követése |
| Plot-twist audit | V2 | Fordulatok ellenőrzése és javaslata |
| Full book cohesion audit | V2 | Teljes kézirat kohézióvizsgálata |
| Automated revision loop | V2 | Draft → critique → rewrite → review |

---

## 8. Agentek

| Agent | Prioritás | Feladat |
|---|---:|---|
| Story Architect Agent | V2 | Teljes story structure, actok, fő konfliktusok |
| Character Designer Agent | V1 | Karakterprofilok és motivációk generálása |
| Worldbuilding Agent | V1 | Világszabályok, helyszínek, lore kialakítása |
| Plotline Agent | V1 | Plotline és subplotok tervezése |
| Chapter Planner Agent | V1 | Fejezetvázlat készítése |
| Scene Planner Agent | MVP | Scene beat-ek készítése |
| Scene Writer Agent | MVP | Jelenetdraft generálása |
| Dialogue Agent | V1 | Párbeszédek javítása |
| Style Editor Agent | V1 | Stílus, ritmus, hangulat javítása |
| Continuity Checker Agent | V1 | Ellentmondások keresése |
| Lore Consistency Agent | V2 | Világépítési szabályok ellenőrzése |
| Hungarian Language Editor Agent | V1 | Magyar nyelvi természetesség javítása |
| Developmental Editor Agent | V2 | Dramaturgia, tempó, szerkezet kritikája |
| Final Polish Agent | V2 | Végső stiláris/nyelvi polish |
| Export Agent | V1 | Exportformátumok előállítása |

---

## 9. Magyar nyelvi funkciók

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Magyar prompt presetek | MVP | Minden fő AI-funkcióhoz magyar system/user prompt |
| Tegezés/magázás szabály | V1 | Karakterenként és kapcsolatként megadható |
| Angolos szerkezetek jelzése | V1 | Természetellenes mondatok kiszűrése |
| Modorosság jelzése | V1 | Túlírtság, közhely, patetikus fordulatok |
| Ismétlésdetektor | V1 | Szavak, mondatszerkezetek, képek ismétlése |
| Párbeszéd természetesség | V1 | Magyar beszélt nyelvhez igazítás |
| Karakterhang magyarul | V2 | Karakterenként eltérő szóhasználat |
| Stíluslap | MVP | Hangnem, tiltott fordulatok, preferált stílus |
| Magyar proofread pass | V2 | Végső nyelvi ellenőrzés |

---

## 10. Retrieval, memória és keresés

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Chapter summary | MVP | Fejezet rövid összefoglalója |
| Scene summary | MVP | Jelenet rövid összefoglalója |
| Character state memory | V1 | Karakter aktuális állapota fejezetenként |
| Timeline memory | V1 | Időrendi események |
| Codex embedding | V1 | Codex bejegyzések pgvector-alapú vektoros indexelése |
| Scene embedding | V1 | Jelenetek és summary-k indexelése |
| Hybrid search | V1 | Keyword + vector search |
| Context pack builder | V1 | AI kéréshez releváns kontextuscsomag |
| Saliency Engine | V1 | Okos context selection: relevancia alapján szűr, nem dumpol mindent |
| Chapter Continuity linking | V1 | Dokumentumok összekapcsolása; AI visszaolvashat előző fejezetekből (akár 20k szó) |
| Codex Progression context | V1 | Az AI csak a scene aktuális idejéig érvényes Codex állapotot kapja — **megvalósítva** (join-alapú „állapot az N. jelenetnél" RAG-szűrés). Lásd `docs/17` |
| Long context compression | V2 | Régi fejezetek tömörített memóriája |
| Memory update after approval | V1 | Csak jóváhagyott szöveg kerüljön memóriába |

---

## 11. Review és quality gate

| Funkció | Prioritás | Leírás |
|---|---:|---|
| AI critique | V1 | Jelenet/fejezet kritikája |
| Continuity warning | V1 | Karakter, helyszín, timeline ellentmondások |
| Style score | V2 | Stílusminőség pontozása |
| Pacing score | V2 | Tempó és feszültség értékelése |
| Dialogue score | V2 | Párbeszédminőség értékelése |
| Evidence-required critique | V2 | Kritika konkrét szövegrészre hivatkozva |
| Quality gate | V2 | 1–5 pont, regenerate/edit/approve döntés |
| Human approval step | MVP | AI-output manuális jóváhagyása |
| Regenerate with constraints | V1 | Újragenerálás célzott instrukciókkal |

---

## 12. Export és import

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Markdown export | MVP | Teljes kézirat Markdownban |
| DOCX export | MVP | Word kompatibilis export |
| EPUB export | V1 | E-book export |
| PDF export | V1 | Olvasható PDF export — **megvalósítva** (`pandoc --pdf-engine=weasyprint`; motor hiányában kecses 503). Lásd `docs/17` |
| Chapter-only export | V1 | Egy fejezet exportja |
| Scene-only export | V1 | Egy jelenet exportja |
| Project backup JSON | MVP | Teljes projekt adatmentés |
| Project import JSON | V1 | Projekt visszatöltése |
| Markdown import | V1 | Meglévő kézirat import |
| DOCX import | V2 | Word dokumentum import |
| KDP formatting | Later | KDP-ready formázási opciók |

---

## 13. Settings és model management

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Model provider settings | MVP | Ollama, OpenAI-compatible, Gemini, OpenRouter stb. |
| Model collection | V1 | Feladatokhoz modellek csoportosítása |
| Prompt preset editor | V1 | Promptok szerkesztése UI-ból — **megvalósítva** (valódi `PromptTemplate` DB-entitás + migráció `b3c5d7e9f1a2` + 6 beépített seed + teljes CRUD API (builtin = immutable) + létrehozó/szerkesztő/törlő UI). Lásd `docs/17` |
| Temperature / max tokens | MVP | Modellparaméterek beállítása |
| Local model health check | MVP | Ollama elérhetőség tesztelése |
| Cloud API key storage | V1 | Biztonságos API kulcs kezelés |
| Task-based routing | V1 | Draft local, review cloud stb. |
| Cost estimate | V2 | Cloud modellköltség becslés |

---

## 14. Collaboration és későbbi funkciók

| Funkció | Prioritás | Leírás |
|---|---:|---|
| Többfelhasználós projekt | Later | Co-authoring |
| Kommentelés más felhasználóval | Later | Szerkesztői review |
| Role-based access | Later | Owner, editor, viewer |
| Cloud sync | Later | Desktop/local-first szinkron |
| Plugin rendszer | Later | Külső AI tools / promptok |
| Marketplace | Later | Promptok, sablonok, export template-ek |
| Cover generation | Later | Borító és karakterkép generálás — **megvalósítva** (Phase 1: Codex karakter/helyszín képgenerálás `MediaAsset` + RQ job + Codex „Képek" panel, HITL; Phase 2: könyv-borító-generátor art + app-oldali tipográfia-kompozit a KDP-biztonsági zónán belül + borító-panel). Lásd `docs/17` |
| Launch kit | Later | Fülszöveg, marketing copy, KDP metadata |

---

## 15. MVP release checklist

Az MVP akkor kész, ha az alábbiak működnek:

- [ ] Projekt létrehozása
- [ ] Könyv létrehozása
- [ ] Chapter CRUD
- [ ] Scene CRUD
- [ ] Beat CRUD
- [ ] Character CRUD
- [ ] Location CRUD
- [ ] Worldbuilding entry CRUD
- [ ] Tiptap editor mentéssel
- [ ] Ollama kapcsolat
- [ ] Rewrite selected text
- [ ] Generate scene from beats
- [ ] Save AI output as revision
- [ ] Manual approve/insert
- [ ] Scene summary generation
- [ ] Describe sensory rewriting (érzékletes leírás, 6 csatorna)
- [ ] Markdown export
- [ ] DOCX export
- [ ] Docker Compose local setup

---

## 16. V1 release checklist

- [ ] Drag-and-drop outline board
- [ ] Codex RAG pgvector-rel
- [ ] AI context pack builder
- [ ] Saliency Engine (okos context selection)
- [ ] Chapter Continuity linking
- [ ] Codex Progressions UI + AI filtering
- [ ] CodexRelation UI + context expansion
- [ ] AI Visibility per trait (mezőszintű)
- [ ] Quick Edit (Ctrl+K) inline
- [ ] Prompt Preview / context transparency
- [ ] Brainstorm funkció + Keepers List
- [ ] Scene continuation Guided mode
- [ ] Describe — Érzelmi atmoszféra (7. csatorna)
- [ ] Expand / Compress
- [ ] Dialogue improver
- [ ] Feedback margin comments
- [ ] Hungarian style editor
- [ ] Continuity checker
- [ ] Diff panel
- [ ] Revision history
- [ ] Snippet modul
- [ ] Scene archive (soft delete)
- [ ] Generation queue
- [ ] EPUB export

---

## 17. V2 release checklist

- [ ] PydanticAI chapter pipeline
- [ ] Chapter Planner Agent
- [ ] Scene Writer Agent
- [ ] Continuity Checker Agent
- [ ] Hungarian Language Editor Agent
- [ ] Developmental Editor Agent
- [ ] Quality gate scoring
- [ ] Batch chapter generation
- [ ] Full book cohesion audit
- [ ] Character voice consistency audit
- [ ] Cloud reviewer routing
- [ ] Tauri desktop packaging
