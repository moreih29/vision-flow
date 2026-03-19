import httpx


async def _create_project(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> int:
    """Helper: create a project and return its ID."""
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "Label Class Test Project"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_task(client: httpx.AsyncClient, auth_headers: dict[str, str], project_id: int) -> int:
    """Helper: create a task in a project and return its ID."""
    resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"name": "Label Task", "task_type": "object_detection"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_label_class(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)
    task_id = await _create_task(client, auth_headers, project_id)

    resp = await client.post(
        f"/api/v1/tasks/{task_id}/classes",
        json={"name": "Car", "color": "#FF0000"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "Car"
    assert data["color"] == "#FF0000"
    assert data["task_id"] == task_id
    assert "id" in data


async def test_list_label_classes(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)
    task_id = await _create_task(client, auth_headers, project_id)

    await client.post(
        f"/api/v1/tasks/{task_id}/classes",
        json={"name": "Person", "color": "#00FF00"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/tasks/{task_id}/classes",
        json={"name": "Bicycle", "color": "#0000FF"},
        headers=auth_headers,
    )

    resp = await client.get(f"/api/v1/tasks/{task_id}/classes", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    names = {c["name"] for c in data}
    assert "Person" in names
    assert "Bicycle" in names


async def test_update_label_class(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)
    task_id = await _create_task(client, auth_headers, project_id)

    create_resp = await client.post(
        f"/api/v1/tasks/{task_id}/classes",
        json={"name": "Dog", "color": "#FFFF00"},
        headers=auth_headers,
    )
    class_id = create_resp.json()["id"]

    resp = await client.put(
        f"/api/v1/classes/{class_id}",
        json={"name": "Cat", "color": "#FF00FF"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Cat"
    assert data["color"] == "#FF00FF"


async def test_delete_label_class(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)
    task_id = await _create_task(client, auth_headers, project_id)

    create_resp = await client.post(
        f"/api/v1/tasks/{task_id}/classes",
        json={"name": "Tree", "color": "#008000"},
        headers=auth_headers,
    )
    class_id = create_resp.json()["id"]

    resp = await client.delete(f"/api/v1/classes/{class_id}", headers=auth_headers)
    assert resp.status_code == 204
