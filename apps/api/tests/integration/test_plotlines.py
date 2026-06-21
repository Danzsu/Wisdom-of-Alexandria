import uuid

from httpx import AsyncClient

# ----------------------------- helpers --------------------------------------


async def _create_project(client, auth_headers, title="Plotline Project"):
    resp = await client.post(
        "/api/v1/projects", json={"title": title}, headers=auth_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_book(client, auth_headers, project_id, title="A Book"):
    resp = await client.post(
        f"/api/v1/projects/{project_id}/books",
        json={"title": title},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_chapter(client, auth_headers, book_id, title="Ch1"):
    resp = await client.post(
        f"/api/v1/books/{book_id}/chapters",
        json={"title": title},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_scene(client, auth_headers, chapter_id, title="Sc1"):
    resp = await client.post(
        f"/api/v1/chapters/{chapter_id}/scenes",
        json={"title": title},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _make_scene(client, auth_headers, project_id, title="Sc"):
    """Full project->book->chapter->scene chain; returns scene_id."""
    book_id = await _create_book(client, auth_headers, project_id)
    chapter_id = await _create_chapter(client, auth_headers, book_id)
    return await _create_scene(client, auth_headers, chapter_id, title)


async def _create_plotline(
    client,
    auth_headers,
    project_id,
    title="A Plotline",
    plotline_type="subplot",
    **extra,
):
    body = {"title": title, "plotline_type": plotline_type}
    body.update(extra)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/plotlines",
        json=body,
        headers=auth_headers,
    )
    assert resp.status_code == 201, resp.text
    return resp.json()


# ----------------------------- Plotline CRUD --------------------------------


async def test_create_plotline(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/plotlines",
        json={
            "title": "A bosszú szála",
            "description": "leírás",
            "plotline_type": "antagonist_plan",
            "status": "active",
            "order_index": 2,
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "A bosszú szála"
    assert data["project_id"] == project_id
    assert data["description"] == "leírás"
    assert data["plotline_type"] == "antagonist_plan"
    assert data["status"] == "active"
    assert data["order_index"] == 2
    assert data["book_id"] is None


async def test_create_plotline_default_status_planning(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    assert pl["status"] == "planning"


async def test_create_plotline_project_not_found(
    client: AsyncClient, auth_headers: dict
):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/plotlines",
        json={"title": "X", "plotline_type": "subplot"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_plotline_empty_title_fails(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/plotlines",
        json={"title": "", "plotline_type": "subplot"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_plotline_invalid_type_422(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/plotlines",
        json={"title": "X", "plotline_type": "not_a_real_type"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_create_plotline_invalid_status_422(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/plotlines",
        json={"title": "X", "plotline_type": "subplot", "status": "frozen"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_list_plotlines_ordered(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await _create_plotline(client, auth_headers, project_id, "B", order_index=2)
    await _create_plotline(client, auth_headers, project_id, "A", order_index=1)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/plotlines", headers=auth_headers
    )
    assert resp.status_code == 200
    titles = [p["title"] for p in resp.json()]
    # Ordered by order_index: A (1) before B (2).
    assert titles == ["A", "B"]


async def test_list_plotlines_scoped_to_project(
    client: AsyncClient, auth_headers: dict
):
    pid1 = await _create_project(client, auth_headers, "P1")
    pid2 = await _create_project(client, auth_headers, "P2")
    await _create_plotline(client, auth_headers, pid1, "A")
    await _create_plotline(client, auth_headers, pid2, "B")
    resp = await client.get(
        f"/api/v1/projects/{pid1}/plotlines", headers=auth_headers
    )
    assert len(resp.json()) == 1
    assert resp.json()[0]["title"] == "A"


async def test_get_plotline(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}", headers=auth_headers
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == pl["id"]


async def test_get_plotline_wrong_project_404(
    client: AsyncClient, auth_headers: dict
):
    pid1 = await _create_project(client, auth_headers, "P1")
    pid2 = await _create_project(client, auth_headers, "P2")
    pl = await _create_plotline(client, auth_headers, pid1)
    resp = await client.get(
        f"/api/v1/projects/{pid2}/plotlines/{pl['id']}", headers=auth_headers
    )
    assert resp.status_code == 404


async def test_update_plotline(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id, "Eredeti")
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}",
        json={"title": "Frissített", "status": "resolved", "order_index": 5},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Frissített"
    assert resp.json()["status"] == "resolved"
    assert resp.json()["order_index"] == 5


async def test_update_plotline_invalid_type_422(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}",
        json={"plotline_type": "garbage"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_update_plotline_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/plotlines/{uuid.uuid4()}",
        json={"title": "X"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_delete_plotline(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    resp = await client.delete(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}", headers=auth_headers
    )
    assert resp.status_code == 204
    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}", headers=auth_headers
    )
    assert get_resp.status_code == 404


async def test_plotlines_require_auth(client: AsyncClient):
    fake = str(uuid.uuid4())
    endpoints = [
        ("GET", f"/api/v1/projects/{fake}/plotlines"),
        ("POST", f"/api/v1/projects/{fake}/plotlines"),
        ("GET", f"/api/v1/projects/{fake}/plotlines/{fake}"),
        ("PATCH", f"/api/v1/projects/{fake}/plotlines/{fake}"),
        ("DELETE", f"/api/v1/projects/{fake}/plotlines/{fake}"),
        ("GET", f"/api/v1/plotlines/{fake}/scenes"),
        ("POST", f"/api/v1/plotlines/{fake}/scenes"),
        ("DELETE", f"/api/v1/plotlines/{fake}/scenes/{fake}"),
    ]
    for method, url in endpoints:
        resp = await client.request(method, url, json={"title": "x"})
        assert resp.status_code == 401, f"{method} {url} should return 401"


# ------------------------- book_id scope (create/update) ---------------------


async def test_create_plotline_with_book(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    book_id = await _create_book(client, auth_headers, project_id)
    pl = await _create_plotline(
        client, auth_headers, project_id, book_id=book_id
    )
    assert pl["book_id"] == book_id


async def test_plotline_clear_book(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    book_id = await _create_book(client, auth_headers, project_id)
    pl = await _create_plotline(
        client, auth_headers, project_id, book_id=book_id
    )
    resp = await client.patch(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}",
        json={"book_id": None},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["book_id"] is None


# ------------------- [mutation-proof] cross-project IDOR ---------------------


async def test_plotline_cross_project_book_rejected(
    client: AsyncClient, auth_headers: dict
):
    """A book_id from project B must not scope a plotline in project A (400).

    MUTATION PROOF: removing the ``await _validate_book_in_project(...)`` call in
    ``crud_plotline.create_plotline`` makes this test FAIL (the create returns
    201 with the cross-project book_id persisted). Reverting restores green.
    """
    pid_a = await _create_project(client, auth_headers, "Project A")
    pid_b = await _create_project(client, auth_headers, "Project B")
    book_b = await _create_book(client, auth_headers, pid_b, "B-book")

    # On create.
    resp = await client.post(
        f"/api/v1/projects/{pid_a}/plotlines",
        json={"title": "A-szál", "plotline_type": "subplot", "book_id": book_b},
        headers=auth_headers,
    )
    assert resp.status_code == 400

    # On update.
    pl = await _create_plotline(client, auth_headers, pid_a)
    resp2 = await client.patch(
        f"/api/v1/projects/{pid_a}/plotlines/{pl['id']}",
        json={"book_id": book_b},
        headers=auth_headers,
    )
    assert resp2.status_code == 400


async def test_plotline_attach_cross_project_scene_rejected(
    client: AsyncClient, auth_headers: dict
):
    """Attaching a scene from project B to a plotline in project A -> 400, and
    NO link is persisted.

    MUTATION PROOF: removing the ``if scene_project != plotline.project_id``
    rejection in ``crud_plotline.attach_scene`` makes this test FAIL (attach
    returns 201 and the cross-project link appears in the list). Reverting
    restores green.
    """
    pid_a = await _create_project(client, auth_headers, "Project A")
    pid_b = await _create_project(client, auth_headers, "Project B")
    pl_a = await _create_plotline(client, auth_headers, pid_a)
    scene_b = await _make_scene(client, auth_headers, pid_b, "B-scene")

    resp = await client.post(
        f"/api/v1/plotlines/{pl_a['id']}/scenes",
        json={"scene_id": scene_b},
        headers=auth_headers,
    )
    assert resp.status_code == 400

    # Assert real persisted state: the cross-project scene is NOT linked.
    list_resp = await client.get(
        f"/api/v1/plotlines/{pl_a['id']}/scenes", headers=auth_headers
    )
    assert list_resp.status_code == 200
    assert all(link["scene_id"] != scene_b for link in list_resp.json())


async def test_plotline_attach_nonexistent_scene_rejected(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    resp = await client.post(
        f"/api/v1/plotlines/{pl['id']}/scenes",
        json={"scene_id": str(uuid.uuid4())},
        headers=auth_headers,
    )
    assert resp.status_code == 400


# ----------------------- scene attach / detach / list ------------------------


async def test_attach_detach_list_scenes_ordered(
    client: AsyncClient, auth_headers: dict
):
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    # Two scenes in the same project (reuse one chapter for both).
    book_id = await _create_book(client, auth_headers, project_id)
    chapter_id = await _create_chapter(client, auth_headers, book_id)
    s1 = await _create_scene(client, auth_headers, chapter_id, "S1")
    s2 = await _create_scene(client, auth_headers, chapter_id, "S2")

    # Attach in reverse order_index to verify ordering on list.
    r1 = await client.post(
        f"/api/v1/plotlines/{pl['id']}/scenes",
        json={"scene_id": s1, "order_index": 2},
        headers=auth_headers,
    )
    assert r1.status_code == 201
    r2 = await client.post(
        f"/api/v1/plotlines/{pl['id']}/scenes",
        json={"scene_id": s2, "order_index": 1},
        headers=auth_headers,
    )
    assert r2.status_code == 201

    list_resp = await client.get(
        f"/api/v1/plotlines/{pl['id']}/scenes", headers=auth_headers
    )
    assert list_resp.status_code == 200
    scene_ids = [link["scene_id"] for link in list_resp.json()]
    # Ordered by order_index: s2 (1) before s1 (2).
    assert scene_ids == [s2, s1]

    # Detach s2.
    det = await client.delete(
        f"/api/v1/plotlines/{pl['id']}/scenes/{s2}", headers=auth_headers
    )
    assert det.status_code == 204
    after = await client.get(
        f"/api/v1/plotlines/{pl['id']}/scenes", headers=auth_headers
    )
    assert [link["scene_id"] for link in after.json()] == [s1]


async def test_detach_unattached_scene_404(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    scene_id = await _make_scene(client, auth_headers, project_id)
    resp = await client.delete(
        f"/api/v1/plotlines/{pl['id']}/scenes/{scene_id}", headers=auth_headers
    )
    assert resp.status_code == 404


# ----------------------- [mutation-proof] unique ----------------------------


async def test_attach_same_scene_twice_idempotent(
    client: AsyncClient, auth_headers: dict
):
    """Attaching the same scene twice to one plotline must NOT create a second
    link (unique constraint on (plotline_id, scene_id)).

    MUTATION PROOF: removing the early ``if link is not None: return link``
    idempotency guard in ``crud_plotline.attach_scene`` makes the second attach
    raise an IntegrityError (the DB unique constraint fires) instead of a clean
    201, so this test FAILS (500 != 201). The unique constraint itself is the
    authoritative guard — proven separately by dropping ``UniqueConstraint`` from
    the model, which lets a 2nd link persist and makes the count assertion fail.
    Reverting restores green.
    """
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    scene_id = await _make_scene(client, auth_headers, project_id)

    r1 = await client.post(
        f"/api/v1/plotlines/{pl['id']}/scenes",
        json={"scene_id": scene_id},
        headers=auth_headers,
    )
    assert r1.status_code == 201
    r2 = await client.post(
        f"/api/v1/plotlines/{pl['id']}/scenes",
        json={"scene_id": scene_id},
        headers=auth_headers,
    )
    # Idempotent: 201 again, but the list must contain exactly ONE link.
    assert r2.status_code == 201
    assert r1.json()["id"] == r2.json()["id"]

    list_resp = await client.get(
        f"/api/v1/plotlines/{pl['id']}/scenes", headers=auth_headers
    )
    links = [link for link in list_resp.json() if link["scene_id"] == scene_id]
    assert len(links) == 1


# ------------------- [mutation-proof] cascade / SET NULL ---------------------


async def test_delete_plotline_removes_links_keeps_scene(
    client: AsyncClient, auth_headers: dict
):
    """Deleting a plotline removes its PlotlineScene links but NOT the scene.

    MUTATION PROOF: the links are removed via the ORM
    ``cascade="all, delete-orphan"`` on ``Plotline.scene_links``. Removing that
    cascade leaves orphan ``plotline_scenes`` rows; the deleted-plotline scene
    list would then error / the link survives — and the scene-still-exists vs
    link-gone assertions diverge. The scene itself is fetched after deletion and
    must still be 200. Reverting restores green.
    """
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    book_id = await _create_book(client, auth_headers, project_id)
    chapter_id = await _create_chapter(client, auth_headers, book_id)
    scene_id = await _create_scene(client, auth_headers, chapter_id)

    attach = await client.post(
        f"/api/v1/plotlines/{pl['id']}/scenes",
        json={"scene_id": scene_id},
        headers=auth_headers,
    )
    assert attach.status_code == 201

    # Delete the plotline.
    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}", headers=auth_headers
    )
    assert del_resp.status_code == 204

    # The link list endpoint now 404s (plotline gone) -> links gone with it.
    links_after = await client.get(
        f"/api/v1/plotlines/{pl['id']}/scenes", headers=auth_headers
    )
    assert links_after.status_code == 404

    # The scene itself still exists.
    scene_after = await client.get(
        f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers
    )
    assert scene_after.status_code == 200


async def test_delete_scene_removes_links(client: AsyncClient, auth_headers: dict):
    """Deleting a scene removes its PlotlineScene links (the plotline survives).

    MUTATION PROOF: the scene->link cascade relies on the DB FK
    ``ON DELETE CASCADE`` (authoritative on PostgreSQL) AND the model relationship
    cascade. On SQLite the model-built schema enforces it. If the cascade is
    removed, the orphan link survives and the post-delete list still contains the
    scene_id -> assertion FAILS. Reverting restores green.
    """
    project_id = await _create_project(client, auth_headers)
    pl = await _create_plotline(client, auth_headers, project_id)
    book_id = await _create_book(client, auth_headers, project_id)
    chapter_id = await _create_chapter(client, auth_headers, book_id)
    scene_id = await _create_scene(client, auth_headers, chapter_id)

    await client.post(
        f"/api/v1/plotlines/{pl['id']}/scenes",
        json={"scene_id": scene_id},
        headers=auth_headers,
    )
    # Delete the scene.
    del_resp = await client.delete(
        f"/api/v1/chapters/{chapter_id}/scenes/{scene_id}", headers=auth_headers
    )
    assert del_resp.status_code == 204

    # Plotline survives, but its scene link is gone.
    list_resp = await client.get(
        f"/api/v1/plotlines/{pl['id']}/scenes", headers=auth_headers
    )
    assert list_resp.status_code == 200
    assert all(link["scene_id"] != scene_id for link in list_resp.json())

    pl_after = await client.get(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}", headers=auth_headers
    )
    assert pl_after.status_code == 200


async def test_delete_book_sets_plotline_book_null(
    client: AsyncClient, auth_headers: dict
):
    """Deleting a book SET-NULLs the scoped plotline's book_id; plotline survives.

    MUTATION PROOF: removing the explicit
    ``update(Plotline)...values(book_id=None)`` in ``crud_book.delete_book``
    makes this test FAIL on SQLite — the FK ON DELETE SET NULL is not enforced by
    the create_all schema without PRAGMA, so deleting the book either errors or
    leaves a dangling book_id. Reverting restores green.
    """
    project_id = await _create_project(client, auth_headers)
    book_id = await _create_book(client, auth_headers, project_id)
    pl = await _create_plotline(
        client, auth_headers, project_id, book_id=book_id
    )
    assert pl["book_id"] == book_id

    # Delete the book.
    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/books/{book_id}", headers=auth_headers
    )
    assert del_resp.status_code == 204

    # Plotline survives; its book_id fell back to null.
    pl_after = await client.get(
        f"/api/v1/projects/{project_id}/plotlines/{pl['id']}", headers=auth_headers
    )
    assert pl_after.status_code == 200
    assert pl_after.json()["book_id"] is None
