import httpx


async def _create_project(
    client: httpx.AsyncClient, auth_headers: dict[str, str]
) -> int:
    """Helper: create a project and return its ID."""
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "Dataset Test Project"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_dataset(
    client: httpx.AsyncClient, auth_headers: dict[str, str]
):
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={"name": "My Dataset", "description": "A test dataset"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Dataset"
    assert data["description"] == "A test dataset"
    assert data["project_id"] == project_id
    assert data["image_count"] == 0
    assert "id" in data


async def test_list_datasets(
    client: httpx.AsyncClient, auth_headers: dict[str, str]
):
    project_id = await _create_project(client, auth_headers)

    await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={"name": "DS A"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={"name": "DS B"},
        headers=auth_headers,
    )

    resp = await client.get(
        f"/api/v1/projects/{project_id}/datasets", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    names = {d["name"] for d in data}
    assert "DS A" in names
    assert "DS B" in names


async def test_get_dataset(
    client: httpx.AsyncClient, auth_headers: dict[str, str]
):
    project_id = await _create_project(client, auth_headers)

    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={"name": "Get This DS"},
        headers=auth_headers,
    )
    dataset_id = create_resp.json()["id"]

    resp = await client.get(
        f"/api/v1/datasets/{dataset_id}", headers=auth_headers
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Get This DS"
    assert data["id"] == dataset_id
    assert data["project_id"] == project_id


async def test_delete_dataset(
    client: httpx.AsyncClient, auth_headers: dict[str, str]
):
    project_id = await _create_project(client, auth_headers)

    create_resp = await client.post(
        f"/api/v1/projects/{project_id}/datasets",
        json={"name": "Delete This DS"},
        headers=auth_headers,
    )
    dataset_id = create_resp.json()["id"]

    resp = await client.delete(
        f"/api/v1/datasets/{dataset_id}", headers=auth_headers
    )
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(
        f"/api/v1/datasets/{dataset_id}", headers=auth_headers
    )
    assert get_resp.status_code == 404
