#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== Vision Flow 개발 환경 시작 ==="

# 1. 인프라 (PostgreSQL + Redis)
echo "[1/4] Docker 인프라 시작..."
cd "$ROOT_DIR/docker"
docker compose -f docker-compose.dev.yml up -d
echo "  PostgreSQL: localhost:5433"
echo "  Redis: localhost:6379"

# 2. Backend
echo "[2/4] Backend 시작..."
cd "$ROOT_DIR/backend"
if [ ! -d ".venv" ]; then
  python3 -m venv .venv
  source .venv/bin/activate
  pip install -e ".[dev]" -q
else
  source .venv/bin/activate
fi
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload &
BACKEND_PID=$!
echo "  Backend PID: $BACKEND_PID (localhost:8002)"

# 3. Frontend
echo "[3/4] Frontend 시작..."
cd "$ROOT_DIR/frontend"
if [ ! -d "node_modules" ]; then
  npm install -q
fi
npm run dev &
FRONTEND_PID=$!
echo "  Frontend PID: $FRONTEND_PID (localhost:5174)"

echo ""
echo "=== 모든 서비스 시작 완료 ==="
echo "  Frontend: http://localhost:5174"
echo "  Backend:  http://localhost:8002"
echo "  API Docs: http://localhost:8002/docs"
echo ""
echo "종료: ./scripts/dev-stop.sh"

wait
