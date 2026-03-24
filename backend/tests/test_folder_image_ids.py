"""Tests for GET /data-stores/{id}/folder-image-ids endpoint.

Verifies the new FolderImageIdsResponse schema, the service method, and the
router, including correct filtering by folder path and subfolder inclusion.
"""

import io

import httpx

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _create_project(client: httpx.AsyncClient, headers: dict) -> int:
    resp = await client.post(
        "/api/v1/projects",
        json={"name": "FolderImageIds Test Project"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _create_data_store(client: httpx.AsyncClient, headers: dict, project_id: int) -> int:
    resp = await client.post(
        f"/api/v1/projects/{project_id}/data-stores",
        json={"name": "Test DS"},
        headers=headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]


async def _upload_image(
    client: httpx.AsyncClient,
    headers: dict,
    data_store_id: int,
    filename: str,
    folder_path: str = "",
) -> int:
    """Upload a minimal 1x1 PNG and return its image ID."""
    # Minimal valid PNG bytes (1x1 transparent pixel)
    png_bytes = (
        b"\x89PNG\r\n\x1a\n"
        b"\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89"
        b"\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05\x00\x01\r\n-\xb4"
        b"\x00\x00\x00\x00IEND\xaeB`\x82"
    )
    form_data: dict = {}
    if folder_path:
        form_data["folder_paths"] = folder_path

    resp = await client.post(
        f"/api/v1/data-stores/{data_store_id}/images",
        content=None,
        files={"files": (filename, io.BytesIO(png_bytes), "image/png")},
        data=form_data,
        headers=headers,
    )
    assert resp.status_code == 201, f"Upload failed: {resp.text}"
    images = resp.json()
    assert len(images) >= 1
    return images[0]["id"]


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


async def test_folder_image_ids_root_returns_all(client: httpx.AsyncClient, auth_headers: dict):
    """Calling with path='' returns all image IDs across all folders."""
    project_id = await _create_project(client, auth_headers)
    ds_id = await _create_data_store(client, auth_headers, project_id)

    id1 = await _upload_image(client, auth_headers, ds_id, "a.png", "")
    id2 = await _upload_image(client, auth_headers, ds_id, "b.png", "cats")
    id3 = await _upload_image(client, auth_headers, ds_id, "c.png", "cats/kittens")

    resp = await client.get(
        f"/api/v1/data-stores/{ds_id}/folder-image-ids",
        params={"path": ""},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "image_ids" in body
    assert "total" in body
    assert body["total"] == len(body["image_ids"])

    returned_ids = set(body["image_ids"])
    assert id1 in returned_ids
    assert id2 in returned_ids
    assert id3 in returned_ids


async def test_folder_image_ids_subfolder_included(client: httpx.AsyncClient, auth_headers: dict):
    """path='cats' should include images in 'cats' AND 'cats/kittens'."""
    project_id = await _create_project(client, auth_headers)
    ds_id = await _create_data_store(client, auth_headers, project_id)

    id_root = await _upload_image(client, auth_headers, ds_id, "root.png", "")
    id_cats = await _upload_image(client, auth_headers, ds_id, "cats.png", "cats")
    id_kittens = await _upload_image(client, auth_headers, ds_id, "kittens.png", "cats/kittens")

    resp = await client.get(
        f"/api/v1/data-stores/{ds_id}/folder-image-ids",
        params={"path": "cats"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    returned_ids = set(body["image_ids"])

    assert id_cats in returned_ids, "cats/ image should be included"
    assert id_kittens in returned_ids, "cats/kittens/ image should be included"
    assert id_root not in returned_ids, "root image should NOT be included"
    assert body["total"] == 2


async def test_folder_image_ids_exact_folder_only(client: httpx.AsyncClient, auth_headers: dict):
    """path='cats/kittens' should return only images in that exact subfolder."""
    project_id = await _create_project(client, auth_headers)
    ds_id = await _create_data_store(client, auth_headers, project_id)

    id_cats = await _upload_image(client, auth_headers, ds_id, "cats.png", "cats")
    id_kittens = await _upload_image(client, auth_headers, ds_id, "kittens.png", "cats/kittens")

    resp = await client.get(
        f"/api/v1/data-stores/{ds_id}/folder-image-ids",
        params={"path": "cats/kittens"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    returned_ids = set(body["image_ids"])

    assert id_kittens in returned_ids
    assert id_cats not in returned_ids
    assert body["total"] == 1


async def test_folder_image_ids_nonexistent_folder_returns_empty(client: httpx.AsyncClient, auth_headers: dict):
    """Non-existent folder path returns empty list, not 404."""
    project_id = await _create_project(client, auth_headers)
    ds_id = await _create_data_store(client, auth_headers, project_id)

    resp = await client.get(
        f"/api/v1/data-stores/{ds_id}/folder-image-ids",
        params={"path": "nonexistent"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["image_ids"] == []
    assert body["total"] == 0


async def test_folder_image_ids_total_matches_image_ids_length(client: httpx.AsyncClient, auth_headers: dict):
    """Schema invariant: total must always equal len(image_ids)."""
    project_id = await _create_project(client, auth_headers)
    ds_id = await _create_data_store(client, auth_headers, project_id)

    for i in range(3):
        await _upload_image(client, auth_headers, ds_id, f"img{i}.png", "folder_a")

    resp = await client.get(
        f"/api/v1/data-stores/{ds_id}/folder-image-ids",
        params={"path": "folder_a"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["total"] == len(body["image_ids"])
    assert body["total"] == 3


async def test_folder_image_ids_requires_auth(client: httpx.AsyncClient, auth_headers: dict):
    """Endpoint must reject unauthenticated requests with 401."""
    project_id = await _create_project(client, auth_headers)
    ds_id = await _create_data_store(client, auth_headers, project_id)

    resp = await client.get(
        f"/api/v1/data-stores/{ds_id}/folder-image-ids",
        params={"path": ""},
    )
    assert resp.status_code == 401


async def test_folder_image_ids_path_traversal_rejected(client: httpx.AsyncClient, auth_headers: dict):
    """Path traversal attempts (../../) should be rejected with 400."""
    project_id = await _create_project(client, auth_headers)
    ds_id = await _create_data_store(client, auth_headers, project_id)

    resp = await client.get(
        f"/api/v1/data-stores/{ds_id}/folder-image-ids",
        params={"path": "../../etc/passwd"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
