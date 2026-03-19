import httpx


async def test_create_project(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "My Project", "description": "A test project"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Project"
    assert data["description"] == "A test project"
    assert data["data_store_count"] == 0
    assert "id" in data
    assert "owner_id" in data


async def test_list_projects(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    # Create two projects
    await client.post(
        "/api/v1/projects",
        json={"name": "Project A"},
        headers=auth_headers,
    )
    await client.post(
        "/api/v1/projects",
        json={"name": "Project B"},
        headers=auth_headers,
    )
    resp = await client.get("/api/v1/projects", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    names = {p["name"] for p in data}
    assert "Project A" in names
    assert "Project B" in names


async def test_get_project(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Get Me"},
        headers=auth_headers,
    )
    project_id = create_resp.json()["id"]

    resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["name"] == "Get Me"
    assert resp.json()["id"] == project_id


async def test_update_project(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Old Name", "description": "Old desc"},
        headers=auth_headers,
    )
    project_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/projects/{project_id}",
        json={"name": "New Name", "description": "New desc"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "New Name"
    assert data["description"] == "New desc"


async def test_delete_project(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    create_resp = await client.post(
        "/api/v1/projects",
        json={"name": "Delete Me"},
        headers=auth_headers,
    )
    project_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/v1/projects/{project_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_unauthorized_access(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/projects")
    assert resp.status_code == 401

    resp = await client.post("/api/v1/projects", json={"name": "Unauthorized"})
    assert resp.status_code == 401
