import uuid

from httpx import AsyncClient


async def test_create_project(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/projects",
        json={"title": "Teszt Projekt", "language": "hu"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Teszt Projekt"
    assert data["language"] == "hu"
    assert data["description"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_project_with_description(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/projects",
        json={"title": "Részletes Projekt", "description": "Egy fantasyregény.", "language": "hu"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["description"] == "Egy fantasyregény."


async def test_create_project_requires_auth(client: AsyncClient):
    resp = await client.post("/api/v1/projects", json={"title": "Projekt"})
    assert resp.status_code == 401


async def test_create_project_empty_title_fails(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/projects",
        json={"title": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_project_missing_title_fails(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        "/api/v1/projects",
        json={"language": "hu"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_list_projects_empty(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)


async def test_list_projects_returns_created(client: AsyncClient, auth_headers: dict):
    await client.post("/api/v1/projects", json={"title": "P1"}, headers=auth_headers)
    await client.post("/api/v1/projects", json={"title": "P2"}, headers=auth_headers)
    resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    assert "P1" in titles
    assert "P2" in titles


async def test_list_projects_requires_auth(client: AsyncClient):
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 401


async def test_get_project_by_id(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/projects", json={"title": "Detail Test"}, headers=auth_headers)
    project_id = create_resp.json()["id"]
    resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == project_id
    assert resp.json()["title"] == "Detail Test"


async def test_get_project_not_found(client: AsyncClient, auth_headers: dict):
    fake_id = str(uuid.uuid4())
    resp = await client.get(f"/api/v1/projects/{fake_id}", headers=auth_headers)
    assert resp.status_code == 404


async def test_get_project_requires_auth(client: AsyncClient):
    resp = await client.get(f"/api/v1/projects/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_update_project_title(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/projects", json={"title": "Original"}, headers=auth_headers)
    project_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"title": "Updated"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"


async def test_update_project_partial(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post(
        "/api/v1/projects",
        json={"title": "Partial", "language": "hu"},
        headers=auth_headers,
    )
    project_id = create_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/{project_id}",
        json={"description": "New desc"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Partial"  # unchanged
    assert data["description"] == "New desc"


async def test_update_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.patch(
        f"/api/v1/projects/{uuid.uuid4()}",
        json={"title": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_project_requires_auth(client: AsyncClient):
    resp = await client.patch(f"/api/v1/projects/{uuid.uuid4()}", json={"title": "X"})
    assert resp.status_code == 401


async def test_delete_project(client: AsyncClient, auth_headers: dict):
    create_resp = await client.post("/api/v1/projects", json={"title": "To Delete"}, headers=auth_headers)
    project_id = create_resp.json()["id"]
    resp = await client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 204
    get_resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_delete_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.delete(f"/api/v1/projects/{uuid.uuid4()}", headers=auth_headers)
    assert resp.status_code == 404


async def test_delete_project_requires_auth(client: AsyncClient):
    resp = await client.delete(f"/api/v1/projects/{uuid.uuid4()}")
    assert resp.status_code == 401


async def test_list_projects_pagination(client: AsyncClient, auth_headers: dict):
    for i in range(5):
        await client.post("/api/v1/projects", json={"title": f"Paginalt {i}"}, headers=auth_headers)
    resp = await client.get("/api/v1/projects?limit=2&skip=0", headers=auth_headers)
    assert resp.status_code == 200
    assert len(resp.json()) <= 2


# ── A4: pagination bounds ───────────────────────────────────────────────────
# Unbounded skip/limit are a DoS footgun (huge LIMIT, negative OFFSET). FastAPI
# Query bounds reject out-of-range values with a 422 before they hit the DB.


async def test_list_projects_limit_zero_is_422(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/projects?limit=0", headers=auth_headers)
    assert resp.status_code == 422


async def test_list_projects_limit_too_large_is_422(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/projects?limit=100000", headers=auth_headers)
    assert resp.status_code == 422


async def test_list_projects_negative_skip_is_422(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/projects?skip=-1", headers=auth_headers)
    assert resp.status_code == 422


async def test_list_projects_limit_at_cap_ok(client: AsyncClient, auth_headers: dict):
    resp = await client.get("/api/v1/projects?limit=200", headers=auth_headers)
    assert resp.status_code == 200


# ── Feature #1: project card aggregates (book_count + word_count) ────────────
# Each project card shows the number of books and the total words (sum of
# Scene.word_count across every scene in every chapter of every book). The list
# + get read paths both carry the aggregates; create returns 0/0.


async def _add_scene(client, auth_headers, chapter_id: str, content: str) -> None:
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": "S", "content": content},
        headers=auth_headers,
    )
    assert resp.status_code == 201


async def _add_chapter(client, auth_headers, book_id: str) -> str:
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters", json={"title": "Ch"}, headers=auth_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _add_book(client, auth_headers, project_id: str) -> str:
    resp = await client.post(
        f"/api/v1/projects/{project_id}/books", json={"title": "B"}, headers=auth_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_project_returns_zero_aggregates(client: AsyncClient, auth_headers: dict):
    resp = await client.post("/api/v1/projects", json={"title": "Új"}, headers=auth_headers)
    assert resp.status_code == 201
    data = resp.json()
    assert data["book_count"] == 0
    assert data["word_count"] == 0
    assert data["scene_count"] == 0


async def test_aggregates_two_books_with_scenes(client: AsyncClient, auth_headers: dict):
    proj = (await client.post("/api/v1/projects", json={"title": "Agg"}, headers=auth_headers)).json()
    pid = proj["id"]

    book_a = await _add_book(client, auth_headers, pid)
    book_b = await _add_book(client, auth_headers, pid)

    ch_a1 = await _add_chapter(client, auth_headers, book_a)
    ch_a2 = await _add_chapter(client, auth_headers, book_a)
    ch_b1 = await _add_chapter(client, auth_headers, book_b)

    # word_counts: 3 + 2 + 4 + 1 = 10 across two books / three chapters.
    await _add_scene(client, auth_headers, ch_a1, "egy két három")  # 3
    await _add_scene(client, auth_headers, ch_a1, "négy öt")  # 2
    await _add_scene(client, auth_headers, ch_a2, "hat hét nyolc kilenc")  # 4
    await _add_scene(client, auth_headers, ch_b1, "tíz")  # 1

    # GET single.
    get_resp = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert get_resp.status_code == 200
    detail = get_resp.json()
    assert detail["book_count"] == 2
    assert detail["word_count"] == 10
    assert detail["scene_count"] == 4  # 2 + 1 + 1 non-archived scenes

    # GET list — same aggregates for this project.
    list_resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert list_resp.status_code == 200
    listed = next(p for p in list_resp.json() if p["id"] == pid)
    assert listed["book_count"] == 2
    assert listed["word_count"] == 10
    assert listed["scene_count"] == 4


async def test_aggregates_empty_project(client: AsyncClient, auth_headers: dict):
    proj = (await client.post("/api/v1/projects", json={"title": "Üres"}, headers=auth_headers)).json()
    pid = proj["id"]
    resp = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["book_count"] == 0
    assert data["word_count"] == 0
    assert data["scene_count"] == 0


async def test_aggregates_books_without_scenes(client: AsyncClient, auth_headers: dict):
    proj = (await client.post("/api/v1/projects", json={"title": "Könyv-nincs-jelenet"}, headers=auth_headers)).json()
    pid = proj["id"]
    await _add_book(client, auth_headers, pid)
    book = await _add_book(client, auth_headers, pid)
    await _add_chapter(client, auth_headers, book)  # chapter but no scenes

    resp = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["book_count"] == 2
    assert data["word_count"] == 0  # coalesced null SUM
    assert data["scene_count"] == 0


async def test_word_count_excludes_archived_scenes(client: AsyncClient, auth_headers: dict):
    """REAL BUG regression: archived scenes must NOT contribute to the project
    word_count aggregate (archived scenes are excluded everywhere else)."""
    proj = (
        await client.post("/api/v1/projects", json={"title": "Arch"}, headers=auth_headers)
    ).json()
    pid = proj["id"]
    book = await _add_book(client, auth_headers, pid)
    ch = await _add_chapter(client, auth_headers, book)

    # One normal scene (N=3 words) + one archived scene (M=4 words).
    normal = (
        await client.post(
            f"/api/v1/chapters/{ch}/scenes",
            json={"title": "Normál", "content": "egy két három"},  # 3
            headers=auth_headers,
        )
    ).json()
    assert normal  # created
    to_archive = (
        await client.post(
            f"/api/v1/chapters/{ch}/scenes",
            json={"title": "Archív", "content": "négy öt hat hét"},  # 4
            headers=auth_headers,
        )
    ).json()
    arch_resp = await client.post(
        f"/api/v1/chapters/{ch}/scenes/{to_archive['id']}/archive", headers=auth_headers
    )
    assert arch_resp.status_code == 200

    resp = await client.get(f"/api/v1/projects/{pid}", headers=auth_headers)
    assert resp.status_code == 200
    # word_count == N (3), excludes the archived M (4) → NOT 7.
    assert resp.json()["word_count"] == 3
    # scene_count counts only the 1 non-archived scene (NOT 2).
    assert resp.json()["scene_count"] == 1


async def test_aggregates_do_not_leak_across_projects(client: AsyncClient, auth_headers: dict):
    proj_a = (await client.post("/api/v1/projects", json={"title": "A"}, headers=auth_headers)).json()
    proj_b = (await client.post("/api/v1/projects", json={"title": "B"}, headers=auth_headers)).json()

    book_a = await _add_book(client, auth_headers, proj_a["id"])
    ch_a = await _add_chapter(client, auth_headers, book_a)
    await _add_scene(client, auth_headers, ch_a, "egy két három")  # 3 words, project A

    # project B gets two books but only 2 words total.
    book_b1 = await _add_book(client, auth_headers, proj_b["id"])
    await _add_book(client, auth_headers, proj_b["id"])
    ch_b = await _add_chapter(client, auth_headers, book_b1)
    await _add_scene(client, auth_headers, ch_b, "négy öt")  # 2 words, project B

    resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    by_id = {p["id"]: p for p in resp.json()}
    assert by_id[proj_a["id"]]["book_count"] == 1
    assert by_id[proj_a["id"]]["word_count"] == 3
    assert by_id[proj_a["id"]]["scene_count"] == 1
    assert by_id[proj_b["id"]]["book_count"] == 2
    assert by_id[proj_b["id"]]["word_count"] == 2
    assert by_id[proj_b["id"]]["scene_count"] == 1
