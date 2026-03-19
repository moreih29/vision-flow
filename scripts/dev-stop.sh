#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Vision Flow 개발 환경 중지 ==="

# 애플리케이션 프로세스 중지
echo "[1/2] 애플리케이션 프로세스 중지..."
pkill -f "uvicorn app.main:app.*--port 8100" 2>/dev/null && echo "  Backend 중지" || echo "  Backend 이미 중지됨"
pkill -f "vite.*--port 5174" 2>/dev/null && echo "  Frontend 중지" || echo "  Frontend 이미 중지됨"
pkill -f "celery.*app.celery_app" 2>/dev/null && echo "  AI Worker 중지" || echo "  AI Worker 이미 중지됨"

# Docker 인프라 중지
echo "[2/2] Docker 인프라 중지..."
cd "$ROOT_DIR/docker"
docker compose -f docker-compose.dev.yml down

echo "=== 모든 서비스 중지 완료 ==="
