import httpx


async def _create_project(client: httpx.AsyncClient, auth_headers: dict[str, str]) -> int:
    """Helper: create a project and return its ID."""
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "Task Test Project"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_task(client: httpx.AsyncClient, auth_headers: dict[str, str], project_id: int) -> int:
    """Helper: create a task in a project and return its ID."""
    resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={
            "name": "My Task",
            "description": "A test task",
            "task_type": "object_detection",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def test_create_task(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={
            "name": "My Task",
            "description": "A test task",
            "task_type": "object_detection",
        },
        headers=auth_headers,
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["name"] == "My Task"
    assert data["description"] == "A test task"
    assert data["task_type"] == "object_detection"
    assert data["project_id"] == project_id
    assert data["image_count"] == 0
    assert data["class_count"] == 0
    assert "id" in data


async def test_list_tasks(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)

    await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"name": "Task A", "task_type": "classification"},
        headers=auth_headers,
    )
    await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"name": "Task B", "task_type": "instance_segmentation"},
        headers=auth_headers,
    )

    resp = await client.get(f"/api/v1/projects/{project_id}/tasks", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert isinstance(data, list)
    assert len(data) >= 2
    names = {t["name"] for t in data}
    assert "Task A" in names
    assert "Task B" in names


async def test_get_task(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)
    task_id = await _create_task(client, auth_headers, project_id)

    resp = await client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == task_id
    assert data["name"] == "My Task"
    assert data["project_id"] == project_id


async def test_update_task(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)
    task_id = await _create_task(client, auth_headers, project_id)

    resp = await client.put(
        f"/api/v1/tasks/{task_id}",
        json={"name": "Updated Task", "description": "Updated desc"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    data = resp.json()
    assert data["name"] == "Updated Task"
    assert data["description"] == "Updated desc"


async def test_delete_task(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)
    task_id = await _create_task(client, auth_headers, project_id)

    resp = await client.delete(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Verify it's gone
    get_resp = await client.get(f"/api/v1/tasks/{task_id}", headers=auth_headers)
    assert get_resp.status_code == 404


async def test_create_task_requires_type(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    project_id = await _create_project(client, auth_headers)

    resp = await client.post(
        f"/api/v1/projects/{project_id}/tasks",
        json={"name": "No Type Task"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


async def test_unauthorized_task_access(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/projects/1/tasks")
    assert resp.status_code == 401

    resp = await client.post(
        "/api/v1/projects/1/tasks",
        json={"name": "Unauthorized", "task_type": "classification"},
    )
    assert resp.status_code == 401
