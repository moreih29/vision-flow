import httpx


async def test_register_success(client: httpx.AsyncClient):
    resp = await client.post(
        "/api/v1/auth/register",
        json={
            "email": "new@example.com",
            "name": "New User",
            "password": "Test1234!",
        },
    )
    assert resp.status_code == 201
    data = resp.json()
    assert data["email"] == "new@example.com"
    assert data["name"] == "New User"
    assert data["is_active"] is True
    assert data["is_admin"] is False
    assert "id" in data


async def test_register_duplicate_email(client: httpx.AsyncClient):
    payload = {
        "email": "dup@example.com",
        "name": "First",
        "password": "Test1234!",
    }
    resp1 = await client.post("/api/v1/auth/register", json=payload)
    assert resp1.status_code == 201

    resp2 = await client.post("/api/v1/auth/register", json=payload)
    assert resp2.status_code == 409
    assert "already registered" in resp2.json()["error"]["message"].lower()


async def test_login_success(client: httpx.AsyncClient):
    # Register first
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "login@example.com",
            "name": "Login User",
            "password": "Test1234!",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "login@example.com", "password": "Test1234!"},
    )
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


async def test_login_wrong_password(client: httpx.AsyncClient):
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "wrongpw@example.com",
            "name": "Wrong PW",
            "password": "Test1234!",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "wrongpw@example.com", "password": "wrongpassword"},
    )
    assert resp.status_code == 401


async def test_get_me_authenticated(client: httpx.AsyncClient, auth_headers: dict[str, str]):
    resp = await client.get("/api/v1/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    data = resp.json()
    assert data["email"] == "test@example.com"
    assert data["name"] == "Test User"


async def test_get_me_unauthenticated(client: httpx.AsyncClient):
    resp = await client.get("/api/v1/auth/me")
    assert resp.status_code == 401
