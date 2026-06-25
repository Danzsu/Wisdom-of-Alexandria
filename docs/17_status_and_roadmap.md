# 17 — Állapot és roadmap (élő)

Ez a dokumentum az **autoritatív, élő állapot- és roadmap-leírás**. Ahol más doc (pl. `docs/14`) korábbi tervezési prózát tartalmaz, ott az ottani szöveg történeti kontextus — a tényleges állapotot mindig ez a fájl írja felül.

---

## a) Jelenlegi állapot (2026-06-25)

**Architektúra (egysoros):** local-first, magyar nyelvű, agentic regényíró-workspace; **két, külön deployolható backend-szolgáltatás** — `apps/api` (domain/CRUD, `:8000`) + `apps/ai` (AI/agentic + provider/jobs, `:8001`) — közös `packages/db` (`alexandria_core`) Python-csomagon és közös PostgreSQL-en (a HITL-kontraktus DB-szinten köt; a két app sosem hivatkozik egymásra). Frontend: `apps/web` (Next.js 15). A FE/BE típuskontraktus a `packages/shared` OpenAPI-generált TS-típuscsomagon át fut, fordításidős `MatchesContract` guarddal a Zod-sémákhoz kötve.

**Teszt-állás (autoritatív szám):**

| Csomag | Tesztek | Megjegyzés |
|---|---|---|
| `apps/api` | **534** | CI-ban (Postgres) futnak; a pandoc/weasyprint-igényes tesztek lokálisan skippelnek |
| `apps/ai` | **396** | a pgvector-tesztek SQLite-on skippelnek; CI Postgresen futtatja őket |
| `apps/web` | **803** | — (Phase-1/2 design + state-minták + re-skin + DESIGN-C + delight tesztjeivel) |

ruff / type-check / lint tiszta; az anti-pattern detektor anti-pattern-mentes.

**CI:** a `feat/alexandria-ui` ág fel van pusholva originra, és a **GitHub Actions CI ZÖLD** (run #5/#6 a backend / frontend / shared-types / lighthouse jobokon át): backend ruff + `alembic upgrade head` Postgresen + pytest (pgvector + pandoc) · frontend type-check / lint / vitest · shared-types frissesség-check · **advisory (non-blocking) Lighthouse job**.

**Branch/push:** `feat/alexandria-ui` @ origin, zöld CI. Commit/push/branch nélkül — ez a doc-kör csak Markdown.

---

## b) Mi készült el

### Backend domain (`apps/api`)
- Teljes CRUD: projects / books / chapters / scenes / beats / codex / characters / locations / worldbuilding / snippets / style_guide / relations / progressions / auth / exports + revisions (list + approve/reject = a human-in-the-loop, ami a Scene-t mutálja). Nulla AI-import.
- Cross-chapter jelenet-mozgatás (`POST /chapters/{cid}/scenes/{id}/move`), kaszkád-helyes `order_index`.
- Export-tartomány (`scope=book|chapter|scene` + `target_id`, IDOR-biztos tulajdon-ellenőrzéssel).
- **DOCX/EPUB export Pandoc-on** + **DOCX import pipeline** (pandoc subprocess, hangos hibakezelés; az api Dockerfile-ban + CI-ban).
- **Projekt-aggregátumok:** `book_count` + `word_count` a `ProjectRead`-en (archivált jelenetek KIZÁRVA), a projekt-kártyákon megjelenítve.
- **Projekt JSON backup/restore:** teljes-gráf, verziózott export (KIZÁRJA a provider-titkokat + embeddingeket + jobs/revisions sorokat) + tranzakcionális restore FK-remappel.

### AI-core + RAG (`apps/ai`)
- `ModelRouter` (provider-configból olvas) · `ai_service` · `prompt_loader` · `revision_service` · `provider_service` · `crypto`. Endpointok: `/ai/*` · `/providers/*` · `/jobs`.
- Provider/API-kulcs config: `Provider` entitás, Fernet-titkosított kulcs (maszkolt Read, master kulcs `.env`-ből), `providers` CRUD + `/{id}/test`.
- Generálási paraméterek (`temperature` / `max_tokens`) minden AI-request sémán, átadva a `ModelRouter`-nek.
- **RAG Codex + kézirat felett pgvectoron:** dialektus-tudatos `Vector` típus + `Embedding` modell + `ModelRouter.embed()` (felhős embedding a provider-configból), `EmbeddingService` (projekt-scope-olt lazy index + cosine retrieve), a RAG-kontextus a rewrite / generate_scene / write_continue promptokba injektálva, `context_entities` visszaadva + chipként a result-kártyán.
- **RAG sorozat-tudatosság:** `Embedding.series_id` — más sorozat codexe/kézirata sosem szivárog egy generálás kontextusába.
- **Folytonosság-ellenőrző:** `POST /ai/continuity` (jelenet-scope, RAG-kontextus, strukturált severity/message/entity figyelmeztetések, robusztus JSON-parse látható figyelmeztetéssé degradálva; az infra-hibák hangosak maradnak) + a valódi Warnings tab.
- **Élő AI-jobs képernyő + nav-badge:** book-scope `GET /jobs` + polling (az interaktív AI SZINKRON marad; az élő job-képernyő history + attention).
- **Aszinkron RAG-index job (valódi RQ worker):** `GenerationJob.project_id` oszlop + Alembic-migráció (`e5a1b2c3d4f6`); `POST /ai/index/async` a meglévő `ai` RQ-sorra enqueue-ol; valódi RQ worker-job (`app/jobs/index_job.py`, saját session, pending→running→done/failed állapotgép, maszkolt hiba, provider-hiányban no-op); FE `indexProjectAsync` + `getJob` + `useRebuildIndex` poll-hook + „RAG index" kártya a Beállításokban. Ez bizonyítja a valódi worker-infrát (az interaktív generálás szándékosan szinkron marad).

### Feature-ök #1–#5
- **#1 Sorozat-scope Codex:** `Series` entitás (Project alatt) + `Book.series_id` + `CodexEntry.series_id`; a Codex scope-toggle (Projekt/Sorozat) `?series_id=`-szal szűr; sorozat-kezelő UI.
- **#2 Cselekményszálak (subplots):** `Plotline` + `PlotlineScene` link-modellek + CRUD + endpointok + same-project IDOR-konzisztencia; a Cselekményszálak képernyő (típus szerint csoportosítva, status pill-ek, scene chipek, attach/detach).
- **#3 Kapcsolatok (relationship graph):** `CodexRelation` frontend + nyugodt, egyedi SVG force-graph (headless determinista d3-force, GSAP él-rajz).
- **#4 Idősor (timeline):** fejezet/jelenet idősor a könyv-fából (GSAP spine-draw).
- **#5 RAG-kontextus chipek** az AI result-kártyán (a behúzott Codex/jelenet-kontextus immár valós).

### UI / UX (UX-1 … UX-4b)
- Anti-pattern javítások: oldalsávos AI-border eltávolítva, bounce easing kivezetve.
- Shortcut overlay, iA-Writer-szerű focus-paragraph mód, persistent AI-job indikátor a TopBarban.
- Framer Motion adoptáció + GSAP onboarding scroll-narratíva.
- Responsive, tablet-first shell (drawerek), axe-core a11y teszt-gate.

### Új a legutóbbi frissítés óta (2026-06-21 → 2026-06-25)

- **Kép-generálás — Phase 1 (KÉSZ):** Codex karakter/helyszín képgenerálás (Nano Banana / Gemini image): `MediaAsset` modell + migráció, `Provider.image_model`, `ModelRouter.generate_image` (google-genai), konzerv stílus-presetek, RQ async job, `/ai/images` + `/ai/media`, Codex **„Képek" panel** kanonikus referenciával (HITL).
- **Borító-generálás — Phase 2 (BE + FE):** könyv-**borító-generátor** (art-generálás + app-oldali tipográfia-kompozit a KDP-biztonsági zónán belül); FE **borító-panel** (`components/book/cover-panel.tsx`).
- **Phase-1 design-system alap:** scale-tokenek; `EmptyState` / `Skeleton` (+ `SkeletonCard`/`List`/`Table`) / `ErrorState` primitívek; **Radix `Select`**; `Accordion`; **`Button` loading state**; `FormInput` prefix/suffix slotok; **WCAG-AA kontraszt** + a11y javítások; lokalizált (magyar) transport-hibák.
- **Phase-2 state-minta adoptáció:** minden adatnézet (board, Codex, Kutatás, Idősor, Kapcsolatok, Cselekményszálak, feladatok, export) az `EmptyState` / `SkeletonList` / inline `ErrorState` (+retry) hármast használja; onboarding konszolidálva (egyetlen inline first-run banner + „Hogyan működik?" pull-trigger).
- **Claude Design re-skin (DESIGN-A + DESIGN-B):** lila identitás (`--accent #6d5dfc`, AI-violet `#7c3aed`) + arany márkajel-csempe; fontok **Inter** (UI) / **Cormorant Garamond** (`font-display`) / **Caveat** (kézírásos wordmark) / **Literata** (kézirat); a projekt-dashboard Cormorant-hero + arany eyebrow + lebegő könyv-gerinc ikon; minden meglévő képernyő finomítva. **Live-verified:** kontraszt 0/0 mindkét témában, **Lighthouse a11y 100**.
- **Claude Design re-skin (DESIGN-C — net-új surface-ek, KÉSZ):** a három net-új design-képernyő leszállítva — **Landing** (publikus `/` marketing-oldal, commit `9361dda`), **Profil** (`/profil` + user-menü bekötve, commit `3683c6d`), **Prompt Library** (a `/konyv/[bookId]/promptok` placeholder helyén, commit `6036123`). Követő finomítás (commit `b6768a6`): `PageHero`-címek a design 40px-ére (`text-[clamp(32px,5vw,40px)]`), favicon, kisebb mobil-reszponzív javítások. Ezzel **design-felület nincs több hátra** (részletek: `docs/18`). Web teszt-szám **~781**.
- **Backend-audit keményítés (commit `8a72244`):** egy adverszariális backend-audit nyomán landolt biztonsági/robusztussági javítások — **upload-méret streaming-cap** (OOM-fix az import/backup-úton, nagy fájl nem olvasódik egészben memóriába); **embedding-dimenzió-validáció** tiszta hibaüzenettel (korábban néma RAG-bukás volt dimenzió-mismatch esetén); provider **`base_url` séma-validáció** (SSRF-részleges; a localhost továbbra is engedett a lokális Ollamához); **AI text-input `max_length` capek**; és **`pool_pre_ping`** a DB-poolon. Az audit **nem talált P0-t**; a javított tételek a kontrollált **P1/P2** bugok voltak.

### Új a legutóbbi frissítés óta (2026-06-25 — V1-rés-záró kör)

Ez a kör a korábbi „V1-rések" többségét leszállította (a roadmap c) szakasza ennek megfelelően lett karcsúsítva):

- **PDF export (commit `43d3385`):** `pandoc --pdf-engine=weasyprint` (ha a motor hiányzik, **kecses 503**); `pdf` az `ExportFormat`-ban, a `packages/shared` típusok újragenerálva, a frontend export-tab bekötve. Ezzel a Markdown/DOCX/EPUB/**PDF** négyes teljes.
- **Prompt Library backend (commit `a794b55`, auth-on-reads `ec0a286`):** a `/promptok` képernyő mostantól valódi, **workspace-globális `PromptTemplate`** entitásra épül — modell + migráció **`b3c5d7e9f1a2`** + 6 seedelt builtin + CRUD API (`/api/v1/prompt-templates`; builtin = immutábilis → **403**; auth a mutációkon **ÉS** az olvasásokon). A frontend az API-ról olvas, létrehozó modállal + törléssel. (Inline szerkesztő-UI még hátra — lásd c).)
- **`scene_count` aggregátum + `GET /api/v1/auth/me` (commit `a0bb5f1`):** a **Profil** mostantól a valós, összegzett jelenet-számot + valós felhasználói identitást mutat (kecses fallbackkel).
- **Ollama in-app modell-letöltés (commit `101d63d`):** streaming NDJSON `POST /providers/{id}/models/pull` + **„Modell letöltése"** Settings-UI élő progress-szel.
- **CodexProgression „állapot az N. jelenetnél" (commit `f8036e1`):** join-alapú linearizáció, amely a progresszió-jegyzeteket az AI-kontextusba szűri (migráció nélkül); a **horgony nélküli** progresszió projekt-globális baseline, a **horgonyzott** könyv+pozíció-scope-olt. Ezzel a RAG-kontextus időhelyesen szűri a jövőbeli állapotokat.
- **DB-keményítés migráció `a8c4e1f2b3d4` (commit `8e5c0ed`):** 17 FK-index, **ivfflat → hnsw** (`vector_cosine_ops`), `server_default`-ok. (Ez a korábban „halasztott biztonságos DB-keményítés" tételt zárja le.)
- **E2E (commit `78c6d88`):** **NEM volt blokkolva** — az `app` csomagnév-ütközés non-issue a per-process `uv run --directory` alatt; CI-gated lokális `webServer` került a playwright-configba; a smoke **fut/zöld**. (Részletek a c) szakaszban.)
- **Delight — HSR-ihletésű, visszafogott „celestial calm" (commitok `6354035`, `1bd977a`):** `CelestialBackdrop` a dashboard-heron + üres állapotokon, **AI-result reveal shimmer** + lágy kártya-aurák. Tisztán token-alapú, **reduced-motion-safe**. (A design-rollout ezzel teljes — lásd `docs/18`.)
- **Két adverszariális audit-kör** (frontend-live + backend-sweep, majd egy záró friss pass): minden **P1/P2** találat javítva — auth a prompt-GET-eken, streaming-pull teszt-lefedettség, **konstans-idejű login**, hollow tesztek keményítése stb. **Nincs P0.** Záró suite-ek: **web 803, api 534, ai 396 zöld; tsc + lint tiszta; egyetlen alembic head.**

### Minőség + CI + biztonság
- **C0:** GitHub Actions CI (`.github/workflows/ci.yml`) + zöld repo-szintű ruff baseline + a korábban üres `initial_schema` migráció javítva, így `alembic upgrade head` működik.
- `packages/shared`: OpenAPI-generált TS-típusok (openapi-typescript) `MatchesContract` fordításidős guarddal a FE Zod-sémákhoz kötve (leváltotta az interim fixture drift-guardot); CI freshness-check.
- **Teszt-keményítés + valódi biztonsági javítás:** egy adverszariális teszt-audit kiderítette, hogy a catch-all 500-handler `str(exc)`-et visszhangzott (kivétel-üzenetbe ágyazott titok kiszivárgott a kliensnek) — javítva generikus üzenetre + szerver-oldali logra **mindkét** appban; emellett egy valódi `word_count`-archiváltat-is-számol bug + több üres teszt javítva (mindegyik mutation-proven).
- **Codebase-health refaktorok:** `safe_error` deduplikálva az `alexandria_core.core.errors`-ba (a per-app másolatok törölve, az `apps/api`-é halott kód volt); közös `idString` primitív (`apps/web/lib/api/schema-primitives.ts`); `resolveBookById` párhuzamosítva; halott group-by dropdown eltávolítva; `exportQueryKeys.book()` factory (hardcode-olt cross-domain query-key kiváltva); kitchen-sink dev-galéria production buildből kizárva; az `ACTION_INSTRUCTION` rewrite-promptok kiemelve a React-komponensből az `apps/web/lib/ai/action-instructions.ts`-be (CLAUDE.md-megfelelőség).
- **Valódi per-teszt DB-izoláció:** mindkét conftest `db_session`-je `join_transaction_mode="create_savepoint"`-ot használ egy külső, teardownnál visszagörgetett tranzakción belül; egy követő javítás átveszi a pysqlite `BEGIN`-kibocsátását, mert a savepoint az aiosqlite-on néma NO-OP volt (a commitolt sorok átszivárogtak a tesztek közt a default SQLite-backenden — a CI csak azért volt zöld, mert Postgresen fut). Mutation-proven cross-teszt szivárgás-őr: `apps/api/tests/integration/test_db_isolation.py`. Ez lezárja a korábbi sorrend-függő CI-bukások okát.

---

## c) Roadmap — mi van hátra (konszolidált)

> **Frissen lezárt tételek (lásd b):** RAG Q&A (Kutatás) · revízió-böngésző + diff/restore · DOCX/EPUB/**PDF** export · provider-hub + provider-titok-titkosítás · projekt-backup/restore · sorozat-scope · cselekményszálak · folytonosság-ellenőrző · **design-system (Phase 1+2) + Claude Design re-skin (DESIGN-A + B + C) + delight (celestial)** · **kép-generálás (Phase 1) + borító-generálás (Phase 2)** · RQ async worker · Lighthouse CI gate · **backend-audit keményítés (`8a72244`)** · **Prompt Library backend (`PromptTemplate` + CRUD)** · **Profil `me` endpoint + `scene_count` aggregátum** · **Ollama in-app modell-letöltés (pull)** · **CodexProgression „állapot az N. jelenetnél" RAG-szűrés** · **DB-keményítés migráció `a8c4e1f2b3d4` (FK-indexek + hnsw)**. Ezek a **b)** szakaszban dokumentáltak — itt már nem szerepelnek.

A maradék két csoportba esik: **V1-rések** (a V1-et lezáró konkrét tételek) · **Halasztott / V2**. (A **DESIGN-C** net-új design-képernyők leszállítva — lásd b) + `docs/18`.)

### V1-rések

A V1-et lezáró, még valóban nyitott tételek. (A korábbi rés-lista nagy részét az
előző kör leszállította — lásd b) + a fenti „frissen lezárt" callout; azok itt már
nem szerepelnek.)

| Tétel | Scope (1 sor) | Hol |
|---|---|---|
| **Prompt-template inline szerkesztő-UI** | A `PromptTemplate` backend (PATCH + DELETE) **kész**, és a frontendből a **létrehozás + törlés** is megy; ami hátra van: a meglévő (nem-builtin) sablonok **inline szerkesztése** a UI-ból | FE |
| CodexProgression editor + timeline-overlay | Progresszió-szerkesztő UI + idősor progresszió-réteg (az AI-kontextus-szűrés már él — lásd b); projekt-scope progresszió-lista endpoint kell | BE (`apps/api`) + FE |
| Plotline lane-vizualizáció | Cselekményszál-sávok vizuális megjelenítése | FE |
| Áttekintés-képernyő kitöltése | Az **Áttekintés** (`/attekintes`) valódi tartalma — **nincs a design-canvasban**, ma `ScreenPlaceholder` (V1-rés, nem design-képernyő; lásd `docs/18`) | FE |
| E2E mélyítése | A Playwright **smoke fut/zöld** (commit `78c6d88`; a CI-gated lokális `webServer` a configban). Az `app` csomagnév-ütközés **non-issue** — a CI `e2e` job a web + api + ai szolgáltatásokat **külön processzként** indítja (`uv run --directory apps/api\|apps/ai uvicorn app.main:app`), így mindegyik a SAJÁT `app` csomagját oldja fel; web Dockerfile sem kell (`next start`). Hátralevő munka: mélyebb journey-k + az advisory `e2e` (`continue-on-error`) kapu **kötelezővé** tétele | infra/FE |

### Halasztott / V2

| Tétel | Scope (1 sor) | Hol |
|---|---|---|
| Audio domain + EPUB-3 media-overlay (SMIL) | Hang-szövegrész horgony-modell + SMIL exporter; saját spec kell | BE + FE + infra |
| Kollaboráció / megosztás | Több-felhasználós, szerepkörök, presence, realtime — Auth.js átalakítás kell | BE + FE + infra |
| MCP providerek | Szerver-toggle-ök + MCP-integráció | BE + FE |
| NSFW / reasoning toggle + modell-presetek | Generálási-mód kapcsolók + modell-csomagok | BE + FE |
| Marketplace / launch | Launch-kit, marketplace | termék |
| Design delight: embers canvas | Hangulati parázs-canvas háttér-effekt (opcionális; a visszafogott „celestial" delight-pass már landolt — lásd b) + `docs/18`) | FE |

---

## d) Javasolt következő kör

Érték/kockázat arány szerint (a RAG, revíziók, design-rendszer + delight, kép/borító-gen, RQ worker, Lighthouse gate, a teljes Claude Design re-skin — DESIGN-A + B + C — **és az előző V1-rés-záró kör** — PDF export, Prompt Library backend, Profil `me` + `scene_count`, Ollama-pull, CodexProgression RAG-szűrés, DB-keményítés migráció — immár KÉSZ; lásd b):

1. **E2E mélyítése + a kapu kötelezővé tétele** — a Playwright smoke már zöld (commit `78c6d88`; az `app` csomagnév non-issue a per-process `uv run --directory` alatt). Következő lépés: mélyebb journey-k (auth → projekt → generálás → jóváhagyás) + az advisory `e2e` (`continue-on-error`) kapu **kötelezővé** tétele.
2. **Prompt-template inline szerkesztő-UI** — a backend (PATCH + DELETE) és a létrehozás/törlés-UI kész; a meglévő sablonok inline szerkesztése zárja a Prompt Library rést.
3. **CodexProgression editor + timeline-overlay** — az AI-kontextus-szűrés már él (commit `f8036e1`); ami hátra van: a progresszió-szerkesztő UI + idősor progresszió-réteg (+ projekt-scope progresszió-lista endpoint).
4. **Áttekintés-képernyő** + **Plotline lane-vizualizáció** — a maradék két FE-rés.
