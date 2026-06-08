# 03 — Tech stack, adatbázis, AI layer és hosting terv

Ez a dokumentum a saját agentic AI könyvíró platform technikai architektúráját írja le.

> **⚠️ FRISSÍTVE 2026-06-08** — Véglegesített döntések a brainstorming session alapján.
> Teljes roadmap: `10_full_stack_roadmap.html`

---

## ✅ Véglegesített döntések (2026-06-08)

| Terület          | Döntés                                                              |
| ---------------- | ------------------------------------------------------------------- |
| Deployment       | **Hibrid: Docker dev → Vercel-ready prod**                          |
| Monorepo         | **Turborepo + pnpm workspaces**                                     |
| Frontend         | **Next.js 15 + TypeScript + Tailwind + shadcn/ui + Framer Motion**  |
| Editor           | **Tiptap**                                                          |
| State            | **Zustand + TanStack Query**                                        |
| Backend          | **FastAPI + Pydantic + SQLAlchemy + Alembic**                       |
| DB               | **PostgreSQL + pgvector** (Neon/Docker) — Qdrant kivéve MVP-ből     |
| Jobs             | **Redis + RQ**                                                      |
| AI réteg         | **LiteLLM** (Ollama + Google AI Studio + OpenRouter)                |
| Orchestration    | **PydanticAI**                                                      |
| Auth             | **JWT + .env** (MVP) → Auth.js (cloud later)                        |

---

## 1. Architektúra összefoglaló

Véglegesített megközelítés: **Hibrid — Docker dev, Vercel-ready prod**.

Fejlesztési és MVP futtatási forma:

```text
Docker Compose local stack
├── frontend: Next.js / React / TypeScript  (port 3000)
├── backend: FastAPI / Python               (port 8000)
├── postgres: PostgreSQL + pgvector         (port 5432)
├── redis: queue és job state               (port 6379)
├── worker: háttér AI-jobok (RQ worker)
└── ollama: lokális LLM inference           (port 11434)
```

> **Változás:** Qdrant kivéve — pgvector váltja MVP-ben és V1-ben.
> Qdrant opcionális V2-ben ha a retrieval teljesítmény szűknek bizonyul.

Későbbi deployment:

```text
GCP vagy saját GPU-s szerver
├── frontend: Cloud Run / Vercel / Firebase Hosting / Nginx
├── backend: Cloud Run / VM / Kubernetes later
├── postgres: Cloud SQL vagy self-hosted PostgreSQL
├── qdrant: Qdrant Cloud vagy self-hosted Qdrant
├── redis: Memorystore vagy self-hosted Redis
├── inference: Ollama lokálisan vagy vLLM GPU VM-en
└── export worker: Pandoc + document tools
```

---

## 2. Frontend stack

### Ajánlott

| Terület | Technológia | Indok |
|---|---|---|
| Framework | **Next.js** | Modern React app, routing, API bridge, későbbi web deployment |
| Nyelv | **TypeScript** | Típusbiztonság komplex adatmodellnél |
| UI | **Tailwind CSS + shadcn/ui** | Gyors, modern, jól komponálható UI |
| Rich text editor | **Tiptap** | ProseMirror-alapú, de modernebb DX, AI bubble menu-hoz jó |
| Drag-and-drop | **dnd-kit** | Scene/chapter boardhoz |
| Graph / node UI | **xyflow / React Flow** | Relationship map, plot graph, timeline node view |
| State management | **Zustand** | Egyszerű, gyors UI állapotkezelés |
| Server state | **TanStack Query** | API cache, mutation, optimistic update |
| Forms | **React Hook Form + Zod** | Validáció, típusos formok |
| Icons | **Lucide React** | shadcn kompatibilis ikonok |

### Fő frontend modulok

```text
src/
├── app/
│   ├── dashboard/
│   ├── projects/[projectId]/
│   ├── books/[bookId]/
│   ├── codex/
│   ├── editor/
│   ├── timeline/
│   ├── graph/
│   └── settings/
├── components/
│   ├── editor/
│   ├── codex/
│   ├── outline-board/
│   ├── ai-panel/
│   ├── review-panel/
│   ├── timeline/
│   └── graph/
├── lib/
│   ├── api-client.ts
│   ├── schemas.ts
│   └── utils.ts
└── stores/
    ├── project-store.ts
    ├── editor-store.ts
    └── ai-store.ts
```

---

## 3. Backend stack

### Ajánlott

| Terület | Technológia | Indok |
|---|---|---|
| Backend framework | **FastAPI** | AI toolinghoz Python ökoszisztéma a legjobb |
| Validáció | **Pydantic** | API schema és agent input/output típusos kezelése |
| ORM | **SQLAlchemy 2.0** | PostgreSQL modellezés |
| Migration | **Alembic** | DB verziókezelés |
| Auth | MVP-ben local auth / később Auth.js vagy Firebase Auth | MVP-ben egyszerűbb |
| Queue | **Redis + RQ vagy Celery** | Hosszú AI-jobok, export, embedding |
| Realtime | **SSE** első körben, később WebSocket | AI streaminghez SSE elég |
| Config | Pydantic Settings / env vars | Docker és deployment kompatibilis |
| Logging | structlog / standard logging | Debug és job monitoring |

### Backend modulok

```text
backend/
├── app/
│   ├── main.py
│   ├── api/
│   │   ├── projects.py
│   │   ├── books.py
│   │   ├── chapters.py
│   │   ├── scenes.py
│   │   ├── codex.py
│   │   ├── ai.py
│   │   ├── workflows.py
│   │   └── exports.py
│   ├── core/
│   │   ├── config.py
│   │   ├── security.py
│   │   └── logging.py
│   ├── db/
│   │   ├── models.py
│   │   ├── session.py
│   │   └── migrations/
│   ├── services/
│   │   ├── project_service.py
│   │   ├── codex_service.py
│   │   ├── manuscript_service.py
│   │   ├── retrieval_service.py
│   │   ├── model_router.py
│   │   ├── prompt_service.py
│   │   ├── export_service.py
│   │   └── revision_service.py
│   ├── agents/
│   │   ├── story_architect.py
│   │   ├── scene_writer.py
│   │   ├── continuity_checker.py
│   │   ├── hungarian_editor.py
│   │   └── developmental_editor.py
│   ├── workflows/
│   │   ├── scene_generation_graph.py
│   │   ├── chapter_generation_graph.py
│   │   └── review_graph.py
│   └── workers/
│       ├── queue.py
│       ├── generation_worker.py
│       ├── embedding_worker.py
│       └── export_worker.py
└── tests/
```

---

## 4. AI layer

### Model router

Minden AI-kérés a **ModelRouter** szolgáltatáson menjen keresztül.

```text
AI request
→ task type meghatározása
→ prompt preset betöltése
→ context pack összeállítása
→ modell kiválasztása
→ inference hívás
→ output validálása
→ revisionként mentés
→ opcionális memory update
```

### Provider típusok

| Provider | Használat | Prioritás |
|---|---|---:|
| Ollama | Lokális draftolás, rewrite, brainstorm | MVP |
| OpenAI-compatible endpoint | OpenRouter, LM Studio, custom vLLM | V1 |
| Gemini API | Cloud reviewer / final polish | V1 |
| vLLM | Saját GPU-s szerver inference | V2 |
| LM Studio | Lokális fejlesztői alternatíva | V1 |

### Task-based routing

| Task | Default model | Megjegyzés |
|---|---|---|
| Brainstorm | local 12B | gyors és olcsó |
| Scene beat generation | local 12B | strukturált output kell |
| Scene draft | local 12B | 1500–2500 szavas draft |
| Rewrite | local 12B | kijelölt szövegre |
| Dialogue improvement | local 12B / cloud optional | magyar párbeszédnél cloud hasznos lehet |
| Hungarian polish | cloud reviewer vagy jobb local model | minőségkritikus |
| Continuity check | local + RAG / cloud | hosszabb kontextusnál cloud jobb |
| Developmental critique | cloud reviewer | dramaturgiai minőség miatt |
| Final polish | cloud reviewer | végső kéziratnál |
| Export formatting | nem LLM | szabályalapú/Pandoc |

---

## 5. Agent orchestration

### Ajánlott keretrendszer

**LangGraph**

Indok:

- explicit állapotgép;
- jól illik többkörös agentic workflow-khoz;
- jobban kontrollálható, mint egy laza multi-agent chat;
- könnyű human approval node-okat beépíteni;
- jó chapter generation pipeline-hoz.

### Scene generation workflow

```mermaid
flowchart TD
    A[User selects scene + beats] --> B[Context Pack Builder]
    B --> C[Scene Writer Agent]
    C --> D[Hungarian Language Editor]
    D --> E[Continuity Checker]
    E --> F{Quality OK?}
    F -- No --> G[Rewrite Agent]
    G --> D
    F -- Yes --> H[Save Draft Revision]
    H --> I[Human Review]
    I --> J{Approve?}
    J -- No --> K[Manual Edit / Regenerate]
    J -- Yes --> L[Update Scene Text + Summary Memory]
```

### Chapter generation workflow

```mermaid
flowchart TD
    A[Chapter goal + plotline] --> B[Chapter Planner Agent]
    B --> C[Scene Planner Agent]
    C --> D[Generate scenes one by one]
    D --> E[Chapter Continuity Check]
    E --> F[Developmental Editor]
    F --> G[Hungarian Style Pass]
    G --> H[Quality Gate Score]
    H --> I{Approve / Revise / Regenerate}
    I --> J[Update chapter summary + character states]
```

---

## 6. Retrieval és memory architecture

### Komponensek

| Komponens | Technológia | Feladat |
|---|---|---|
| Structured DB | PostgreSQL | Projekt, kézirat, Codex, revision |
| Vector DB | Qdrant | Szemantikus retrieval |
| Keyword search | PostgreSQL full-text | Pontos keresés nevekre, tárgyakra |
| Embedding worker | Python worker | Embedding frissítés |
| Context pack builder | Backend service | Releváns kontextus összeállítása AI-kéréshez |

### Indexelendő tartalmak

- Character profile
- Character voice rules
- Character arc states
- Location profile
- Worldbuilding entries
- Timeline events
- Scene summaries
- Chapter summaries
- Style guide
- Approved manuscript excerpts

### Memory update szabály

Fontos szabály:

> Csak emberileg jóváhagyott szöveg és jóváhagyott summary kerüljön a tartós memory-ba.

AI draft nem frissítheti automatikusan a canon memory-t.

---

## 7. Adatbázis-terv

### Fő entitások

```text
User
Project
Series
Book
Chapter
Scene
Beat
Character
CharacterArc
Relationship
Location
WorldbuildingEntry
TimelineEvent
Plotline
Subplot
CodexEntry
StyleGuide
PromptPreset
ModelProvider
ModelConfig
GenerationJob
AIComment
Revision
ExportJob
EmbeddingRecord
```

---

## 8. PostgreSQL schema vázlat

### users

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| email | text | unique, később auth |
| display_name | text | opcionális |
| created_at | timestamp | |

### projects

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| owner_id | uuid | users.id |
| title | text | projekt címe |
| description | text | leírás |
| language | text | pl. hu |
| genre | text | műfaj |
| status | text | planning/drafting/editing |
| created_at | timestamp | |
| updated_at | timestamp | |

### books

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| series_id | uuid nullable | series.id |
| title | text | könyvcím |
| subtitle | text nullable | alcím |
| target_word_count | int | célhossz |
| order_index | int | sorozaton belül |
| status | text | |

### chapters

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| book_id | uuid | books.id |
| title | text | fejezetcím |
| order_index | int | sorrend |
| summary | text | chapter summary |
| goal | text | dramaturgiai cél |
| status | text | planned/drafted/reviewed/approved |
| word_count | int | számított |

### scenes

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| chapter_id | uuid | chapters.id |
| title | text | jelenetcím |
| order_index | int | sorrend |
| pov_character_id | uuid nullable | characters.id |
| location_id | uuid nullable | locations.id |
| timeline_event_id | uuid nullable | timeline_events.id |
| summary | text | scene summary |
| text | jsonb/text | Tiptap JSON vagy Markdown/HTML |
| plain_text | text | kereséshez/exporthoz |
| status | text | planned/drafted/reviewed/approved |
| word_count | int | |

### beats

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| scene_id | uuid | scenes.id |
| order_index | int | sorrend |
| beat_type | text | goal/conflict/turn/outcome |
| content | text | beat leírás |

### characters

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| name | text | karakter neve |
| role | text | protagonist/antagonist/supporting |
| short_description | text | rövid leírás |
| motivation | text | cél/motiváció |
| fear | text | félelem |
| conflict | text | belső/külső konfliktus |
| voice_notes | text | beszédstílus |
| pronouns | text nullable | opcionális |
| formality_rules | text | tegezés/magázás |
| canon_status | text | draft/canon |

### character_arcs

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| character_id | uuid | characters.id |
| book_id | uuid nullable | könyvhöz kötött ív |
| start_state | text | kezdeti állapot |
| midpoint_state | text | középállapot |
| end_state | text | végállapot |
| notes | text | |

### relationships

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| source_character_id | uuid | characters.id |
| target_character_id | uuid | characters.id |
| type | text | barát/ellenség/család/stb. |
| description | text | kapcsolat leírása |
| formality | text | tegezés/magázás |

### locations

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| name | text | helyszín neve |
| description | text | leírás |
| mood | text | hangulat |
| rules | text | világon belüli szabályok |
| sensory_details | text | látvány/hang/szag/tapintás |

### worldbuilding_entries

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| category | text | magic/technology/politics/lore/rule |
| title | text | cím |
| content | text | tartalom |
| canon_status | text | draft/canon |

### timeline_events

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| title | text | esemény |
| event_date | text nullable | rugalmas fantasy/sci-fi időrendhez |
| order_index | int | sorrend |
| description | text | leírás |

### style_guides

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| name | text | pl. Magyar természetes próza |
| tone | text | hangnem |
| rules | text | stílusszabályok |
| forbidden_phrases | text[] | kerülendő fordulatok |
| examples | jsonb | jó/rossz példák |

### revisions

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| entity_type | text | scene/chapter/codex |
| entity_id | uuid | érintett rekord |
| before_content | jsonb/text | eredeti |
| after_content | jsonb/text | új verzió |
| source | text | human/ai/import |
| model | text nullable | AI esetén |
| prompt_id | uuid nullable | prompt preset |
| created_at | timestamp | |

### generation_jobs

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| job_type | text | scene_draft/chapter_review/export |
| status | text | queued/running/failed/completed |
| model_provider | text | ollama/gemini/openrouter |
| model_name | text | használt modell |
| input_payload | jsonb | bemenet |
| output_payload | jsonb | kimenet |
| error_message | text nullable | hiba |
| created_at | timestamp | |
| started_at | timestamp nullable | |
| completed_at | timestamp nullable | |

### embedding_records

| Mező | Típus | Megjegyzés |
|---|---|---|
| id | uuid | primary key |
| project_id | uuid | projects.id |
| source_type | text | character/location/scene_summary |
| source_id | uuid | forrás rekord |
| qdrant_point_id | uuid | Qdrant point |
| content_hash | text | változásdetektálás |
| embedding_model | text | embedding modell |
| updated_at | timestamp | |

---

## 9. Qdrant collection terv

### Collection: project_memory

Payload mezők:

```json
{
  "project_id": "uuid",
  "book_id": "uuid|null",
  "source_type": "character|location|worldbuilding|scene_summary|chapter_summary|style_guide|timeline_event",
  "source_id": "uuid",
  "title": "string",
  "content": "string",
  "canon_status": "draft|canon",
  "tags": ["string"],
  "updated_at": "timestamp"
}
```

### Retrieval logika

1. Exact keyword search PostgreSQL-ben
2. Semantic search Qdrantban
3. Eredmények deduplikálása
4. Rangsorolás source_type szerint
5. Context pack összeállítása token budget alapján

---

## 10. Prompt és context pack rendszer

### Prompt preset struktúra

```json
{
  "id": "uuid",
  "name": "Generate Scene from Beats - Hungarian",
  "task_type": "scene_draft",
  "language": "hu",
  "system_prompt": "...",
  "user_template": "...",
  "required_context": ["scene", "beats", "characters", "location", "style_guide"],
  "optional_context": ["previous_scene_summary", "chapter_summary", "timeline"],
  "output_schema": "markdown|json",
  "default_model_policy": "local_draft"
}
```

### Context pack elemek

- Current scene metadata
- Scene beats
- Chapter goal
- Previous scene summary
- Relevant character profiles
- Character voice notes
- Location profile
- Related worldbuilding rules
- Timeline constraints
- Style guide
- User instruction

---

## 11. Export pipeline

### Ajánlott eszköz

**Pandoc**

### Pipeline

```text
Approved scenes
→ order by book/chapter/scene
→ normalize internal editor content
→ convert to Markdown
→ add front matter
→ add chapter headings
→ Pandoc export
→ DOCX / EPUB / PDF
→ save ExportJob
```

### Export formátumok

| Formátum | Prioritás | Megvalósítás |
|---|---:|---|
| Markdown | MVP | natív generálás |
| DOCX | MVP | Pandoc vagy python-docx |
| EPUB | V1 | Pandoc |
| PDF | V1 | Pandoc vagy HTML/CSS + Playwright |
| KDP-ready PDF | Later | külön template és trim size logika |

---

## 12. Docker Compose MVP

```yaml
version: "3.9"

services:
  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000
    depends_on:
      - backend

  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/novelcraft
      - REDIS_URL=redis://redis:6379/0
      - QDRANT_URL=http://qdrant:6333
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - postgres
      - redis
      - qdrant
      - ollama

  worker:
    build: ./backend
    command: python -m app.workers.generation_worker
    environment:
      - DATABASE_URL=postgresql+psycopg://postgres:postgres@postgres:5432/novelcraft
      - REDIS_URL=redis://redis:6379/0
      - QDRANT_URL=http://qdrant:6333
      - OLLAMA_BASE_URL=http://ollama:11434
    depends_on:
      - backend
      - redis
      - postgres
      - qdrant
      - ollama

  postgres:
    image: postgres:16
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=novelcraft
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7
    ports:
      - "6379:6379"

  qdrant:
    image: qdrant/qdrant:latest
    ports:
      - "6333:6333"
    volumes:
      - qdrant_data:/qdrant/storage

  ollama:
    image: ollama/ollama:latest
    ports:
      - "11434:11434"
    volumes:
      - ollama_data:/root/.ollama

volumes:
  postgres_data:
  qdrant_data:
  ollama_data:
```

Megjegyzés: Windows + NVIDIA GPU esetén az Ollama GPU elérést külön kell konfigurálni a host környezetben.

---

## 13. Hosting opciók

### Opció A — teljesen lokális

| Komponens | Futási hely |
|---|---|
| Frontend | localhost |
| Backend | localhost Docker |
| PostgreSQL | Docker |
| Qdrant | Docker |
| Redis | Docker |
| Ollama | host vagy Docker |

Előny:

- adatvédelem;
- nincs cloud költség;
- gyors fejlesztés;
- kézirat lokálisan marad.

Hátrány:

- telepítés bonyolultabb;
- GPU konfiguráció függ a géptől;
- nincs könnyű multi-device sync.

### Opció B — saját GCP szerver

| Komponens | Futási hely |
|---|---|
| Frontend | Cloud Run / Firebase Hosting |
| Backend | Cloud Run vagy Compute Engine |
| PostgreSQL | Cloud SQL |
| Qdrant | Qdrant Cloud vagy Compute Engine |
| Redis | Memorystore vagy Compute Engine |
| Inference | GPU VM + vLLM / Ollama |

Előny:

- bárhonnan elérhető;
- skálázható;
- GPU-s serving központilag kezelhető.

Hátrány:

- költség;
- adatvédelmi és kulcskezelési kérdések;
- üzemeltetési komplexitás.

### Opció C — hibrid

- UI és backend cloudban;
- lokális Ollama opcionális;
- cloud reviewer modell opcionális;
- adatok lehetnek lokális export/backup formában.

Ez hosszú távon a legjobb kompromisszum lehet.

---

## 14. Desktop / local-first stratégia

### MVP-ben ne legyen natív desktop

Először Docker Compose + browser UI.

### Később

**Tauri** ajánlott:

- kisebb erőforrásigény, mint Electron;
- local-first app érzés;
- web frontend újrahasznosítható;
- lokális fájlhozzáférés és desktop integráció.

Desktop roadmap:

1. Webapp Docker Compose-ban
2. PWA
3. Tauri wrapper
4. Local SQLite offline mód opcionálisan
5. Sync réteg később

---

## 15. Open-source komponensek stratégia

| Terület | Ajánlott projekt | Használat módja |
|---|---|---|
| Editor | Tiptap | adopt |
| Agent orchestration | LangGraph | adopt |
| RAG pipeline | Haystack vagy saját light wrapper | adapt |
| Local inference | Ollama | adopt |
| Server inference | vLLM | adopt később |
| Vector DB | Qdrant | adopt |
| Drag-and-drop | dnd-kit | adopt |
| Graph UI | xyflow / React Flow | adopt |
| Export | Pandoc | adopt |
| Desktop shell | Tauri | adopt később |
| AI chat referencia | Open WebUI / LibreChat | reference/adapt |
| Writer workflow referencia | Book Genesis v4 | reference only |
| Novel app referencia | Manuskript / novelWriter | reference only |
| Knowledge UI referencia | AppFlowy / Outline / Docmost | reference only |

Licenc miatt különösen óvatosan:

- GPL / AGPL / BSL projektekből ne vegyünk át kódot közvetlenül, csak UX/architektúra inspirációt.
- MIT / Apache / permisszív komponensek biztonságosabbak.

---

## 16. Biztonság és adatvédelem

### Alapelvek

- Kézirat és Codex adatok ne kerüljenek cloud modellhez explicit jóváhagyás nélkül.
- A user választhassa ki, melyik AI-task fut lokálisan és melyik cloudban.
- API kulcsok titkosítva legyenek tárolva.
- Minden export és backup a felhasználó kontrollja alatt legyen.
- AI-output mindig revisionként mentődjön.

### Fontos beállítások

- Local-only mode
- Hybrid mode
- Cloud reviewer enabled/disabled
- Per-task model routing
- API key vault
- Prompt/context preview

---

## 17. API endpoint vázlat

```text
GET    /api/projects
POST   /api/projects
GET    /api/projects/{project_id}
PATCH  /api/projects/{project_id}
DELETE /api/projects/{project_id}

GET    /api/books?project_id=
POST   /api/books
GET    /api/books/{book_id}
PATCH  /api/books/{book_id}

GET    /api/chapters?book_id=
POST   /api/chapters
PATCH  /api/chapters/{chapter_id}
POST   /api/chapters/reorder

GET    /api/scenes?chapter_id=
POST   /api/scenes
GET    /api/scenes/{scene_id}
PATCH  /api/scenes/{scene_id}
POST   /api/scenes/reorder

GET    /api/codex?project_id=
POST   /api/codex
PATCH  /api/codex/{entry_id}
DELETE /api/codex/{entry_id}

POST   /api/ai/rewrite
POST   /api/ai/brainstorm
POST   /api/ai/generate-scene
POST   /api/ai/review-scene
POST   /api/ai/continuity-check

POST   /api/workflows/generate-chapter
GET    /api/jobs/{job_id}
GET    /api/jobs/{job_id}/events

POST   /api/exports
GET    /api/exports/{export_id}
```

---

## 18. Repository struktúra

```text
novelcraft-ai/
├── README.md
├── docker-compose.yml
├── .env.example
├── frontend/
│   ├── package.json
│   ├── next.config.js
│   └── src/
├── backend/
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── app/
│   └── tests/
├── prompts/
│   ├── hu/
│   │   ├── scene_draft.md
│   │   ├── rewrite.md
│   │   ├── hungarian_style_editor.md
│   │   └── continuity_check.md
│   └── en/
├── docs/
│   ├── architecture.md
│   ├── data-model.md
│   ├── ai-workflows.md
│   └── deployment.md
└── scripts/
    ├── seed_demo_project.py
    ├── export_book.py
    └── pull_local_model.sh
```

---

## 19. Fejlesztési milestone-ok

### Milestone 0 — skeleton

- Monorepo létrehozás
- Docker Compose
- Frontend + backend healthcheck
- PostgreSQL migration
- Alap layout

### Milestone 1 — core CRUD

- Project CRUD
- Book CRUD
- Chapter CRUD
- Scene CRUD
- Codex CRUD
- Basic dashboard

### Milestone 2 — editor

- Tiptap editor
- Autosave
- Scene metadata
- Chapter/scene sidebar
- Plain text extraction

### Milestone 3 — local AI MVP

- Ollama provider
- Model router
- Prompt preset rendszer
- Rewrite selected text
- Generate scene from beats
- Revision mentés

### Milestone 4 — memory

- Scene/chapter summary
- Qdrant setup
- Embedding worker
- Context pack builder
- Codex retrieval

### Milestone 5 — review

- Continuity checker
- Hungarian style editor
- Diff panel
- AI comments
- Quality warnings

### Milestone 6 — export

- Markdown export
- DOCX export
- EPUB export
- ExportJob tracking

### Milestone 7 — V2 workflow

- LangGraph chapter generation
- Multi-agent pipeline
- Quality gate
- Batch generation
- Human approval node

---

## 20. Claude Code implementációs irányelvek

Claude Code számára:

1. Először a monorepo skeleton készüljön el.
2. A database schema legyen az első stabil alap.
3. Minden entity-hez legyen Pydantic schema, SQLAlchemy model és CRUD service.
4. AI provider ne legyen közvetlenül UI-ba égetve.
5. Minden AI task menjen a ModelRouteren keresztül.
6. Minden AI output revisionként mentődjön.
7. A generation jobok aszinkron queue-ba kerüljenek.
8. A frontend legyen komponensalapú: Editor, CodexPanel, AIPanel, OutlineBoard.
9. Az export pipeline külön service legyen.
10. A promptok külön markdown fájlokban legyenek, ne hardcode-olva.
11. A magyar prompt presetek legyenek elsőrangúak, ne fordított angol promptok.
12. A rendszer minden lépésben működjön local-only módban.

---

## 21. Ajánlott első parancs Claude Code-nak

A fejlesztés indításához Claude Code-nak ilyen feladatot érdemes adni:

```text
Create a monorepo for the NovelCraft AI project based on the three specification markdown files. Implement only Milestone 0 and Milestone 1 first:

- Docker Compose with frontend, backend, postgres, redis, qdrant
- Next.js + TypeScript frontend with basic dashboard layout
- FastAPI backend with healthcheck
- PostgreSQL connection with SQLAlchemy and Alembic
- SQLAlchemy models and migrations for Project, Book, Chapter, Scene, Character, Location, WorldbuildingEntry
- CRUD endpoints for those entities
- TanStack Query API client in frontend
- Simple UI for project/book/chapter/scene creation

Do not implement AI features yet. Prepare the architecture so the AI layer can be added later through a ModelRouter service.
```
