# 17 — Állapot és roadmap (élő)

Ez a dokumentum az **autoritatív, élő állapot- és roadmap-leírás**. Ahol más doc (pl. `docs/14`) korábbi tervezési prózát tartalmaz, ott az ottani szöveg történeti kontextus — a tényleges állapotot mindig ez a fájl írja felül.

---

## a) Jelenlegi állapot (2026-06-21)

**Architektúra (egysoros):** local-first, magyar nyelvű, agentic regényíró-workspace; **két, külön deployolható backend-szolgáltatás** — `apps/api` (domain/CRUD, `:8000`) + `apps/ai` (AI/agentic + provider/jobs, `:8001`) — közös `packages/db` (`alexandria_core`) Python-csomagon és közös PostgreSQL-en (a HITL-kontraktus DB-szinten köt; a két app sosem hivatkozik egymásra). Frontend: `apps/web` (Next.js 15). A FE/BE típuskontraktus a `packages/shared` OpenAPI-generált TS-típuscsomagon át fut, fordításidős `MatchesContract` guarddal a Zod-sémákhoz kötve.

**Teszt-állás (autoritatív szám):**

| Csomag | Tesztek | Megjegyzés |
|---|---|---|
| `apps/api` | **~493** | CI-ban (Postgres) futnak; +3 pandoc-skip lokálisan |
| `apps/ai` | **~260** (Postgres) / **~255** (SQLite) | a pgvector-tesztek SQLite-on skippelnek; CI Postgresen futtatja őket |
| `apps/web` | **634** | — |

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

### Minőség + CI + biztonság
- **C0:** GitHub Actions CI (`.github/workflows/ci.yml`) + zöld repo-szintű ruff baseline + a korábban üres `initial_schema` migráció javítva, így `alembic upgrade head` működik.
- `packages/shared`: OpenAPI-generált TS-típusok (openapi-typescript) `MatchesContract` fordításidős guarddal a FE Zod-sémákhoz kötve (leváltotta az interim fixture drift-guardot); CI freshness-check.
- **Teszt-keményítés + valódi biztonsági javítás:** egy adverszariális teszt-audit kiderítette, hogy a catch-all 500-handler `str(exc)`-et visszhangzott (kivétel-üzenetbe ágyazott titok kiszivárgott a kliensnek) — javítva generikus üzenetre + szerver-oldali logra **mindkét** appban; emellett egy valódi `word_count`-archiváltat-is-számol bug + több üres teszt javítva (mindegyik mutation-proven).
- **Codebase-health refaktorok:** `safe_error` deduplikálva az `alexandria_core.core.errors`-ba (a per-app másolatok törölve, az `apps/api`-é halott kód volt); közös `idString` primitív (`apps/web/lib/api/schema-primitives.ts`); `resolveBookById` párhuzamosítva; halott group-by dropdown eltávolítva; `exportQueryKeys.book()` factory (hardcode-olt cross-domain query-key kiváltva); kitchen-sink dev-galéria production buildből kizárva; az `ACTION_INSTRUCTION` rewrite-promptok kiemelve a React-komponensből az `apps/web/lib/ai/action-instructions.ts`-be (CLAUDE.md-megfelelőség).
- **Valódi per-teszt DB-izoláció:** mindkét conftest `db_session`-je `join_transaction_mode="create_savepoint"`-ot használ egy külső, teardownnál visszagörgetett tranzakción belül; egy követő javítás átveszi a pysqlite `BEGIN`-kibocsátását, mert a savepoint az aiosqlite-on néma NO-OP volt (a commitolt sorok átszivárogtak a tesztek közt a default SQLite-backenden — a CI csak azért volt zöld, mert Postgresen fut). Mutation-proven cross-teszt szivárgás-őr: `apps/api/tests/integration/test_db_isolation.py`. Ez lezárja a korábbi sorrend-függő CI-bukások okát.

---

## c) Roadmap — mi van hátra

Prioritás: **P1-maradék** = kis, V1-záró tételek · **P2** = magas user-érték · **P3** = később / nagy spec.

> **Lezárt P1-tételek (lásd b):** RQ async worker → **KÉSZ** (valódi RQ index-job bizonyítja a worker-infrát) · Lighthouse CI gate → **KÉSZ** (advisory, non-blocking job).

### P1-maradék (kicsi)

| Tétel | Scope (1 sor) | Hol |
|---|---|---|
| Provider health-check befejezése | Ollama ping véglegesítése (a `/providers/{id}/test` már létezik) | BE (`apps/ai`) |

### P2 (magas user-érték)

| Tétel | Scope (1 sor) | Hol |
|---|---|---|
| ~~Codex → Kutatás (RAG Q&A)~~ **KÉSZ** | `POST /ai/research` (grounded válasz + idézet-chipek) + a `chat` route „Kutatás" képernyője | BE (`apps/ai`) + FE |
| ~~Revízió-böngésző + diff/restore~~ **KÉSZ** | Inspector „Revíziók" tab: szó-szintű diff + visszaállítás/elvetés | FE |
| **Kép-generálás — Phase 1 KÉSZ** | Codex karakter/helyszín képgenerálás Nano Banana (Gemini image) modellel: `MediaAsset` modell + migráció, `Provider.image_model`, `ModelRouter.generate_image` (google-genai), konzerv stílus-presetek `{placeholder}`-ekkel, RQ async job, `/ai/images` + `/ai/media`, Codex „Képek" panel kanonikus referenciával (HITL). Forrás: **CodexEntry** (entry_type+id). Deps: `google-genai`, `Pillow`; `media_dir` config. | BE + FE |
| Kép-generálás — Phase 2 (hátra) | **Borító-generátor**: Nano Banana Pro art (2:3, full-bleed) + app-oldali tipográfia-kompozit a KDP biztonsági zónán belül + template-ek | BE + FE |
| CodexProgression UI + timeline-overlay | Progresszió-szerkesztő + idősor progresszió-réteg; projekt-scope progresszió-lista endpoint kell | BE (`apps/api`) + FE |
| PDF export | Pandoc+LaTeX vagy Playwright HTML→PDF | BE (`apps/api`) + infra |
| MCP providerek | Szerver-toggle-ök + MCP-integráció | BE + FE |
| NSFW / reasoning toggle + modell-presetek | Generálási-mód kapcsolók + modell-csomagok | BE + FE |
| Ollama in-app modell-letöltés | „Modell letöltése" a Beállítások → Local alatt | BE (`apps/ai`) + FE |
| Tezaurusz / vizualizáció / vázlat-sablonok / daily-spark analitika | Magyar szinonima-szótár, képprompt, Save the Cat/Hős útja sablonok, writing-streak | BE + FE |
| UX-4c Figma MCP | Design-token szinkron (a user interaktív Figma-auth-ja kell) | FE + infra |
| Plotline lane-vizualizáció | Cselekményszál-sávok vizuális megjelenítése | FE |

### P3 (később / nagy spec)

| Tétel | Scope (1 sor) | Hol |
|---|---|---|
| Audio domain + EPUB-3 media-overlay (SMIL) | Hang-szövegrész horgony-modell + SMIL exporter; saját spec kell | BE + FE + infra |
| Kollaboráció / megosztás | Több-felhasználós, szerepkörök, presence, realtime — Auth.js átalakítás kell | BE + FE + infra |
| E2E (Playwright, két szolgáltatás) | **BLOKKOLT**: mindkét app a top-level `app` csomagnevet használja + nincs web Dockerfile — előbb ezeket kell feloldani | infra |
| Marketplace / launch | Launch-kit, marketplace | termék |

---

## d) Javasolt következő kör

A leg-ésszerűbb következő lépések, érték/kockázat arány szerint (az RQ worker és a Lighthouse gate immár KÉSZ — lásd b):

1. **Codex → Kutatás (RAG Q&A)** — a retrieval-infra már kész (`EmbeddingService` + projekt-scope-olt index), „csak" az interaktív Q&A-réteget kell rákötni. Magas user-érték, alacsony infra-kockázat.
2. **Revízió-böngésző + diff/restore** — a HITL-revíziók már perzisztálva vannak, a `DiffPane` is létezik; egy revízió-lista + diff/restore felület zárja a human-in-the-loop hurkot a felületen.
3. **E2E feloldása** — a Playwright kétszolgáltatásos E2E **blokkolt**, mert mindkét backend-app a top-level `app` Python-csomagnevet használja, és nincs web Dockerfile. A csomagnév-ütközés + a web Dockerfile feloldása nyitja meg az E2E-kört.
