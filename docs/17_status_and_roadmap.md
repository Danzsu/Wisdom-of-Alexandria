# 17 — Állapot és roadmap (élő)

Ez a dokumentum az **autoritatív, élő állapot- és roadmap-leírás**. Ahol más doc (pl. `docs/14`) korábbi tervezési prózát tartalmaz, ott az ottani szöveg történeti kontextus — a tényleges állapotot mindig ez a fájl írja felül.

---

## a) Jelenlegi állapot (2026-07-02)

**Architektúra (egysoros):** local-first, magyar nyelvű, agentic regényíró-workspace; **két, külön deployolható backend-szolgáltatás** — `apps/api` (domain/CRUD, `:8000`) + `apps/ai` (AI/agentic + provider/jobs, `:8001`) — közös `packages/db` (`alexandria_core`) Python-csomagon és közös PostgreSQL-en (a HITL-kontraktus DB-szinten köt; a két app sosem hivatkozik egymásra). Frontend: `apps/web` (Next.js 15). A FE/BE típuskontraktus a `packages/shared` OpenAPI-generált TS-típuscsomagon át fut, fordításidős `MatchesContract` guarddal a Zod-sémákhoz kötve.

**Teszt-állás (autoritatív szám):**

| Csomag | Tesztek | Megjegyzés |
|---|---|---|
| `apps/api` | **582** | CI-ban (Postgres) futnak; a pandoc/weasyprint-igényes tesztek lokálisan skippelnek |
| `apps/ai` | **519** | a pgvector-tesztek SQLite-on skippelnek; CI Postgresen futtatja őket |
| `apps/web` | **1001** | — (Phase-1/2 design + state-minták + re-skin + DESIGN-C + delight + fejezet-automatizáció + design-delta + **GAP-FIX program** tesztjeivel) |

Összesen **2102 teszt**; egyetlen alembic head (`e9f0a1b2c3d4`).

ruff / type-check / lint tiszta; az anti-pattern detektor anti-pattern-mentes.

**CI:** a `feat/alexandria-ui` ág fel van pusholva originra, és a **GitHub Actions CI ZÖLD** (a GAP-FIX kör után is — az ág CI-ját a `437f147` javította: realm-safe Blob assertion + ruff UP017): backend ruff + `alembic upgrade head` Postgresen + pytest (pgvector + pandoc) · frontend type-check / lint / vitest · shared-types frissesség-check · **advisory (non-blocking) Lighthouse job (küszöb 0.75)** · **advisory `e2e` job** — immár **3 Playwright journey-speckel**, a korábban némán hibás e2e-invokáció javítva.

**Branch/push:** `feat/alexandria-ui` @ origin, zöld CI. A GAP-FIX program commitjai (`568a28d` … `7417f23` + `437f147`) commitolva + pusholva; ez a doc-kör csak Markdown, commit nélkül.

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
- **Prompt Library backend (commit `a794b55`, auth-on-reads `ec0a286`):** a `/promptok` képernyő mostantól valódi, **workspace-globális `PromptTemplate`** entitásra épül — modell + migráció **`b3c5d7e9f1a2`** + 6 seedelt builtin + CRUD API (`/api/v1/prompt-templates`; builtin = immutábilis → **403**; auth a mutációkon **ÉS** az olvasásokon). A frontend az API-ról olvas, létrehozó modállal + törléssel, és a saját sablonok **inline szerkesztésével** (commit `953e7d2` — ceruza-gomb + prefilles edit-modal; a builtin sablonok érinthetetlenek).
- **`scene_count` aggregátum + `GET /api/v1/auth/me` (commit `a0bb5f1`):** a **Profil** mostantól a valós, összegzett jelenet-számot + valós felhasználói identitást mutat (kecses fallbackkel).
- **Ollama in-app modell-letöltés (commit `101d63d`):** streaming NDJSON `POST /providers/{id}/models/pull` + **„Modell letöltése"** Settings-UI élő progress-szel.
- **CodexProgression „állapot az N. jelenetnél" (commit `f8036e1`):** join-alapú linearizáció, amely a progresszió-jegyzeteket az AI-kontextusba szűri (migráció nélkül); a **horgony nélküli** progresszió projekt-globális baseline, a **horgonyzott** könyv+pozíció-scope-olt. Ezzel a RAG-kontextus időhelyesen szűri a jövőbeli állapotokat.
- **DB-keményítés migráció `a8c4e1f2b3d4` (commit `8e5c0ed`):** 17 FK-index, **ivfflat → hnsw** (`vector_cosine_ops`), `server_default`-ok. (Ez a korábban „halasztott biztonságos DB-keményítés" tételt zárja le.)
- **E2E (commit `78c6d88`):** **NEM volt blokkolva** — az `app` csomagnév-ütközés non-issue a per-process `uv run --directory` alatt; CI-gated lokális `webServer` került a playwright-configba; a smoke **fut/zöld**. (Részletek a c) szakaszban.)
- **Delight — HSR-ihletésű, visszafogott „celestial calm" (commitok `6354035`, `1bd977a`):** `CelestialBackdrop` a dashboard-heron + üres állapotokon, **AI-result reveal shimmer** + lágy kártya-aurák. Tisztán token-alapú, **reduced-motion-safe**. (A design-rollout ezzel teljes — lásd `docs/18`.)
- **Két adverszariális audit-kör** (frontend-live + backend-sweep, majd egy záró friss pass): minden **P1/P2** találat javítva — auth a prompt-GET-eken, streaming-pull teszt-lefedettség, **konstans-idejű login**, hollow tesztek keményítése stb. **Nincs P0.** Záró suite-ek: **web 803, api 534, ai 396 zöld; tsc + lint tiszta; egyetlen alembic head.**

### Új a legutóbbi frissítés óta (2026-06-26 — Fejezet-automatizáció, V2 első szelet)

- **Fejezet-automatizáció — V2 első szelet (commitok `6b29d7f`, `12846e0`, `7fe6dbb`, `a2aaf32`):** egy egész fejezet **jelenetenkénti** generálása az egyes jelenetek beat-jeiből, **egyetlen RQ háttér-jobként**, jelenetenként **egy jóvá nem hagyott `Revision`-t** produkálva — a HITL érintetlen, semmi nem ír felül automatikusan. Ezzel leszállt a korábban **halasztott MVP #11** (chapter automation). Részletek:
  - `AIService.generate_scene_revision` (job nélküli, újrahasználható jelenet-szintű mag) + `analyze_continuity_text` (job nélküli folytonosság-mag, amely a **generált** revízió-szöveget ellenőrzi);
  - `POST /ai/chapters/{id}/generate` (auth, **202**) — validálja a fejezet/jelenet-tagságot + hogy minden kiválasztott jelenetnek van beatje; létrehoz egy szülő `GenerationJob(chapter_generate)`-et + enqueue-ol;
  - `run_chapter_generation_job` (RQ worker, az `index_job`-mintát követve): a kiválasztott jeleneteket sorrendben végigjárja, jelenetenként egy `Revision(approved=false)` a szülő jobhoz kötve, **jelenetenként izolált hiba** (a job DONE-nal zár részleges eredménnyel), élő progress az `output_data`-ban, opcionális `run_continuity`;
  - Frontend: `GenerateChapterDialog` (jelenetenkénti checkboxok — üres+beat-es előre pipálva, nem-üres+beat-es opt-in, beat nélküli letiltva), trigger a plan-board fejezet-fejlécén; az AI-jobs képernyő élő fejezet-job progresszt + inline jelenetenkénti review-t mutat (a meglévő revízió-jóváhagyást újrahasználva).
  - DB-migráció nincs. Tesztek: **web 830 / api 536 / ai 422 zöld**; a nagy tétű utak mutation-checkkel ellenőrizve.
  - Scope: **fejezet-szint** (a könyv-szint későbbi bővítés); writer-only default a folytonossággal mint opt-in. Fast-follow-ok: jelenetenkénti modell-override + gazdagabb batch-review panel (lásd c) Halasztott / V2).

### Új a legutóbbi frissítés óta (2026-06-26 — Design-delta kör)

A user **Claude Design** canvasa frissült és **újra-importálva** lett (forrásfájl
**161KB → 261KB**), majd összevetve (reconcile) az appal. **5 net-új képernyő** épült
+ **4 meglévő** igazítva (mind commitolva + pusholva a `feat/alexandria-ui` ágon).
Részletek: `docs/18` g) szakasz.

- **Net-új képernyők (5, KÉSZ):** **Áttekintés** (könyv-dashboard — a `/attekintes`
  placeholder kitöltve, commit `32486eb`) · **Stíluskalauz** (Style Guide — net-új
  `/stiluskalauz` route a `StyleGuide` backendhez kötve, `1056e2f`) ·
  **Verzióelőzmények** (Revision History jobbról-csúszó panel diffel + restore-ral, a
  Write inspektorba kötve, `06633e6`) · **Scene Metadata modal** (terv-board
  jelenet-kártya „Info" gomb, `b9461c5`) · **Codex Image Lightbox** (`d316528`).
- **Igazított meglévő képernyők (4, KÉSZ):** **Write** (folytonosság-toolbar badge +
  `::selection` styling, `5567069`) · **Onboarding** (scroll-narratíva →
  lépés-karusszel, `1231540`) · **Import dialógus** (dropzone + fájl-infó kártya,
  `63bf38d`) · **Új könyv wizard** (arany fejléc + recap kártya, `10bb71b`).
- **Hatás a réseken:** az **Áttekintés** ezzel **megépült** — már nem V1-rés; a
  `hangok` (Hangkönyvtár) maradt az **egyetlen** placeholder-képernyő.
- **3 tétel tudatosan elhalasztva** (backend vagy kockázatos restrukturálás kell) —
  lásd a c) Roadmap design-delta sorait.
- Web teszt-szám **~887 zöld**; tsc + lint tiszta.

### Új a legutóbbi frissítés óta (2026-07-02 — GAP-FIX program)

Egy átfogó gap-audit után két implementációs hullám zárta a feltárt réseket (commitok `568a28d` … `7417f23` + CI-javítás `437f147`, mind pusholva a `feat/alexandria-ui` ágon):

- **W1–W2 — backend-rések + Codex/beat UI:**
  - **Codex Kapcsolatok + Progresszió tab** a Codex-detailben (`relations-tab.tsx`, `progression-tab.tsx`) — a régóta létező CRUD-backendek + az „állapot az N. jelenetnél" RAG-szűrés mostantól **felhasználó által elérhetők**; a progresszió-szerkesztő UI ezzel KÉSZ (az idősor progresszió-overlay maradt — lásd c);
  - **`Scene.location_id`** + migráció **`d7e8f9a0b1c2`** (backup round-trip, restore-sorrend javítással);
  - **Job-megszakítás:** `POST /jobs/{id}/cancel` — kooperatív cancel **mindhárom worker-típusban**, `cancelled` státusz + UI-affordance a feladatok-képernyőn;
  - **Ollama health-ping:** `GET /providers/{id}/health`;
  - **PromptTemplate használat-számláló** (`POST /prompt-templates/{id}/use`);
  - **Borító az exportban:** a kanonikus borító beágyazva az **EPUB**-ba (+ **PDF** borító-oldal) + a docker **media-volume javítás** (közös `media_data` volume — az api konténer korábban nem látta a borítókat);
  - **Beat-szerkesztő:** inspektor **„Beatek" tab** (`SceneBeatsPanel`) — lista / hozzáadás / szerkesztés / törlés / drag-átrendezés.
- **W3–W5 + bekötés:**
  - **Valódi parancspaletta-keresés** (jelenetek + Codex-bejegyzések); **szerkesztő undo/redo UI** (+ egy lappangó **jelenetváltás-undo-korrupciós bug javítva**: a scene-switch seedek nem kerülnek a history-ba); **sorozat-létrehozás** a Codex scope-pickeréből (`NewSeriesModal`); őszinte **„Fejezet kész" banner** a fejezet-jobokon;
  - **Brainstorm / Expand / Compress** AI-műveletek end-to-end: endpointok + hu/en prompt-sablonok + inspektor **„Ötletelés" panel** + **Bővítés/Tömörítés** a rewrite HITL-síneken;
  - **Könyv-szintű automatizáció** end-to-end: `POST /ai/books/{id}/generate` + `run_book_generation_job` + `GenerationJob.book_id` migráció (**`e9f0a1b2c3d4`**) + **„Könyv generálása"** dialógus az Áttekintésen + könyv-job progressz **fejezetenkénti review-val** + job-cancel UI (a HITL érintetlen: jelenetenként egy jóvá nem hagyott Revision);
  - **Infra:** auto-migráló api **docker-entrypoint** (`alembic upgrade head` az uvicorn előtt) + healthcheck-gating; **idempotens magyar demo-seed** (`python -m app.seed`, „A tenger emlékezete"); husky pre-push élesítve; dependabot; CORS-szigorítás; SECRET_KEY prod-guard; Lighthouse-küszöb 0.75; **3 Playwright journey-spec** + a némán hibás CI e2e-invokáció javítva; a branch CI un-broken (`437f147`).

Tesztek: **web 1001 / api 582 / ai 519 zöld** (összesen **2102**); egyetlen alembic head (`e9f0a1b2c3d4`); tsc + lint + ruff tiszta.

### Minőség + CI + biztonság
- **C0:** GitHub Actions CI (`.github/workflows/ci.yml`) + zöld repo-szintű ruff baseline + a korábban üres `initial_schema` migráció javítva, így `alembic upgrade head` működik.
- `packages/shared`: OpenAPI-generált TS-típusok (openapi-typescript) `MatchesContract` fordításidős guarddal a FE Zod-sémákhoz kötve (leváltotta az interim fixture drift-guardot); CI freshness-check.
- **Teszt-keményítés + valódi biztonsági javítás:** egy adverszariális teszt-audit kiderítette, hogy a catch-all 500-handler `str(exc)`-et visszhangzott (kivétel-üzenetbe ágyazott titok kiszivárgott a kliensnek) — javítva generikus üzenetre + szerver-oldali logra **mindkét** appban; emellett egy valódi `word_count`-archiváltat-is-számol bug + több üres teszt javítva (mindegyik mutation-proven).
- **Codebase-health refaktorok:** `safe_error` deduplikálva az `alexandria_core.core.errors`-ba (a per-app másolatok törölve, az `apps/api`-é halott kód volt); közös `idString` primitív (`apps/web/lib/api/schema-primitives.ts`); `resolveBookById` párhuzamosítva; halott group-by dropdown eltávolítva; `exportQueryKeys.book()` factory (hardcode-olt cross-domain query-key kiváltva); kitchen-sink dev-galéria production buildből kizárva; az `ACTION_INSTRUCTION` rewrite-promptok kiemelve a React-komponensből az `apps/web/lib/ai/action-instructions.ts`-be (CLAUDE.md-megfelelőség).
- **Valódi per-teszt DB-izoláció:** mindkét conftest `db_session`-je `join_transaction_mode="create_savepoint"`-ot használ egy külső, teardownnál visszagörgetett tranzakción belül; egy követő javítás átveszi a pysqlite `BEGIN`-kibocsátását, mert a savepoint az aiosqlite-on néma NO-OP volt (a commitolt sorok átszivárogtak a tesztek közt a default SQLite-backenden — a CI csak azért volt zöld, mert Postgresen fut). Mutation-proven cross-teszt szivárgás-őr: `apps/api/tests/integration/test_db_isolation.py`. Ez lezárja a korábbi sorrend-függő CI-bukások okát.

---

## c) Roadmap — mi van hátra (konszolidált)

> **Frissen lezárt tételek (lásd b):** RAG Q&A (Kutatás) · revízió-böngésző + diff/restore · DOCX/EPUB/**PDF** export · provider-hub + provider-titok-titkosítás · projekt-backup/restore · sorozat-scope · cselekményszálak · folytonosság-ellenőrző · **design-system (Phase 1+2) + Claude Design re-skin (DESIGN-A + B + C) + delight (celestial)** · **kép-generálás (Phase 1) + borító-generálás (Phase 2)** · RQ async worker · Lighthouse CI gate · **backend-audit keményítés (`8a72244`)** · **Prompt Library backend (`PromptTemplate` + CRUD)** · **Profil `me` endpoint + `scene_count` aggregátum** · **Ollama in-app modell-letöltés (pull)** · **CodexProgression „állapot az N. jelenetnél" RAG-szűrés** · **DB-keményítés migráció `a8c4e1f2b3d4` (FK-indexek + hnsw)** · **fejezet-automatizáció (V2 első szelet — a halasztott MVP #11)** · **GAP-FIX program (2026-07-02):** Codex Kapcsolatok+Progresszió tab UI · beat-szerkesztő · job-cancel · Ollama health-ping · borító-beágyazott EPUB/PDF export · `Scene.location_id` · valódi parancspaletta-keresés · undo/redo · brainstorm/expand/compress · **könyv-szintű automatizáció** · demo-seed + auto-migráló entrypoint + husky/dependabot/CORS/SECRET_KEY-guard. Ezek a **b)** szakaszban dokumentáltak — itt már nem szerepelnek.

A maradék két csoportba esik: **V1-rések** (a V1-et lezáró konkrét tételek) · **Halasztott / V2**. (A **DESIGN-C** net-új design-képernyők leszállítva — lásd b) + `docs/18`. A **2026-06-26 design-delta kör** további 5 net-új képernyőt szállított — köztük az **Áttekintést**, ami ezzel **megépült** és kikerült a V1-résekből; a `hangok` az egyetlen megmaradt placeholder. A delta 3 elhalasztott tétele alább, a Halasztott / V2 listában.)

### V1-rések

A V1-et lezáró, még valóban nyitott tételek. (A korábbi rés-lista nagy részét az
előző kör leszállította — lásd b) + a fenti „frissen lezárt" callout; azok itt már
nem szerepelnek.)

| Tétel | Scope (1 sor) | Hol |
|---|---|---|
| Idősor progresszió-overlay | A progresszió-**szerkesztő** UI a GAP-FIX körben leszállt (lásd b); ami maradt: a progresszió-réteg megjelenítése az Idősor nézeten | FE |
| Plotline lane-vizualizáció | Cselekményszál-sávok vizuális megjelenítése | FE |
| E2E kapu kötelezővé tétele | A **3 Playwright journey-spec megírva** + a némán hibás CI e2e-invokáció javítva (lásd b — GAP-FIX); hátra: az advisory `e2e` (`continue-on-error`) kapu **kötelezővé** tétele stabil CI-futások után | infra |
| Plan-board virtualizáció | Nagy könyvek terv-boardjának lista-virtualizációja — **folyamatban** | FE |
| Offline autosave-queue | Kapcsolatvesztést túlélő, sorba állított autosave (resilience) — **folyamatban** | FE |

### Halasztott / V2

| Tétel | Scope (1 sor) | Hol |
|---|---|---|
| Automatizáció fast-follow-ok | A **fejezet- ÉS könyv-szintű** batch-generálás KÉSZ (lásd b — GAP-FIX); hátra: **jelenetenkénti modell-override** + gazdagabb **batch-review panel** | BE (`apps/ai`) + FE |
| Audio domain + EPUB-3 media-overlay (SMIL) | Hang-szövegrész horgony-modell + SMIL exporter; saját spec kell (a `hangok` az egyetlen placeholder-képernyő) | BE + FE + infra |
| Kollaboráció / multi-user + ownership | Több-felhasználós működés, ownership + szerepkörök (a **V1-cloud blockere**), presence, realtime — Auth.js átalakítás kell | BE + FE + infra |
| Deploy-pipeline | A CI deploy-lépés (Vercel + Cloud Run) élesítése / végigvitele | infra |
| LICENSE | Licenc-döntés + LICENSE fájl a repóba | termék |
| EN UI | Angol felület (a UI ma magyar-only; a prompt-sablonok hu/en már léteznek) | FE |
| AIComment-döntés | A meglévő `AIComment` entitás sorsa: a margókomment-funkció bekötése vagy elvetése | BE + FE |
| MCP providerek | Szerver-toggle-ök + MCP-integráció | BE + FE |
| NSFW / reasoning toggle + modell-presetek | Generálási-mód kapcsolók + modell-csomagok | BE + FE |
| Marketplace / launch | Launch-kit, marketplace | termék |
| Design delight: embers canvas | Hangulati parázs-canvas háttér-effekt (opcionális; a visszafogott „celestial" delight-pass már landolt — lásd b) + `docs/18`) | FE |
| Design-delta: Write fókusz-mód lebegő toolbarok | A 2026-06-26 delta-körben elhalasztva — a működő fókusz mód (Esc-kilépés / chrome-rejtés contract) restrukturálását igényelné; külön tervezett task | FE |
| Design-delta: Import „felismert struktúra" előnézet | Fejezet-lista + darabszámok az import *előtt* — hiányzó backend parse-preview endpointot igényel (a darabszámok már megjelennek import *után*) | BE (`apps/api`) + FE |
| Design-delta: Új könyv wizard premise / tónus-pillek / „start-mode" 4. lépés | Backendet igényel + módosítaná a create payloadot | BE + FE |

---

## d) Javasolt következő kör

Érték/kockázat arány szerint (a **GAP-FIX program** — Codex Kapcsolatok+Progresszió UI, beat-szerkesztő, job-cancel, brainstorm/expand/compress, **könyv-szintű automatizáció**, borító-beágyazott exportok, demo-seed + infra-keményítés — immár KÉSZ; lásd b):

1. **A folyamatban lévő tételek lezárása** — plan-board virtualizáció + offline autosave-queue (mindkettő elkezdve — lásd c) V1-rések).
2. **E2E kapu kötelezővé tétele** — a 3 journey-spec már fut a CI-ban; stabil futások után az advisory `e2e` (`continue-on-error`) kapu kötelezővé tétele.
3. **Idősor progresszió-overlay + plotline lane-vizualizáció** — a két megmaradt FE-vizualizációs rés.
4. **Multi-user / ownership** — a V1-cloud blockere (Auth.js átalakítás; nagyobb falat, külön spec kell).
