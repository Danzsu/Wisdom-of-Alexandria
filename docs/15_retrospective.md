# 15 — Retrospektív review (Phase A + Phase B után)

Ez a dokumentum a Phase A (minőségi hardening) + Phase B (AI-mag: élő jobok, RAG, continuity) lezárása utáni őszinte visszatekintés: **mi ment jól, mi ment kevésbé jól, mi egyenesen nem jó, és hogyan lehetne jobb.** Tény-alapú (a repó állapotából + a fejlesztési menetből), nem marketing.

> **ℹ️ Történeti Phase A + Phase B retrospektív** — egy adott pillanat visszatekintése, nem élő állapot. A friss állapotért és tanulságokért lásd [`docs/17_status_and_roadmap.md`](17_status_and_roadmap.md).

**Állapot a review idején:** apps/api 382 · apps/ai 225 (+4 pgvector-skip) · apps/web 461 = **1068 teszt zöld**. Minden commitolva a `feat/alexandria-ui` ágon.

---

## 1. Mi ment jól

- **Tiszta szolgáltatás-architektúra.** A domain (`apps/api`) ↔ AI (`apps/ai`) szétválasztás egyirányú függőségekkel (mindkettő csak `packages/db`=`alexandria_core`-t importál, egymást soha — grep-pel igazolva), közös Postgres + JWT a kontraktus. A RAG tisztán ráépült a meglévő provider-absztrakcióra.
- **Erős újrafelhasználás.** A `ModelRouter.resolve_provider` változatlanul újrahasznosult az embeddinghez; a frontend `ContextChips`/`AIResultCard` előre be volt huzalozva (a B2c emiatt szinte triviális lett); a promptokban már voltak `{context}`/`{codex_context}` helyek.
- **A per-blokk review-kapu VALÓDI hibákat fogott** (nem színház). Többek közt: a **cloud-provider `db=` Critical** (a kiemelt provider-feature némán halott volt), a **prompt system-szekció placeholder-bug** (a `{characters}`/`{word_count_target}` sosem helyettesítődött be), az **embed részleges-batch elcsúszás** kockázata, a `"completed"` vs `"done"` státusz-drift, néma `except`-ek. Ezek mind merge ELŐTT elhárultak.
- **Human-in-the-loop végig megtartva.** Az AI sosem ír közvetlenül a kéziratba: minden generálás `Revision(approved=False)`, csak explicit approve frissíti a Scene-t. A continuity szándékosan NEM hoz revíziót (elemzés).
- **Őszinte degradáció / stubok.** Az UI nem hazudik: a hiányzó backend-funkciók (RAG-chipek M6/M10, borító-feltöltés, hang/EPUB) dokumentált stubként jelentek meg, nem fake adattal. A RAG embedding-provider hiányában gracefully kihagy (loggal), nem 500-azik.
- **Biztonság fegyelmezett.** Fernet-kulcs sosem logba/válaszba, maszkolt olvasás, `safe_error` mindenhol — tesztek igazolják, hogy a kulcs/ciphertext nem szivárog.
- **Adósság jórészt dokumentált.** Csak **2** szórványos TODO a forrásban; a debt a tervben + kommentekben él (pl. a dimenzió-rögzítés, a lazy-index, a package-collision mind explicit kommenttel).

---

## 2. Mi ment kevésbé jól / hogyan lehetett volna jobb

- **Csomagnév-ütközés (mindkét app `app`).** A Step 7 split mindkét szolgáltatást `app` top-level csomaggal hozta létre. Ez KÉSŐBB blokkolta az igazi in-process cross-service tesztet (az A7 HITL-teszt kénytelen volt kontraktus-szintű workaround lenni, mert két `app` nem importálható egy folyamatba). Ha a splitkor `alexandria_api` / `alexandria_ai` néven készül, ma volna valódi két-app teszt. Javítható, de most rename + import-churn lenne.
- **Visszatérő prompt-bug osztály.** A `load_system` változók nélkül hívódott, miközben a sablon system-szekciója placeholdert tartalmazott → literális `{...}` ment a modellnek. Ez **lappangott** (pre-existing), és csak a B2b/B3 review fogta meg, sablononként reaktívan javítva. Egy strukturális védelem (a `load()` ellenőrizze, hogy nem maradt el nem fogyasztott `{placeholder}`) az egész osztályt loud hibává tette volna.
- **Commit-súrlódás.** A compound `git add && commit` + em-dash üzenetek ismételten elakadtak az engedély-kapun — ciklusokat vitt el. Egyszer, a `settings.json`-ban egy permission-szabállyal megoldható lett volna (az `update-config` skill pont erre van); memóriába került, de nem automatizálva.
- **Embedding-dimenzió 1536-ra drótozva.** OpenAI-small-osztályhoz köt; Gemini (768) migráció + reindex nélkül nem megy. MVP-re elfogadható + dokumentált, de rugalmasabb terv (per-modell dim) jobb lett volna előre.
- **Lazy RAG-index a request-úton.** Egy tartalom-változás utáni első generálás szinkron fizeti az embedding-költséget. Az RQ worker (stubként megépítve) lett volna a helye — az async út nincs bekötve, így interim.

---

## 3. Mi egyenesen NEM jó (valós kockázatok, tény-alapú)

- **NINCS CI.** A `.github/workflows` hiányzik, PEDIG a `CLAUDE.md` egy teljes CI/CD-pipeline-t ír le (`ci-frontend`/`ci-backend`/`e2e`/`deploy`). A doksi olyan infrastruktúrát állít, ami nem létezik. Következmények:
  - **A pgvector-similarity (a RAG SZÍVE) sehol nem fut le automatizáltan.** A `@pytest.mark.postgres` tesztek lokálisan SQLite-on **skip**-elnek, és nincs CI Postgres-service → a koszinusz-retrieval utat egyetlen automatizált futás sem feszíti.
  - **A migrációkat semmi nem futtatja.** A tesztek `Base.metadata.create_all`-t használnak (NEM Alembicet); sehol nincs `alembic upgrade head` Postgresen. Tehát a migráció-korrektség (pgvector extension, a `project_id` non-null add, a `batch_alter_table` SQLite-rebuildek) CSAK inspekcióval ellenőrzött, sosem futtatott. Egy törött migráció csak éles deploykor derülne ki.
- **A lint nem zöld repó-szinten.** `ruff check`: **apps/api 192 + apps/ai 30** hiba (~222 összesen). A per-blokk kapu csak „a változott fájlokon tiszta"-t kért, így a bázis elrohadt. Nincs zöld lint-kapu; a repó-szintű `ruff` piros (zömmel E501 sorhossz + néhány F401/F841).
- **A FE↔BE kontraktus kézzel tartott.** Nincs `packages/shared` (pedig a CLAUDE.md előírja). A drift-guard csak a FE-típusokat köti a fixtúrákhoz — egy **néma backend-séma-változást NEM fog meg**: egy mező-átnevezés a backenden minden FE-tesztet zölden hagyna és futásidőben törne. (Ez a backlog #4.)
- **Nincs élő, két-szolgáltatásos E2E.** A csomag-ütközés miatt a HITL-loop (AI ír revíziót → domain approve → Scene frissül) csak oldalanként tesztelt, sosem végpontok közt, élő HTTP-vel. A CLAUDE.md Playwright-E2E rétege nem létezik.
- **Single-user auth / dev-token a bundle-ben.** A `NEXT_PUBLIC_DEV_TOKEN` build-időben a böngésző-bundle-be fordul — local MVP-re rendben, de éles deploynál valódi kockázat hardening nélkül.

---

## 4. Konkrét javaslatok (prioritással)

1. **CI bevezetése** (`.github/workflows`) Postgres+pgvector service-szel, ami: `alembic upgrade head` (migrációk valódi futtatása) + a `@pytest.mark.postgres` tesztek + repó-szintű `ruff`/`tsc`/`lint` + a frontend vitest. **Ez egy lépésben zárja a legnagyobb réseket** (nem-tesztelt vektor-út, nem-futtatott migrációk, nincs lint-kapu). LEGNAGYOBB érték.
2. **Zöld lint-bázis:** `ruff --fix` az auto-javíthatóra + a maradék triage/wrap, majd repó-szintű kényszerítés CI-ben + pre-pushban.
3. **`packages/shared`** (backlog #4): a FE-típusok generálása a backend OpenAPI-ből → a drift-kockázat megszűnik, a drift-guard nyugdíjazható.
4. **Prompt-loader guard:** a `load_system`/`load_user` dobjon, ha el nem fogyasztott `{placeholder}` marad — a lappangó bug-osztály loud hibává tétele.
5. **Csomag-átnevezés** (egy app `app` → `alexandria_ai`) az in-process cross-service + jövőbeli E2E felé; vagy valódi Playwright-E2E docker-compose-zal.
6. **RQ worker élesítése** (async embedding/batch) — a stub kész; a lazy-index levétele a request-útról nagy projekteknél.
7. **Commit-permission automatizálás** a `settings.json`-ban (a visszatérő súrlódás megszüntetése).

---

## 5. Összegzés

A projekt **erős, fegyelmezett mérnöki állapotban** van: tiszta architektúra, valódi review-kapu, HITL, őszinte degradáció, fegyelmezett biztonság. A **funkcionális** minőség magas és tesztelt. A **valódi rés nem a feature-kódban, hanem a verifikációs infrastruktúrában van**: nincs CI, így a RAG vektor-útja és a migrációk automatizáltan sosem futnak, és a lint nem zöld repó-szinten. A legnagyobb egyszeri minőség-ugrást a **CI + zöld lint-bázis** adná — érdemes a feature-backlog elé vagy mellé tenni.
