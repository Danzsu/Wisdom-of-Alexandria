# 14 — Jövőbeli fejlesztési terv (backend-támogatás + halasztott funkciók)

> **⚠️ FIGYELEM — NAGYRÉSZT ELAVULT.**
> Az itt listázott **P1-tételek többsége MÁR LESZÁLLÍTOTT**: RAG (Codex + kézirat, pgvectoron), folytonosság-ellenőrző, DOCX/EPUB export (Pandoc), provider-konfiguráció, projekt backup/restore, sorozatok (series), cselekményszálak (plotlines), kapcsolati gráf, idősor és a design-rendszer alapjai — mind kész. Ez a dokumentum innentől **történeti tervezési kontextus**, nem teendőlista.
> **Az élő, autoritatív roadmap és állapot: [`docs/17_status_and_roadmap.md`](17_status_and_roadmap.md).**
>
> *(részben elavult — lásd `docs/17`; pl. az RQ async worker és a Lighthouse CI gate már KÉSZ)*

Ez a dokumentum összegyűjti azokat a funkciókat és **backend-bővítéseket**, amelyek a frontend MVP építése (M0–M8) során **szándékosan halasztva** lettek, vagy amelyekhez a backend jelenleg nem ad támogatást. A frontend ezeknél vagy stubot mutat, vagy egy dokumentált interim megoldást használ — mindegyik tételnél jelölve, hogy mit kell a backendnek megtámogatnia.

Prioritás: **P1** = V1-hez kell · **P2** = V2 · **P3** = később.

> **Az élő, autoritatív állapot- és roadmap-leírás: [`docs/17_status_and_roadmap.md`](17_status_and_roadmap.md).** Az alábbi tervezési próza történeti kontextus; a tényleges állapotot a `docs/17` (és az alábbi „Frissítés" szekció) írja felül.

---

## Frissítés (2026-06-16) — további lezárt tételek ✅

A `docs/14` „0. szekció" (2026-06-15) snapshot óta a következő, ott még „hátravan"-ként listázott tételek **ELKÉSZÜLTEK**. A teszt-állás és a CI-zöld tény autoritatívan a `docs/17`-ben van (apps/api 491 · apps/ai 243 · apps/web 624, GitHub Actions zöld).

- ✅ **DOCX/EPUB export Pandoc-on + DOCX import pipeline** (5/12) — pandoc subprocess, hangos hibakezelés, api Dockerfile + CI.
- ✅ **Projekt-aggregátumok** (7) — `book_count` + `word_count` a `ProjectRead`-en (archivált jelenetek KIZÁRVA), projekt-kártyákon.
- ✅ **RAG Codex + kézirat felett pgvectoron** (10) — dialektus-tudatos `Vector` + `Embedding` modell + `ModelRouter.embed()` + `EmbeddingService`; RAG-kontextus a rewrite/generate-scene/write-continue promptokban; `context_entities` chipek a result-kártyán.
- ✅ **RAG sorozat-tudatosság** (10) — `Embedding.series_id`; más sorozat codexe/kézirata nem szivárog be.
- ✅ **Folytonosság-ellenőrző** (10) — `POST /ai/continuity` (jelenet-scope, RAG-kontextus, strukturált severity/message/entity) + valódi Warnings tab.
- ✅ **Élő AI-jobs képernyő + nav-badge** (10) — book-scope `GET /jobs` + polling (interaktív AI szinkron marad).
- ✅ **Projekt JSON backup/restore** (12) — teljes-gráf verziózott export (titkok/embeddingek/jobs/revisions kizárva) + tranzakcionális restore FK-remappel.
- ✅ **Sorozat-scope Codex** (12) — `Series` entitás + `Book.series_id` + `CodexEntry.series_id`; scope-toggle `?series_id=`-szal; sorozat-kezelő UI.
- ✅ **Cselekményszálak** (új) — `Plotline` + `PlotlineScene` + CRUD + Cselekményszálak képernyő.
- ✅ **Kapcsolatok relationship graph** (10) — `CodexRelation` FE + egyedi SVG force-graph (d3-force, GSAP).
- ✅ **Idősor** (10) — fejezet/jelenet idősor a könyv-fából (GSAP spine-draw).
- ✅ **`packages/shared` OpenAPI-típusok** — `MatchesContract` fordításidős guard a Zod-sémákhoz; CI freshness-check.
- ✅ **C0 — GitHub Actions CI** + zöld repo-szintű ruff baseline + a korábban üres `initial_schema` migráció javítva (`alembic upgrade head` működik).
- ✅ **Teljes UI/UX-kör (UX-1…UX-4b)** — anti-pattern javítások, shortcut overlay, focus-paragraph mód, persistent AI-job indikátor, Framer Motion + GSAP onboarding, responsive tablet-first shell, axe-core a11y gate.
- ✅ **Teszt-keményítés + valódi biztonsági javítás** — a catch-all 500-handler `str(exc)`-szivárgása javítva (generikus üzenet + szerver-log) **mindkét** appban; `word_count`-archiváltat-is-számol bug + üres tesztek javítva (mutation-proven).

Az **1–6. pont** (Provider config, generálási paraméterek, Codex aliases/role, cross-chapter move, export-tartomány, provider-teszt) már a `docs/14` „0. szekció"-ban lezárult.

A **valódi maradék backlog** (P1-maradék / P2 / P3) a `docs/17` „Roadmap" szekciójában él táblázatosan.

---

## 0. Megvalósított állapot — backend szétválasztás + P1 gapek lezárva (2026-06-15) ✅

A frontend MVP (M0–M9) után két backend-kör zárult le. **A lenti 1–6. pontok backend-scope-ja jórészt MEGVALÓSULT** (a szövegek a tervezési kontextus miatt maradnak, de a tényleges állapotot ez a szekció írja felül).

### Véglegesített architektúra — két szolgáltatás közös shared libbel

A backend **két, külön deployolható szolgáltatásra** vált szét, közös PostgreSQL-lel és egy közös Python-csomaggal:

```text
packages/db/      → alexandria_core (shared lib): SQLAlchemy modellek (mind a 18) ·
                    db/session · core/{config,security,deps} · közös schemas (RevisionRead)
                    Mindkét szolgáltatás CSAK ezt importálja; egymást SOHA.

apps/api  (:8000) → DOMAIN szolgáltatás. Tisztán CRUD: projects/books/chapters/scenes/
                    beats/codex/characters/locations/worldbuilding/snippets/style_guide/
                    relations/progressions/auth/exports + revisions (list + approve/reject =
                    a human-in-the-loop, ami a Scene-t mutálja). Nulla AI-import.

apps/ai   (:8001) → AI/AGENTIC szolgáltatás (FastAPI + RQ worker). model_router ·
                    ai_service · prompt_loader · revision_service · provider_service ·
                    crypto. Endpointok: /ai/* (rewrite, describe, generate-scene,
                    write-continue, summarize, models) · /providers/* · /jobs.
                    A Revision/GenerationJob sorokat a közös DB-be írja; a domain
                    szolgáltatás olvassa/approve-olja (DB-szintű HITL-kontraktus).
```

**Integráció:** közös Postgres (a kontraktus DB-szinten köt) · közös `SECRET_KEY` → ugyanaz a JWT mindkét szolgáltatáson érvényes · függőségi irány egyirányú (`apps/api`→`alexandria_core`, `apps/ai`→`alexandria_core`, a két app sosem hivatkozik egymásra). **Frontend:** az AI/provider/job hívások a `NEXT_PUBLIC_AI_URL`-re (default `:8001`) mennek (`apiFetch` `baseUrl` override-dal), a domain hívások a `NEXT_PUBLIC_API_URL`-en (`:8000`) maradnak. **docker-compose:** új `ai` szolgáltatás + a `worker` az `apps/ai` image-ből (`python -m app.worker`) + a `web` mindkét base URL-t megkapja. **uv workspace:** `[tool.uv.workspace] members = ["apps/api", "apps/ai", "packages/db"]`.

### Lezárt P1 gapek

| # | Tétel | Állapot | Hol |
|---|---|---|---|
| 1 | **Provider/API-kulcs config** | ✅ `Provider` entitás + Alembic migráció; Fernet-titkosított kulcs (maszkolt Read, master kulcs `.env`-ből, hardcode-olt default nélkül — `_get_fernet()` hiányzó kulcsnál egyértelmű `RuntimeError`); `providers` CRUD + `/{id}/test`; a `ModelRouter` innen olvas | `apps/ai` |
| 2 | **Generálási paraméterek** | ✅ `temperature`/`max_tokens` opcionális mező minden AI-request sémán (validált bound-okkal), átadva a `ModelRouter.complete()`-nek; visszafelé kompatibilis | `apps/ai` |
| 3 | **Codex aliases/role** | ✅ valódi `aliases: list` + `role: str` oszlop (+ Alembic migráció); a frontend tags-kodek workaround **leváltva** közvetlen mezőkre | domain + `alexandria_core` |
| 4 | **Cross-chapter jelenet-mozgatás** | ✅ `POST /chapters/{cid}/scenes/{id}/move {chapter_id, order_index}`, cél-fejezet 404-validációval + kaszkád-helyes `order_index` | `apps/api` |
| 5 | **Export-tartomány** | ✅ `scope=book\|chapter\|scene` + `target_id`, **IDOR-biztos** tulajdon-ellenőrzéssel (Scene→Chapter→Book join) | `apps/api` |
| 6 | **Provider kapcsolat-teszt** | ✅ `POST /providers/{id}/test` (Ollama/cloud elérhetőség+auth). A lokális Ollama health-pont finomítása maradhat | `apps/ai` |

**Záró audit + tesztek:** a teljes-projekt audit lezárva (frontend error boundary-k bevezetve; backend AI-hiba-szivárgás/timeout/rollback/reorder-validáció/szószámlálás/status-enum javítva). Aktuális teszt-állás: **frontend 418 · apps/api 364 · apps/ai 139** (mind zöld). A két szolgáltatás külön indul; az AI-szeparáció `grep`-pel igazoltan egyirányú.

### Ami még HÁTRAVAN (a lenti pontok szerint)

A **P1 maradéka** (más körökben): RAG/pgvector + continuity endpoint (10) · élő RQ job-sor + polling/SSE (10) · import-pipeline DOCX (12) · projekt JSON backup/restore (12) · sorozat-scope Codex (12) · DOCX/EPUB export Pandoc-on (5). Plus a teljes **P2/P3** lista változatlan.

---

## 1. Provider- és API-kulcs konfiguráció ⭐ (kiemelt, P1)

**Cél:** a felhasználó a UI-ban megadhassa a felhő-providerek (Google AI Studio / Gemini, Anthropic / Claude, OpenAI, OpenRouter, és egyedi OpenAI-kompatibilis végpontok) **API-kulcsait és egyéb beállításait**, ezek **biztonságosan a backendben tárolódjanak**, és a `ModelRouter` ezekből dolgozzon.

**Jelenlegi állapot (M8):** a Beállítások → Cloud alfül **vizuális stub** (letiltott `PasswordInput` mezők, „V1-ben érkezik" jelölés). A lokális (Ollama) provider és a `GET /ai/models` config-vezérelt modell-lista már valódi.

### Frontend scope (a stub valódivá tétele)
- Beállítások → Cloud alfül: provider-kártyák **hozzáadás / szerkesztés / törlés** funkcióval.
- Providerenként: típus, megjelenítendő név, **API-kulcs** (`PasswordInput`, maszkolva — pl. `••••3f8a`, sosem teljes egészében visszaolvasva), opcionális **base URL** (egyedi/OpenAI-kompatibilis végponthoz), **alapértelmezett modell**, engedélyezve/letiltva kapcsoló.
- „Kapcsolat tesztelése" gomb providerenként (a backend health/validáció endpointját hívja — lásd 6. pont).
- A `ModelSelector` (M5) és a `GET /ai/models` (config-vezérelt) a beállított, engedélyezett providerek modelljeit listázza.
- **Soha nincs hardcode-olt modellnév vagy kulcs a frontendben** (CLAUDE.md szabály) — minden a backend configból jön.

### Backend scope (ezt kell megtámogatnia)
- **`Provider` entitás + tábla:** `{ id, type (ollama|gemini|anthropic|openai|openrouter|custom), label, api_key_encrypted, base_url?, default_model?, enabled, created_at, updated_at }`.
- **Biztonságos kulcs-tárolás:** a kulcs **titkosítva nyugalmi állapotban** (pl. `cryptography.fernet` szimmetrikus titkosítás egy `.env`-ből jövő master kulccsal, vagy OS keyring). A kulcs **soha nem kerül logba**, és a `Read` séma **maszkolt** értéket ad vissza (utolsó 4 karakter), sosem a teljeset.
- **Endpointok:** `GET /providers` (maszkolt lista), `POST /providers`, `PATCH /providers/{id}`, `DELETE /providers/{id}`, `POST /providers/{id}/test` (kulcs-validáció + elérhetőség), `GET /providers/{id}/models` (a provider API-jából lekért elérhető modellek).
- A **`ModelRouter`** a `Provider` configból olvassa a kulcsokat/base URL-eket (a jelenlegi `.env` `default_local_model` helyett dinamikusan), és a `GET /ai/models` ezek alapján aggregál.
- **Auth/biztonsági megjegyzés:** single-user MVP-ben is titkosítva tároljuk; a maszkolás és a „nincs teljes visszaolvasás" elv a felhős deploy (V1) előfeltétele.

---

## 2. Generálási paraméterek backend-támogatása (P1)

**Cél:** a `temperature` / `max_tokens` (Beállítások → Generálás) ténylegesen hasson a generálásra.

**Jelenlegi állapot (M8):** a frontend perzisztálja (Zustand + localStorage) és **opcionális body-mezőként már elküldi** minden AI-híváskor — de a backend AI-request sémák (`RewriteRequest` stb.) jelenleg **nem fogadják** ezeket (a FastAPI némán eldobja az ismeretlen mezőket, ezért ártalmatlan és előre-kompatibilis).

**Backend scope:** add `temperature: float | None` + `max_tokens: int | None` mezőket az AI-request sémákhoz (`apps/api/app/schemas` / `ai.py`), és a `ModelRouter.generate()` használja őket (per-action default helyett). Ettől a frontend által már küldött értékek azonnal élnek.

---

## 3. Codex `aliases` + `role` oszlopok (P1)

**Cél:** a karakter-álnevek (név-detektáláshoz — CLAUDE.md MVP-követelmény) és a story-role first-class mezők legyenek.

**Jelenlegi állapot (M6):** a `codex_entry` séma csak `{ title, entry_type, content, ai_visible, tags[] }`-t tartalmaz — **nincs dedikált `aliases`/`role` oszlop**. A frontend egy **namespace-elt `tags`-kodekkel** (`__woa:alias=`, `__woa:role=`, `__woa:tracking=off`) tárolja ezeket, ütközés-biztosan, de ez interim workaround.

**Backend scope:** add `aliases: list[str]` + `role: str | None` oszlopokat a `CodexEntry` modellhez/sémához (+ Alembic migráció). Ezzel a frontend kodek leváltható közvetlen mezőkre (a `lib/api/codex.ts` a kizárólagos változtatási pont), és az ütközés-kockázat teljesen megszűnik. A `tracking by name/alias` és a mezőszintű AI-láthatóság (CLAUDE.md V1) is ide épül.

---

## 4. Fejezetek-közti jelenet-mozgatás (P1)

**Cél:** a Plan Boardon (M7) a jelenet áthúzható legyen egy másik fejezetbe.

**Jelenlegi állapot (M7):** a `SceneUpdate` sémában **nincs `chapter_id`**, a reorder pedig fejezeten belüli — ezért a fejezetek-közti drop **no-op** (dokumentált). A jeleneten belüli + fejezet-sorrend reorder valódi (optimista + rollback).

**Backend scope:** engedd a `SceneUpdate.chapter_id` módosítását (vagy egy dedikált `POST /scenes/{id}/move {chapter_id, order_index}` endpoint), kaszkád-helyes `order_index` újraszámolással. A frontend `computeReorder` már felismeri a cross-chapter dropot — csak a mutáció hiányzik.

---

## 5. Export bővítés (P1–P2)

**Jelenlegi állapot (M8):** **valódi a teljes-könyv Markdown export** (letöltés + ASCII-folded fájlnév). A DOCX/EPUB/PDF/TXT formátumok és a fejezet/jelenet **tartomány** vizuális stubok.

**Backend scope:**
- **Tartomány-paraméter** az export endpointon (`scope=book|chapter|scene`, `target_id`) — a frontend radiók már megvannak (P1).
- **DOCX / EPUB** export Pandoc-on át (CLAUDE.md V1) (P1).
- **PDF** (Pandoc+LaTeX vagy Playwright HTML→PDF) (P2).
- **EPUB 3 media-overlay (SMIL)** a hang-szövegrészhez (lásd 9. pont) (P2).

---

## 6. Provider / lokális-modell health-check (P1)

**Cél:** a Beállítások → Local (Ollama/LM Studio) elérhetőség-jelző és a provider „Kapcsolat tesztelése" valódi legyen.

**Jelenlegi állapot (M8):** a health-jelző **őszinte stub** („elérhetőség ismeretlen"), mert nincs ping-endpoint.

**Backend scope:** `GET /providers/{id}/health` (vagy `GET /ai/health?provider=`) — Ollama `GET /api/tags`, felhő-providereknél egy könnyű auth-validáló hívás. A frontend a státusz-pontot ehhez köti.

---

## 7. Projekt-aggregátumok (P2)

**Cél:** a Projektek dashboard kártyái valós **könyvszámot + szószámot + dátumot** mutassanak.

**Jelenlegi állapot (M3):** a kártya csak a relatív `updated_at` dátumot mutatja valósan; a könyvszám/szószám hiányzott (nincs aggregát endpoint), ezért nincs koholt érték.

**Backend scope:** `ProjectRead`-be (vagy egy `GET /projects/summary` endpointba) `book_count` + `total_word_count` aggregátum.

---

## 8. Kép-beszúrás pipeline (P2)

**Cél:** valódi képbeszúrás a kéziratba / Codexbe / borítóhoz / portréhoz, és beágyazás az EPUB-ba.

**Jelenlegi állapot (M4/M6):** a Tiptap `ImagePlaceholder` node + portré/borító dropzone **csak lokális preview** (objectURL + alt/caption/layout a doc JSON-ban), **nincs feltöltés** („a feltöltés a V2-ben érkezik" toast).

**Backend scope:** media-asset tábla + feltöltő endpoint + tárhely (local-fs vagy S3-kompatibilis) + EPUB-image-embed az exportban. A frontend doc-JSON adatformája (alt/caption/layout) már megőrzött a későbbi bekötéshez.

---

## 9. Hang szövegrészhez (EPUB) — Hangkönyvtár (P2, saját spec kell)

**Cél:** atmoszféra/effekt/zene rendelése egy szövegrészhez, ami az EPUB 3 lejátszásban a megfelelő szakasznál indul (NEM felolvasás).

**Jelenlegi állapot:** a Hangkönyvtár képernyő, a ♪ `AudioMark` és a „Hang csatolása" modal teljesen **vizuális stub** (a ♪ mark `{audioId, scope, type}` formában mentődik a doc JSON-ba). A legnagyobb halasztott domain — **saját adat-modell + csomagolási spec kell hozzá**.

**Backend scope:** audio-asset tábla + feltöltés/tárhely + szövegrész↔hang horgony-modell + **EPUB 3 media-overlay (SMIL)** exporter. V2-feature-flag mögött, az MVP/V1 Markdown/DOCX exportból kizárva.

---

## 10. RAG / folytonosság / generálási sor (P1–P2)

A prototípus több AI-vezérelt képernyője mock/üres-állapotot mutat, mert a backend-háttér még nincs kész:
- **Áttekintés → folytonossági figyelmeztetések** (continuity checker, CLAUDE.md #10) — jelenleg M10/V1 üres-állapot.
- **AI feladatok** élő generálási sor (RQ worker + job-státusz polling vagy SSE) — a badge-szám 0 a worker-integrációig.
- **Codex → Kutatás** (RAG Q&A) + **Progresszió** (temporális) + **Kapcsolatok** (relations gráf) — V1 üres-állapotok.
- **RAG-kontextus chipek** az AI eredmény-kártyán — jelenleg csak a modell-chip valós; a behúzott Codex/jelenet-kontextus a pgvector-retrievalig üres.

**Backend scope:** pgvector Codex/jelenet-indexelés (CLAUDE.md #9), saliency/context-pack builder, continuity-checker agent, RQ job-státusz endpointok, Codex progresszió/relation context-szűrés.

---

## 11. Kollaboráció / megosztás (P3)

**Jelenlegi állapot:** a TopBar avatar-stack, a „Megosztás" gomb és a prompt-kommentek **statikus vizuál** (CLAUDE.md szerint MVP+V1-en kívül; single-user JWT). 

**Backend scope:** több-felhasználós projekt, szerepkörök (Tulajdonos/Szerkesztő/Megjegyző), online-jelenlét, megosztó-linkek, valós idejű együttszerkesztés — saját spec + auth-átalakítás (Auth.js felhős deploy) kell.

---

## 12. Egyéb halasztott (P2–P3)

- **MCP providerek** (Beállítások → MCP alfül stub) — szerver-toggle-ök + MCP-integráció (P2).
- **NSFW / reasoning toggle, modell-csomagok (presets)** — a prompt-szerkesztő/Beállítások V2 stubjai (P2).
- **Ollama in-app modell-letöltés** (Beállítások → Local „Modell letöltése" stub) (P2).
- **Import pipeline** (DOCX/EPUB/MD/PDF/TXT + AI Codex-extrakció) — az Export → Importálás fül V1 stub; előbb DOCX (Pandoc) (P1–P2).
- **Tezaurusz** (magyar szinonima/antonima), **Vizualizáció** (képprompt), **daily-spark / writing-streak analitika**, **vázlat-sablonok** (Save the Cat / Hős útja) — stubok (P2–P3).
- **Projekt JSON backup/restore** (Beállítások → Adatkezelés stub) (P1).
- **Sorozat-scope Codex** (a scope-toggle „Sorozat" üres-állapota) — series entitás kell (P1).

---

## Összefoglaló — backend-munka prioritás szerint

> Frissítve (2026-06-16): az alábbi tábla a **valódi maradék backlogot** tükrözi. A korábban P1-ben szereplő tételek (1–7 + RAG/continuity/jobs + import + JSON backup + series Codex) **elkészültek** — lásd a fenti „Frissítés" szekciót és a `docs/17`-et. A `docs/17` „Roadmap" szekciója a részletes, scope-olt élő tábla.

| Prioritás | Tétel |
|---|---|
| **P1-maradék** | Valódi RQ async worker (hosszú/batch job; az interaktív AI szinkron) · provider health-check befejezése (Ollama ping; a `/providers/{id}/test` már van) · Lighthouse CI gate |
| **P2** | Codex → Kutatás (RAG Q&A — retrieval kész, a Q&A nincs bekötve) · CodexProgression UI + timeline progresszió-overlay · kép-pipeline (8) · PDF export · MCP · presets/reasoning/NSFW · Ollama modell-letöltés · tezaurusz/vizualizáció/vázlat-sablonok/daily-spark · UX-4c Figma MCP · Plotline lane-vizualizáció |
| **P3** | Hang-domain + EPUB-3 media-overlay (9, saját spec) · kollaboráció (11) · E2E (Playwright kétszolgáltatás — BLOKKOLT a `app` csomagnév-ütközés + hiányzó web Dockerfile miatt) · marketplace/launch-kit |

> A korábbi „provider/API-kulcs konfiguráció a kiemelt következő feladat" megjegyzés már **teljesült** (1. pont kész). A javasolt következő kör (kis P1-maradék + magas-értékű P2) a `docs/17` „Javasolt következő kör" szekciójában él.
