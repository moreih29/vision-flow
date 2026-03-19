from collections.abc import AsyncGenerator

import httpx
import pytest_asyncio
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from app.config import settings
from app.database import Base
from app.dependencies import get_db
from app.main import app

# ---------------------------------------------------------------------------
# Test database URL – use a dedicated test database
# ---------------------------------------------------------------------------
_BASE_URL = settings.database_url.rsplit("/", 1)[0]
TEST_DATABASE_URL = f"{_BASE_URL}/vision_flow_test"


# ---------------------------------------------------------------------------
# Per-test: create engine, tables, session, cleanup
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
async def db_session() -> AsyncGenerator[AsyncSession, None]:
    """매 테스트마다 테이블 생성 → 세션 제공 → 롤백 → 테이블 삭제."""
    # DB 생성 (존재하지 않을 때만)
    admin_engine = create_async_engine(f"{_BASE_URL}/postgres", isolation_level="AUTOCOMMIT")
    async with admin_engine.connect() as conn:
        result = await conn.execute(
            text("SELECT 1 FROM pg_database WHERE datname = 'vision_flow_test'")
        )
        if result.scalar() is None:
            await conn.execute(text("CREATE DATABASE vision_flow_test"))
    await admin_engine.dispose()

    # 모델 import + 테이블 생성
    import app.models  # noqa: F401

    engine = create_async_engine(TEST_DATABASE_URL, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with session_factory() as session:
        yield session
        await session.rollback()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


# ---------------------------------------------------------------------------
# Per-test: httpx.AsyncClient wired to the FastAPI app
# ---------------------------------------------------------------------------
@pytest_asyncio.fixture
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
@pytest_asyncio.fixture
async def auth_headers(client: httpx.AsyncClient) -> dict[str, str]:
    """Register a test user and return Authorization headers."""
    await client.post(
        "/api/v1/auth/register",
        json={
            "email": "test@example.com",
            "name": "Test User",
            "password": "Test1234!",
        },
    )
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": "test@example.com", "password": "Test1234!"},
    )
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
