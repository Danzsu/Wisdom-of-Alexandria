import uuid

from httpx import AsyncClient


async def _create_project(client, auth_headers, title="Series Project"):
    resp = await client.post(
        "/api/v1/projects", json={"title": title}, headers=auth_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_series(client, auth_headers, project_id, title="A Series"):
    resp = await client.post(
        f"/api/v1/projects/{project_id}/series",
        json={"title": title},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()


# ----------------------------- Series CRUD ----------------------------------


async def test_create_series(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/series",
        json={"title": "Az Alapítvány-ciklus", "description": "leírás", "order_index": 2},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Az Alapítvány-ciklus"
    assert data["project_id"] == project_id
    assert data["description"] == "leírás"
    assert data["order_index"] == 2


async def test_create_series_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/series",
        json={"title": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_series_empty_title_fails(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/series",
        json={"title": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_list_series(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await _create_series(client, auth_headers, project_id, "S1")
    await _create_series(client, auth_headers, project_id, "S2")
    resp = await client.get(
        f"/api/v1/projects/{project_id}/series", headers=auth_headers
    )
    assert resp.status_code == 200
    titles = [s["title"] for s in resp.json()]
    assert "S1" in titles and "S2" in titles


async def test_list_series_scoped_to_project(client: AsyncClient, auth_headers: dict):
    pid1 = await _create_project(client, auth_headers, "P1")
    pid2 = await _create_project(client, auth_headers, "P2")
    await _create_series(client, auth_headers, pid1, "A")
    await _create_series(client, auth_headers, pid2, "B")
    resp = await client.get(f"/api/v1/projects/{pid1}/series", headers=auth_headers)
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "A"


async def test_get_series(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    series = await _create_series(client, auth_headers, project_id)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/series/{series['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == series["id"]


async def test_get_series_wrong_project_404(client: AsyncClient, auth_headers: dict):
    pid1 = await _create_project(client, auth_headers, "P1")
    pid2 = await _create_project(client, auth_headers, "P2")
    series = await _create_series(client, auth_headers, pid1)
    resp = await client.get(
        f"/api/v1/projects/{pid2}/series/{series['id']}", headers=auth_headers
    )
    assert resp.status_code == 404


async def test_update_series(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    series = await _create_series(client, auth_headers, project_id, "Eredeti")
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/series/{series['id']}",
        json={"title": "Frissített", "order_index": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Frissített"
    assert resp.json()["order_index"] == 5


async def test_update_series_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/series/{uuid.uuid4()}",
        json={"title": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_delete_series(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    series = await _create_series(client, auth_headers, project_id)
    resp = await client.delete(
        f"/api/v1/projects/{project_id}/series/{series['id']}", headers=auth_headers
    )
    assert resp.status_code == 204
    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/series/{series['id']}", headers=auth_headers
    )
    assert get_resp.status_code == 404


async def test_series_requires_auth(client: AsyncClient):
    fake = str(uuid.uuid4())
    endpoints = [
        ("GET", f"/api/v1/projects/{fake}/series"),
        ("POST", f"/api/v1/projects/{fake}/series"),
        ("GET", f"/api/v1/projects/{fake}/series/{fake}"),
        ("PATCH", f"/api/v1/projects/{fake}/series/{fake}"),
        ("DELETE", f"/api/v1/projects/{fake}/series/{fake}"),
    ]
    for method, url in endpoints:
        resp = await client.request(method, url, json={"title": "x"})
        assert resp.status_code == 401, f"{method} {url} should return 401"


# ------------------------- Book.series_id assignment -------------------------


async def test_book_assign_series_via_patch(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    series = await _create_series(client, auth_headers, project_id)
    book_resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Könyv"},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]
    assert book_resp.json()["series_id"] is None

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/books/{book_id}",
        json={"series_id": series["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["series_id"] == series["id"]


async def test_book_create_with_series(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    series = await _create_series(client, auth_headers, project_id)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Könyv", "series_id": series["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["series_id"] == series["id"]


async def test_book_clear_series(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    series = await _create_series(client, auth_headers, project_id)
    book_resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Könyv", "series_id": series["id"]},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/books/{book_id}",
        json={"series_id": None},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["series_id"] is None


async def test_book_cross_project_series_rejected(client: AsyncClient, auth_headers: dict):
    pid_a = await _create_project(client, auth_headers, "Project A")
    pid_b = await _create_project(client, auth_headers, "Project B")
    series_b = await _create_series(client, auth_headers, pid_b, "B-series")
    book_resp = await client.post(
        f"/api/v1/projects/{pid_a}/books",
        json={"title": "A-könyv"},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]
    # Assigning a series from project B to a book in project A must be rejected.
    resp = await client.patch(
        f"/api/v1/projects/{pid_a}/books/{book_id}",
        json={"series_id": series_b["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    # And on create too.
    resp2 = await client.post(
        f"/api/v1/projects/{pid_a}/books",
        json={"title": "másik", "series_id": series_b["id"]},
        headers=auth_headers,
    )
    assert resp2.status_code == 400


# ------------------------ CodexEntry.series_id scope -------------------------


async def test_codex_assign_series_on_create_and_update(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    series = await _create_series(client, auth_headers, project_id)
    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Bejegyzés", "series_id": series["id"]},
        headers=auth_headers,
    )
    assert create_resp.status_code == 201
    assert create_resp.json()["series_id"] == series["id"]
    entry_id = create_resp.json()["id"]

    # Clear via update.
    upd = await client.patch(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        json={"series_id": None},
        headers=auth_headers,
    )
    assert upd.status_code == 200
    assert upd.json()["series_id"] is None


async def test_codex_cross_project_series_rejected(
    client: AsyncClient, auth_headers: dict
):
    pid_a = await _create_project(client, auth_headers, "A")
    pid_b = await _create_project(client, auth_headers, "B")
    series_b = await _create_series(client, auth_headers, pid_b)
    resp = await client.post(
        f"/api/v1/projects/{pid_a}/codex",
        json={"title": "X", "series_id": series_b["id"]},
        headers=auth_headers,
    )
    assert resp.status_code == 400


async def test_codex_list_series_scope_filter(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    s1 = await _create_series(client, auth_headers, project_id, "S1")
    s2 = await _create_series(client, auth_headers, project_id, "S2")

    async def _codex(title, series_id=None):
        body = {"title": title}
        if series_id is not None:
            body["series_id"] = series_id
        r = await client.post(
            f"/api/v1/projects/{project_id}/codex", json=body, headers=auth_headers
        )
        assert r.status_code == 201
        return r.json()["id"]

    global_id = await _codex("Global")  # project-global (series_id None)
    s1_id = await _codex("In S1", s1["id"])
    s2_id = await _codex("In S2", s2["id"])

    # No filter -> all three.
    all_resp = await client.get(
        f"/api/v1/projects/{project_id}/codex", headers=auth_headers
    )
    all_ids = {e["id"] for e in all_resp.json()}
    assert {global_id, s1_id, s2_id} <= all_ids

    # Filter by S1 -> global + S1, NOT S2.
    s1_resp = await client.get(
        f"/api/v1/projects/{project_id}/codex?series_id={s1['id']}",
        headers=auth_headers,
    )
    s1_ids = {e["id"] for e in s1_resp.json()}
    assert global_id in s1_ids
    assert s1_id in s1_ids
    assert s2_id not in s1_ids


# --------------------- SET NULL on series delete -----------------------------


async def test_series_delete_sets_book_and_codex_null(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    series = await _create_series(client, auth_headers, project_id)

    book_resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": "Könyv", "series_id": series["id"]},
        headers=auth_headers,
    )
    book_id = book_resp.json()["id"]
    codex_resp = await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Bejegyzés", "series_id": series["id"]},
        headers=auth_headers,
    )
    entry_id = codex_resp.json()["id"]

    # Delete the series.
    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/series/{series['id']}", headers=auth_headers
    )
    assert del_resp.status_code == 204

    # Book and codex entry still exist, but their series_id fell back to null.
    book_after = await client.get(
        f"/api/v1/projects/{project_id}/books/{book_id}", headers=auth_headers
    )
    assert book_after.status_code == 200
    assert book_after.json()["series_id"] is None

    codex_after = await client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}", headers=auth_headers
    )
    assert codex_after.status_code == 200
    assert codex_after.json()["series_id"] is None
