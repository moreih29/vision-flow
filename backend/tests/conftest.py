from collections.abc import AsyncGenerator

import httpx
import pytest
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base
from app.dependencies import get_db
from app.main import app

# ---------------------------------------------------------------------------
# Test database URL – use a dedicated test database
# ---------------------------------------------------------------------------
_BASE_URL = settings.database_url.rsplit("/", 1)[0]  # everything before db name
TEST_DATABASE_URL = f"{_BASE_URL}/vision_flow_test"

engine = create_async_engine(TEST_DATABASE_URL, echo=False)
TestingSessionLocal = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


# ---------------------------------------------------------------------------
# Session-scoped: create the test database & tables once per test session
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
async def _setup_database():
    """Create the vision_flow_test database if it doesn't exist, then create all tables."""
    # Connect to the default 'postgres' database to create the test DB
    admin_url = f"{_BASE_URL}/postgres"
    admin_engine = create_async_engine(admin_url, isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        result = await conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'vision_flow_test'")
        )
        if result.scalar() is None:
            await conn.execute(text("CREATE DATABASE vision_flow_test"))
    await admin_engine.dispose()

    # Import all models so Base.metadata is fully populated
    import app.models  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    yield

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ---------------------------------------------------------------------------
# Per-test: provide a fresh DB session with rollback isolation
# ---------------------------------------------------------------------------
@pytest.fixture
async def db_session(_setup_database) -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        yield session
        # Roll back any uncommitted changes so tests stay independent
        await session.rollback()


# ---------------------------------------------------------------------------
# Per-test: httpx.AsyncClient wired to the FastAPI app
# ---------------------------------------------------------------------------
@pytest.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def _override_get_db() -> AsyncGenerator[AsyncSession, None]:
        yield db_session

    app.dependency_overrides[get_db] = _override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()


# ---------------------------------------------------------------------------
# Helper: register + login and return auth headers
# ---------------------------------------------------------------------------
@pytest.fixture
async def auth_headers(client: httpx.AsyncClient) -> dict[str, str]:
    """Register a test user and return Authorization headers."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "password": "testpassword123",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "testpassword123"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
