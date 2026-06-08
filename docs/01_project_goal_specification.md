# 01 — Projekt célja és specifikáció

## Projekt neve

**Saját agentic AI könyvíró platform**  
Munkanév: **NovaCraft / StoryForge / CodexWriter**

## Rövid projektdefiníció

A cél egy saját, lokálisan vagy saját szerveren futtatható, NovelCrafter-szerű agentic AI könyvíró rendszer megépítése, amely három termékmintát egyesít:

1. **NovelCrafter-szerű írói munkakörnyezet**  
   Projekt, könyv, sorozat, fejezet, jelenet, karakter, helyszín, világépítés, Codex / Story Bible, outline és manuscript editor.

2. **Sudowrite-szerű kreatív társszerző**  
   Brainstorming, rewrite, expand, describe, feedback, dialogue improvement, show-don’t-tell javítás, stílusváltás, magyar nyelvi finomítás.

3. **BookNova-szerű kontrollált automatizáció**  
   Plotból chapter outline, chapter outline-ból scene beat, scene beatből jelenetdraft, majd review, continuity check, rewrite és export.

A rendszer nem „egy prompttal teljes könyvet generál” típusú eszköz, hanem **írói operációs rendszer + agentic writing pipeline**.

---

## Elsődleges cél

Olyan platform létrehozása, amelyben az író:

- megtervezi a könyv univerzumát, karaktereit és cselekményét,
- strukturáltan kezeli a fejezeteket, jeleneteket és beateket,
- lokális vagy cloud AI-modellekkel gyorsan generál jelenet- és fejezetdraftokat,
- emberi kontrollal átnézi és javítja a generált szövegeket,
- automatikusan ellenőrzi a karakter-, világ-, idővonal- és stíluskonzisztenciát,
- magyar nyelven is természetesebb, koherensebb kéziratokat tud előállítani,
- végül Markdown, DOCX, EPUB vagy PDF formátumba exportálja a kéziratot.

---

## Termékvízió

A rendszer egy **AI-native írói workspace**, ahol az író nem csak egy üres dokumentumot lát, hanem egy teljes könyvprojektet:

- bal oldalon navigáció: könyvek, fejezetek, jelenetek, Codex;
- középen kéziratszerkesztő;
- jobb oldalon AI-asszisztens és kontextuspanel;
- külön nézetekben outline, timeline, karakterkapcsolatok és generálási queue;
- háttérben agentic workflow-k futnak: tervezés, draftolás, ellenőrzés, javítás, export.

A rendszer alapelve: **az író dönt, az AI gyorsít**.

---

## Célfelhasználók

### 1. Regényíró / hobbiíró

Olyan felhasználó, aki szeretné gyorsabban felépíteni és megírni a regényét, de meg akarja tartani a kreatív kontrollt.

### 2. AI-val dolgozó kreatív író

Olyan felhasználó, aki tudatosan használ AI-t ötletelésre, jelenetgenerálásra, rewrite-ra és szerkesztésre.

### 3. Magyar nyelvű szerző

Olyan író, akinek fontos a természetes magyar szöveg, a karakterhangok következetessége, a tegezés/magázás konzisztenciája és az angolos mondatszerkezetek kerülése.

### 4. Self-hosted / local-first felhasználó

Olyan felhasználó, aki nem akarja minden kéziratát SaaS szolgáltatásba feltölteni, hanem lokálisan vagy saját szerveren szeretné futtatni az írói rendszert.

---

## Fő termékpilléreket

### 1. Írói munkakörnyezet

- Projektkezelés
- Könyv- és sorozatkezelés
- Fejezetek és jelenetek kezelése
- Outline board
- Manuscript editor
- Codex / Story Bible
- Karakterek, helyszínek, világépítés
- Timeline és kapcsolati háló

### 2. AI kreatív copilot

- Brainstorm
- Rewrite
- Expand
- Compress
- Dialogue improvement
- Describe
- Feedback
- Magyar nyelvi polish
- Kreatív folytatási javaslatok

### 3. Agentic automatizáció

- Story Architect Agent
- Character Designer Agent
- Worldbuilding Agent
- Plotline Agent
- Chapter Planner Agent
- Scene Writer Agent
- Dialogue Agent
- Style Editor Agent
- Continuity Checker Agent
- Lore Consistency Agent
- Hungarian Language Editor Agent
- Developmental Editor Agent
- Final Polish Agent
- Export Agent

### 4. Story memory és RAG

- Codex retrieval
- Chapter summary memory
- Scene summary memory
- Character state memory
- Timeline memory
- Style guide retrieval
- Hybrid search: keyword + vector search

### 5. Export és publishing pipeline

- Markdown export
- DOCX export
- EPUB export
- PDF export
- később KDP-ready formázás

---

## Termékpozicionálás

A célrendszer nem egyszerűen „AI book generator”, hanem:

> **NovelCrafter-szerű írói rendszer + Sudowrite-szerű kreatív eszközök + BookNova-szerű fejezetautomatizálás, lokális és hibrid AI-modellekkel.**

---

## MVP célja

Az MVP célja nem a teljes automatizált könyvírás, hanem egy működő **NovelCrafter-core** létrehozása.

### MVP-ben legyen

- Projekt létrehozása
- Könyv létrehozása
- Fejezetek létrehozása
- Jelenetek létrehozása
- Scene beat-ek kezelése
- Codex alapverzió
- Karakterek kezelése
- Helyszínek kezelése
- Világépítési bejegyzések kezelése
- Rich text editor
- AI panel Ollama/local modell kapcsolattal
- Kijelölt szöveg rewrite-ja
- Scene beatből rövid jelenetdraft
- Chapter/scene summary mentése
- Markdown és DOCX export

### MVP-ben nem kell még

- teljes könyv automatikus generálása
- többfelhasználós collaboration
- marketplace / plugin rendszer
- cover generation
- KDP launch kit
- teljes desktop app
- komplex fine-tuning pipeline

---

## V1 célja

A V1 célja, hogy a rendszer már valódi AI writing workspace legyen.

### V1-ben legyen

- Drag-and-drop outline board
- Scene card nézet
- Tiptap-alapú manuscript editor
- AI suggestion bubble menu
- Brainstorm panel
- Rewrite módok
- Expand / Compress
- Dialogue improver
- Show-don’t-tell javító
- Magyar stílusellenőrző
- Codexből történő RAG retrieval
- Qdrant vector search
- PostgreSQL full-text search
- Generation queue hosszabb AI-jobokhoz
- Review / diff panel
- Continuity warning panel
- EPUB export

---

## V2 célja

A V2 célja a BookNova-szerű agentic automatizáció emberi kontrollal.

### V2-ben legyen

- Chapter Planner Agent
- Scene Writer Agent
- Continuity Checker Agent
- Hungarian Language Editor Agent
- Developmental Editor Agent
- többkörös chapter generation pipeline
- batch scene generation
- teljes chapter review
- teljes könyv kohézió audit
- karakterhang-ellenőrzés
- stílus harmonizálás
- automatikus chapter summary update
- workflow score gate
- manuális approve/regenerate/edit lépések

---

## Nem célok az első szakaszban

- Nem cél teljes értékű SaaS-termék azonnali építése.
- Nem cél minden NovelCrafter/Sudowrite/BookNova funkció lemásolása.
- Nem cél saját foundation model fejlesztése.
- Nem cél teljesen automatikus, ember nélkül publikálható könyv generálása.
- Nem cél a kész open-source writer appok közvetlen forkja, ha licenc vagy architektúra miatt kockázatos.

---

## Fő sikerfeltételek

A projekt akkor tekinthető sikeresnek, ha:

1. az író egy teljes könyvstruktúrát tud kezelni;
2. a Codexből az AI releváns kontextust tud használni;
3. a lokális modell képes magyar nyelvű jelenetdraftokat generálni;
4. az AI-javaslatok nem írják felül automatikusan az emberi döntést;
5. a rendszer képes chapter summary és continuity memory frissítésre;
6. exportálható, használható kézirat készül;
7. a teljes workflow később cloud reviewer modellekkel is bővíthető.

---

## Első validációs teszt

Az első technikai és minőségi validáció legyen:

1. hozz létre 1 projektet;
2. adj meg 3 karaktert;
3. adj meg 1 helyszínt;
4. adj meg 1 chapter outline-t;
5. adj meg 5 scene beatet;
6. generáltass egy 1500–2500 szavas magyar jelenetet lokális modellel;
7. futtasd le rá a magyar stílusellenőrzést;
8. futtasd le rá a continuity checket;
9. hasonlítsd össze az eredeti és javított draftot.

A projekt akkor mehet tovább V1 irányba, ha a generált jelenet:

- érthető,
- magyarul természetes,
- nem túl sablonos,
- tartja a karakterek alapadatait,
- követi a scene beat-eket,
- kézzel gyorsabban javítható, mint nulláról megírható.

---

## Ajánlott fejlesztési sorrend

1. Adatmodell és API alapok
2. Projekt / könyv / fejezet / jelenet CRUD
3. Codex CRUD
4. Manuscript editor
5. AI panel local modellel
6. Rewrite és scene draft funkció
7. Summary memory
8. Qdrant retrieval
9. Review/diff panel
10. Continuity checker
11. Chapter pipeline
12. Export pipeline
13. Desktop/local-first csomagolás

---

## Claude Code számára elvárt munkamód

A Claude Code tervezésnél az alábbi szemléletet kövesse:

- Ne próbálja egyszerre megépíteni a teljes rendszert.
- Először stabil adatmodellt és CRUD API-t hozzon létre.
- Az AI-funkciókat model-routeren keresztül építse be.
- Minden hosszabb AI-job queue-ba kerüljön.
- A generált szöveget soha ne írja felül automatikusan jóváhagyás nélkül.
- Minden AI-output verziózott revisionként tárolódjon.
- A rendszer legyen local-first kompatibilis.
- A modellréteg legyen cserélhető.
- A magyar nyelvi promptok külön presetként legyenek kezelve.
