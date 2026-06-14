# ForgeWriter AI

**Lokális, agentic AI könyvíró munkakörnyezet — hosszú szépirodalmi alkotáshoz, elsősorban magyar nyelvű regényíráshoz.**

> NovelCrafter-szerű írói workspace + Sudowrite-szerű kreatív társszerző + BookNova-szerű fejezetautomatizálás — saját szerveren vagy lokálisan futtatva, privát adatokkal.

---

## Mi ez?

A ForgeWriter AI nem egy általános AI chatbot és nem egy "egy gombnyomásra kész könyv" generátor.

Ez egy **strukturált írói operációs rendszer**, ahol az AI be van ágyazva a munkafolyamatba:

- bal oldali navigáció a könyvstruktúrához (projektek, könyvek, fejezetek, jelenetek)
- középső kéziratszerkesztő és tervező tábla
- jobb oldali kontextuspanel (Codex, AI asszisztens, figyelmeztetések)
- háttérben futó agentic workflow-k: tervezés, draftolás, ellenőrzés, javítás, export

**Az alapelv: az író dönt, az AI gyorsít.**

---

## Fő funkciók

### Írói munkakörnyezet

- projekt-, könyv- és sorozatkezelés
- fejezetek, jelenetek, beat-ek strukturált kezelése
- Tiptap-alapú kéziratszerkesztő, autosave-vel
- drag-and-drop outline tábla és jelenetkártyák
- Codex / Story Bible: karakterek, helyszínek, világépítési bejegyzések, idővonal

### AI kreatív copilot

- kijelölt szöveg átírása (rewrite), kibővítése, tömörítése
- párbeszédjavítás, show-don't-tell konverzió
- brainstorming: ötletek, fordulatok, cselekményirányok
- jelenetdraft generálása beat-ekből
- magyar stílusellenőrzés és természetesség javítása
- folytatási javaslatok

### Agentic automatizálás (V1+)

- Scene Writer Agent — jelenetdraft kontextusból
- Continuity Checker Agent — ellentmondások keresése
- Hungarian Language Editor Agent — természetes magyar szöveg
- Chapter Planner Agent — fejezetvázlat plotból
- Developmental Editor Agent — dramaturgia, tempó, szerkezet kritika

### Memory és retrieval

- Codex bejegyzések pgvector-alapú szemantikus indexelése
- jelenet- és fejezetsummary-k
- karakter állapotmemória
- context pack builder: releváns kontextus összeállítása AI kéréshez

### Export

- Markdown (MVP)
- DOCX — Pandoc (V1)
- EPUB — Pandoc (V1)
- PDF — Pandoc + LaTeX (V2)

---

## Tech stack

### Frontend

| Réteg | Technológia |
| --- | --- |
| Framework | Next.js 15 (App Router) |
| Nyelv | TypeScript strict |
| Stílus | Tailwind CSS 4.x + shadcn/ui |
| Animáció | Framer Motion 11.x |
| Editor | Tiptap 2.x |
| State | Zustand 5.x + TanStack Query 5.x |
| Forms | React Hook Form + Zod |
| Drag-and-drop | dnd-kit (V1) |
| Graph / map | React Flow / xyflow (V1) |
| Ikonok | Lucide React |

### Backend

| Réteg | Technológia |
| --- | --- |
| Framework | FastAPI 0.115.x |
| Validáció | Pydantic 2.x |
| ORM | SQLAlchemy 2.0 async |
| Migráció | Alembic |
| Adatbázis | PostgreSQL 16 + pgvector 0.7.x |
| Job queue | Redis 7 + RQ 1.16.x |
| Linter | Ruff |
| Tesztek | pytest + httpx |

### AI réteg

| Réteg | Technológia |
| --- | --- |
| Provider abstrakció | LiteLLM (Ollama + Gemini + OpenRouter) |
| Lokális inference | Ollama (12B-osztályú modell) |
| Cloud reviewer | Google AI Studio / Gemini (opcionális MVP, V1 default) |
| Agent orchestráció | PydanticAI (V1+) |
| Vektoros retrieval | pgvector (natív PostgreSQL) |

### Infrastruktúra

| Réteg | Technológia |
| --- | --- |
| Monorepo | Turborepo + pnpm workspaces |
| Lokális futtatás | Docker Compose |
| Auth (MVP) | JWT + `.env` hardcoded credentials |
| Auth (V1+) | Auth.js (cloud deploy esetén) |
| Desktop (later) | Tauri wrapper |

---

## Repo struktúra

```text
forgewriter-ai/
  apps/
    web/                ← Next.js 15 frontend  (port 3000)
    api/                ← FastAPI backend       (port 8000)
  packages/
    shared/             ← megosztott TypeScript típusok
    prompts/
      hu/               ← magyar prompt template-ek (elsődleges)
      en/               ← angol prompt template-ek
  infra/
    docker/
  docs/
  scripts/
  docker-compose.yml
  .env.example
  turbo.json
  pnpm-workspace.yaml
```

---

## Docker Compose szolgáltatások (MVP)

| Szolgáltatás | Leírás | Port |
| --- | --- | --- |
| `web` | Next.js frontend | 3000 |
| `api` | FastAPI backend | 8000 |
| `worker` | RQ háttér worker (AI jobok) | — |
| `postgres` | PostgreSQL 16 + pgvector | 5432 |
| `redis` | Redis 7 (job queue) | 6379 |
| `ollama` | Ollama lokális LLM runtime | 11434 |

> **Megjegyzés:** Qdrant **nincs** az MVP/V1 stack-ben — pgvector kezeli a vektoros keresést. Qdrant opcionális upgrade V2-ben, ha a retrieval teljesítmény szűknek bizonyul.

---

## Gyors indítás (fejlesztői)

```bash
# repo klónozása
git clone https://github.com/yourname/forgewriter-ai
cd forgewriter-ai

# függőségek
pnpm install

# .env beállítása
cp .env.example .env
# szerkeszd az AUTH_USERNAME, AUTH_PASSWORD, JWT_SECRET értékeket

# teljes stack indítása
docker compose up -d

# fejlesztői hot-reload
turbo dev
```

Az alkalmazás elérhető: [http://localhost:3000](http://localhost:3000)  
API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Ollama modell letöltése

```bash
ollama pull gemma3:12b
# vagy
ollama pull qwen2.5:14b
```

---

## MVP scope

Az MVP akkor kész, ha az író tud:

- [x] projektet, könyvet, fejezeteket, jeleneteket létrehozni
- [x] beat-eket írni jelenetekhez
- [x] karaktereket, helyszíneket, worldbuilding bejegyzéseket kezelni
- [x] rich text editorban írni (Tiptap, autosave)
- [x] kijelölt szöveget AI-jal átíratni
- [x] jelenetdraftot generáltatni beat-ekből lokális modellel
- [x] az AI outputot revisionként menteni (soha nem automatikus felülírás)
- [x] manuálisan jóváhagyni és beilleszteni az AI javaslatot
- [x] a könyvet Markdown formátumba exportálni
- [x] az egészet lokálisan futtatni Docker Compose-zal

**MVP-ből kizárva:**

- teljes könyv automatikus generálása
- többfelhasználós collaboration
- fizetési rendszer
- mobilalkalmazás
- valós idejű multiplayer szerkesztés
- haladó KDP formázás
- képgenerálás

---

## Roadmap

### MVP — NovelCrafter core

Stabil adatmodell, CRUD, Tiptap editor, alapszintű LiteLLM AI (Ollama), Markdown export, JWT auth.

### V1 — Teljes írói workspace

PydanticAI agensek, pgvector RAG, SSE streaming, dnd-kit tábla, Pandoc export (DOCX, EPUB), React Flow kapcsolati háló, brainstorm és rewrite módok, continuity checker, diff panel.

### V2 — Agentic chapter pipeline

Többlépéses PydanticAI workflow-k, quality gate pontozás, batch generálás, cloud reviewer routing, teljes könyv kohézióaudit, karakter hangkonzisztencia ellenőrzés.

### Később

Tauri desktop wrapper, sötét téma, Auth.js multi-user cloud deploy, KDP formázás, Qdrant (ha pgvector szűk lesz).

---

## AI architektúra elvek

- Minden AI hívás a `ModelRouter` service-en megy keresztül — soha nem közvetlenül route handler-ből.
- Prompt template-ek a `packages/prompts/hu/` mappában vannak, nem hardcode-olva Python fájlban.
- MVP-ben közvetlen LiteLLM hívások; PydanticAI agensek V1-ben kerülnek be.
- Csak emberileg jóváhagyott szöveg és summary kerül a tartós memóriába / pgvector indexbe.
- Minden AI output `Revision` rekordként mentődik — az eredeti szöveg mindig visszaállítható.

---

## Magyar nyelvi elvek

- tegezés/magázás konzisztenciája karakterenként és kapcsolatonként
- természetes magyar párbeszéd, nem fordított angol mondatszerkezetek
- modorosság és sablonosság jelzése
- karakterhangok következetessége
- a magyar prompt presetek elsőrendűek — nem fordított angol promptok

---

## Fejlesztési workflow

```text
1. /brainstorming     → mit kell pontosan csinálni?
2. /writing-plans     → részletes implementációs terv
3. /test-driven-development → tesztek először
4. (implementáció)
5. /verification-before-completion → tényleg működik?
6. /code-review       → code quality check
```

Nagyobb változás előtt Claude Code-nak mindig le kell produkálnia:

1. rövid implementációs tervet
2. érintett fájlokat
3. adatmodell hatást
4. API hatást
5. teszttervet
6. ismert kockázatokat

---

## Docs

| Dokumentum | Tartalom |
| --- | --- |
| `docs/01_project_goal_specification.md` | Projekt célja, MVP, V1, V2 scope |
| `docs/02_full_feature_list.md` | Teljes funkciólista prioritással |
| `docs/03_tech_stack_db_hosting.md` | Technikai architektúra, adatbázis séma |
| `docs/04_mvp_implementation_plan.md` | MVP fázisok és acceptance criteria |
| `docs/05_data_model_and_api_contract.md` | Adatmodell és API kontraktusok |
| `docs/06_ai_workflows_and_prompts.md` | AI workflow diagramok és prompt struktúra |
| `docs/07_ui_ux_routes_and_components.md` | UI route-ok és komponens architektúra |
| `docs/08_dev_environment_and_commands.md` | Fejlesztői környezet és parancsok |
| `docs/09_design_system_novelcrafter_inspired.md` | Design rendszer és tokenek |
| `docs/12_skills_and_tooling.md` | Claude Code skillek és tooling |
| `docs/superpowers/specs/2026-06-08-tech-stack-design.md` | Véglegesített tech stack döntések |
