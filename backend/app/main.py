from collections.abc import AsyncGenerator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import settings
from app.error_handler import register_error_handlers
from app.logging_config import setup_logging
from app.routers import annotations, auth, data_stores, images, label_classes, projects, tasks


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncGenerator[None, None]:
    # Startup
    setup_logging()
    yield
    # Shutdown


app = FastAPI(
    title="Vision Flow API",
    version="0.1.0",
    lifespan=lifespan,
)

# 공통 에러 핸들러 등록
register_error_handlers(app)

# CORS -- allow all origins for development
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",")],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(auth.router, prefix="/api/v1")
app.include_router(projects.router, prefix="/api/v1")
app.include_router(data_stores.router, prefix="/api/v1")
app.include_router(images.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")
app.include_router(label_classes.router, prefix="/api/v1")
app.include_router(annotations.router, prefix="/api/v1")


@app.get("/health", tags=["health"])
async def health_check() -> dict[str, str]:
    return {"status": "ok"}
