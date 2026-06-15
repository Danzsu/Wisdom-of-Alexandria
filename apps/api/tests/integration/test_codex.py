"""Integration tests for Codex CRUD: Character, Location, WorldbuildingEntry, CodexEntry."""
import uuid

import pytest
from httpx import AsyncClient


async def _create_project(client: AsyncClient, auth_headers: dict) -> str:
    resp = await client.post(
        "/api/v1/projects",
        json={"title": "Test Project"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


# ---------------------------------------------------------------------------
# Character tests
# ---------------------------------------------------------------------------

async def test_create_character(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Kovács János"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Kovács János"
    assert data["project_id"] == project_id
    assert data["aliases"] == []
    assert data["ai_visible"] is True
    assert data["description"] is None
    assert data["backstory"] is None
    assert data["personality"] is None
    assert data["appearance"] is None
    assert data["role"] is None
    assert data["notes"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_character_with_all_fields(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={
            "name": "Szabó Éva",
            "aliases": ["Évi", "Eva"],
            "description": "Egy titokzatos nő",
            "backstory": "Gyermekkorát vidéken töltötte",
            "personality": "Introvertált, okos",
            "appearance": "Sötét hajú, zöld szemű",
            "role": "protagonist",
            "ai_visible": False,
            "notes": "Fontos mellékszereplő",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Szabó Éva"
    assert data["aliases"] == ["Évi", "Eva"]
    assert data["description"] == "Egy titokzatos nő"
    assert data["backstory"] == "Gyermekkorát vidéken töltötte"
    assert data["personality"] == "Introvertált, okos"
    assert data["appearance"] == "Sötét hajú, zöld szemű"
    assert data["role"] == "protagonist"
    assert data["ai_visible"] is False
    assert data["notes"] == "Fontos mellékszereplő"


async def test_create_character_aliases_stored_correctly(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Alias Tesztelő", "aliases": ["A", "B", "C"]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["aliases"] == ["A", "B", "C"]

    # Verify persisted by fetching
    char_id = data["id"]
    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/characters/{char_id}",
        headers=auth_headers,
    )
    assert get_resp.json()["aliases"] == ["A", "B", "C"]


async def test_create_character_ai_visible_defaults_true(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Látható Karakter"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["ai_visible"] is True


async def test_create_character_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/characters",
        json={"name": "Senki"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_character_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/characters",
        json={"name": "Senki"},
    )
    assert resp.status_code == 401


async def test_list_characters(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Zéró"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Alpha"},
        headers=auth_headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/characters",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    names = [c["name"] for c in resp.json()]
    assert "Zéró" in names
    assert "Alpha" in names
    assert len(names) == 2


async def test_list_characters_ordered_by_name(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    for name in ["Zoltán", "Anna", "Béla"]:
        await client.post(
            f"/api/v1/projects/{project_id}/characters",
            json={"name": name},
            headers=auth_headers,
        )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/characters",
        headers=auth_headers,
    )
    names = [c["name"] for c in resp.json()]
    assert names == sorted(names)


async def test_get_character_by_id(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = (await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Keresett"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id}/characters/{char_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == char_id
    assert resp.json()["name"] == "Keresett"


async def test_get_character_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/characters/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_character(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = (await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Régi Név"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/characters/{char_id}",
        json={"name": "Új Név", "role": "antagonist"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Új Név"
    assert data["role"] == "antagonist"


async def test_delete_character(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    char_id = (await client.post(
        f"/api/v1/projects/{project_id}/characters",
        json={"name": "Törlendő"},
        headers=auth_headers,
    )).json()["id"]

    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/characters/{char_id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 204

    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/characters/{char_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_character_scoped_to_project(client: AsyncClient, auth_headers: dict):
    project_id_1 = await _create_project(client, auth_headers)
    project_id_2 = await _create_project(client, auth_headers)
    char_id = (await client.post(
        f"/api/v1/projects/{project_id_1}/characters",
        json={"name": "Projekt 1 Karakter"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id_2}/characters/{char_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Location tests
# ---------------------------------------------------------------------------

async def test_create_location(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/locations",
        json={"name": "Régi Kastély"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Régi Kastély"
    assert data["project_id"] == project_id
    assert data["ai_visible"] is True
    assert data["description"] is None
    assert data["geography"] is None
    assert data["atmosphere"] is None
    assert data["notes"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_location_with_all_fields(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/locations",
        json={
            "name": "Fekete Erdő",
            "description": "Sötét, titokzatos erdő",
            "geography": "Hegyvidéki terület, völgyekkel",
            "atmosphere": "Nyomasztó, hideg, csendes",
            "ai_visible": False,
            "notes": "Csak az 5. fejezetben jelenik meg",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Fekete Erdő"
    assert data["description"] == "Sötét, titokzatos erdő"
    assert data["geography"] == "Hegyvidéki terület, völgyekkel"
    assert data["atmosphere"] == "Nyomasztó, hideg, csendes"
    assert data["ai_visible"] is False
    assert data["notes"] == "Csak az 5. fejezetben jelenik meg"


async def test_create_location_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/locations",
        json={"name": "Sehol"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_location_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/locations",
        json={"name": "Sehol"},
    )
    assert resp.status_code == 401


async def test_list_locations(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/locations",
        json={"name": "Helyszín A"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/locations",
        json={"name": "Helyszín B"},
        headers=auth_headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/locations",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    names = [loc["name"] for loc in resp.json()]
    assert "Helyszín A" in names
    assert "Helyszín B" in names
    assert len(names) == 2


async def test_get_location_by_id(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    loc_id = (await client.post(
        f"/api/v1/projects/{project_id}/locations",
        json={"name": "Keresett Hely"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id}/locations/{loc_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == loc_id
    assert resp.json()["name"] == "Keresett Hely"


async def test_get_location_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/locations/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_location(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    loc_id = (await client.post(
        f"/api/v1/projects/{project_id}/locations",
        json={"name": "Régi Hely"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/locations/{loc_id}",
        json={"name": "Új Hely", "atmosphere": "Meleg és barátságos"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Új Hely"
    assert data["atmosphere"] == "Meleg és barátságos"


async def test_delete_location(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    loc_id = (await client.post(
        f"/api/v1/projects/{project_id}/locations",
        json={"name": "Törlendő Hely"},
        headers=auth_headers,
    )).json()["id"]

    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/locations/{loc_id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 204

    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/locations/{loc_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_location_scoped_to_project(client: AsyncClient, auth_headers: dict):
    project_id_1 = await _create_project(client, auth_headers)
    project_id_2 = await _create_project(client, auth_headers)
    loc_id = (await client.post(
        f"/api/v1/projects/{project_id_1}/locations",
        json={"name": "Projekt 1 Helyszín"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id_2}/locations/{loc_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# WorldbuildingEntry tests
# ---------------------------------------------------------------------------

async def test_create_worldbuilding_entry(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/worldbuilding",
        json={"name": "Mágia Rendszere"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Mágia Rendszere"
    assert data["project_id"] == project_id
    assert data["ai_visible"] is True
    assert data["category"] is None
    assert data["description"] is None
    assert data["notes"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_worldbuilding_entry_with_all_fields(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/worldbuilding",
        json={
            "name": "Sárkányok Eredete",
            "category": "creatures",
            "description": "A sárkányok az ősidőkből erednek",
            "ai_visible": False,
            "notes": "Még finomítandó",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Sárkányok Eredete"
    assert data["category"] == "creatures"
    assert data["description"] == "A sárkányok az ősidőkből erednek"
    assert data["ai_visible"] is False
    assert data["notes"] == "Még finomítandó"


async def test_create_worldbuilding_entry_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/worldbuilding",
        json={"name": "Ismeretlen"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_worldbuilding_entry_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/worldbuilding",
        json={"name": "Ismeretlen"},
    )
    assert resp.status_code == 401


async def test_list_worldbuilding_entries(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/worldbuilding",
        json={"name": "Bejegyzés A"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/worldbuilding",
        json={"name": "Bejegyzés B"},
        headers=auth_headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/worldbuilding",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    names = [e["name"] for e in resp.json()]
    assert "Bejegyzés A" in names
    assert "Bejegyzés B" in names
    assert len(names) == 2


async def test_get_worldbuilding_entry_by_id(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id}/worldbuilding",
        json={"name": "Keresett Bejegyzés"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id}/worldbuilding/{entry_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == entry_id
    assert resp.json()["name"] == "Keresett Bejegyzés"


async def test_get_worldbuilding_entry_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/worldbuilding/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_worldbuilding_entry(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id}/worldbuilding",
        json={"name": "Régi Bejegyzés"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/worldbuilding/{entry_id}",
        json={"name": "Frissített Bejegyzés", "category": "lore"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Frissített Bejegyzés"
    assert data["category"] == "lore"


async def test_delete_worldbuilding_entry(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id}/worldbuilding",
        json={"name": "Törlendő Bejegyzés"},
        headers=auth_headers,
    )).json()["id"]

    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/worldbuilding/{entry_id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 204

    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/worldbuilding/{entry_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_worldbuilding_entry_scoped_to_project(client: AsyncClient, auth_headers: dict):
    project_id_1 = await _create_project(client, auth_headers)
    project_id_2 = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id_1}/worldbuilding",
        json={"name": "Projekt 1 Bejegyzés"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id_2}/worldbuilding/{entry_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# CodexEntry tests
# ---------------------------------------------------------------------------

async def test_create_codex_entry(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Elsőkönyv Bejegyzés"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Elsőkönyv Bejegyzés"
    assert data["project_id"] == project_id
    assert data["entry_type"] == "custom"
    assert data["ai_visible"] is True
    assert data["tags"] == []
    assert data["aliases"] == []
    assert data["role"] is None
    assert data["content"] is None
    assert "id" in data
    assert "created_at" in data
    assert "updated_at" in data


async def test_create_codex_entry_with_all_fields(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={
            "title": "Varázslat Szabályai",
            "entry_type": "magic_system",
            "content": "A mágia az energia átalakításán alapul",
            "aliases": ["Varázs", "Mágia rendszer"],
            "role": "rendszer",
            "ai_visible": False,
            "tags": ["mágia", "szabályok", "rendszer"],
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["title"] == "Varázslat Szabályai"
    assert data["entry_type"] == "magic_system"
    assert data["content"] == "A mágia az energia átalakításán alapul"
    assert data["aliases"] == ["Varázs", "Mágia rendszer"]
    assert data["role"] == "rendszer"
    assert data["ai_visible"] is False
    assert data["tags"] == ["mágia", "szabályok", "rendszer"]


async def test_create_codex_entry_tags_stored_correctly(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Teg Teszt", "tags": ["x", "y", "z"]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    entry_id = resp.json()["id"]

    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        headers=auth_headers,
    )
    assert get_resp.json()["tags"] == ["x", "y", "z"]


async def test_create_codex_entry_aliases_stored_correctly(client: AsyncClient, auth_headers: dict):
    """Aliases persist as a real JSON list column (P1.4), round-tripping on GET."""
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Álnév Teszt", "aliases": ["Lené", "az írnok"]},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["aliases"] == ["Lené", "az írnok"]

    entry_id = data["id"]
    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        headers=auth_headers,
    )
    assert get_resp.json()["aliases"] == ["Lené", "az írnok"]


async def test_update_codex_entry_aliases_and_role(client: AsyncClient, auth_headers: dict):
    """PATCH persists the dedicated aliases + role columns (P1.4)."""
    project_id = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Szelene", "aliases": ["Lené"], "role": "Protagonista"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        json={"aliases": ["Lené", "az írnok"], "role": "Antagonista"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["aliases"] == ["Lené", "az írnok"]
    assert data["role"] == "Antagonista"

    # Verify persisted (not just echoed) by fetching.
    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        headers=auth_headers,
    )
    assert get_resp.json()["aliases"] == ["Lené", "az írnok"]
    assert get_resp.json()["role"] == "Antagonista"


async def test_create_codex_entry_project_not_found(client: AsyncClient, auth_headers: dict):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/codex",
        json={"title": "Semmi"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_create_codex_entry_requires_auth(client: AsyncClient):
    resp = await client.post(
        f"/api/v1/projects/{uuid.uuid4()}/codex",
        json={"title": "Semmi"},
    )
    assert resp.status_code == 401


async def test_list_codex_entries(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Codex A"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Codex B"},
        headers=auth_headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/codex",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    titles = [e["title"] for e in resp.json()]
    assert "Codex A" in titles
    assert "Codex B" in titles
    assert len(titles) == 2


async def test_get_codex_entry_by_id(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Keresett Codex"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["id"] == entry_id
    assert resp.json()["title"] == "Keresett Codex"


async def test_get_codex_entry_not_found(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    resp = await client.get(
        f"/api/v1/projects/{project_id}/codex/{uuid.uuid4()}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_update_codex_entry(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Régi Codex"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.patch(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        json={"title": "Frissített Codex", "tags": ["frissített"]},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Frissített Codex"
    assert data["tags"] == ["frissített"]


async def test_delete_codex_entry(client: AsyncClient, auth_headers: dict):
    project_id = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Törlendő Codex"},
        headers=auth_headers,
    )).json()["id"]

    del_resp = await client.delete(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        headers=auth_headers,
    )
    assert del_resp.status_code == 204

    get_resp = await client.get(
        f"/api/v1/projects/{project_id}/codex/{entry_id}",
        headers=auth_headers,
    )
    assert get_resp.status_code == 404


async def test_codex_entry_scoped_to_project(client: AsyncClient, auth_headers: dict):
    project_id_1 = await _create_project(client, auth_headers)
    project_id_2 = await _create_project(client, auth_headers)
    entry_id = (await client.post(
        f"/api/v1/projects/{project_id_1}/codex",
        json={"title": "Projekt 1 Codex"},
        headers=auth_headers,
    )).json()["id"]

    resp = await client.get(
        f"/api/v1/projects/{project_id_2}/codex/{entry_id}",
        headers=auth_headers,
    )
    assert resp.status_code == 404


async def test_list_codex_entries_returns_all_regardless_of_ai_visible(
    client: AsyncClient, auth_headers: dict
):
    """List endpoint must return all entries, no ai_visible filtering at API layer."""
    project_id = await _create_project(client, auth_headers)
    await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Látható", "ai_visible": True},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Rejtett", "ai_visible": False},
        headers=auth_headers,
    )
    resp = await client.get(
        f"/api/v1/projects/{project_id}/codex",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    titles = [e["title"] for e in resp.json()]
    assert "Látható" in titles
    assert "Rejtett" in titles


# ---------------------------------------------------------------------------
# A5b: CodexEntry.aliases has no Python-side default=list anymore (mutable
# default footgun). The normal CRUD create path always supplies aliases=[] via
# CodexEntryCreate's default_factory, so the API never sees NULL (see
# test_create_codex_entry). Constructing the model DIRECTLY without aliases now
# yields None at the column level (the column is nullable; the DB
# server_default only applies to inserts that OMIT the column, which SQLAlchemy
# doesn't do here). The Read schema must coerce that stray None to [] and never
# error — that's the contract the API depends on.
# ---------------------------------------------------------------------------

async def test_codex_entry_created_via_api_without_aliases_is_empty_list(
    client: AsyncClient, auth_headers: dict
):
    """The CRUD create path (CodexEntryCreate default_factory) yields []."""
    project_id = await _create_project(client, auth_headers)
    resp = await client.post(
        f"/api/v1/projects/{project_id}/codex",
        json={"title": "Nincs álnév"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["aliases"] == []


async def test_codex_entry_read_coerces_null_aliases_to_empty_list(
    client: AsyncClient, auth_headers: dict, db_session
):
    """A model row with a NULL aliases column (direct construction, no Python
    default) must serialize cleanly through the Read schema as [] — never raise
    a validation error on the non-optional list[str] field."""
    from alexandria_core.models.codex_entry import CodexEntry

    project_id = await _create_project(client, auth_headers)

    # Direct construction WITHOUT aliases -> column persists as NULL.
    entry = CodexEntry(project_id=uuid.UUID(project_id), title="No Aliases")
    db_session.add(entry)
    await db_session.commit()
    await db_session.refresh(entry)
    assert entry.aliases is None  # confirms the Python default is truly gone

    # The Read view must NOT error and must surface [] for the NULL column.
    resp = await client.get(
        f"/api/v1/projects/{project_id}/codex/{entry.id}",
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["aliases"] == []
