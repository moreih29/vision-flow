#!/bin/bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== DB 초기화 ==="
echo "경고: 모든 데이터가 삭제됩니다!"
read -p "계속하시겠습니까? (y/N) " confirm
if [ "$confirm" != "y" ] && [ "$confirm" != "Y" ]; then
  echo "취소됨."
  exit 0
fi

# Docker 볼륨 삭제 후 재생성
echo "[1/3] PostgreSQL 볼륨 삭제..."
cd "$ROOT_DIR/docker"
docker compose -f docker-compose.dev.yml down -v
docker compose -f docker-compose.dev.yml up -d

echo "[2/3] DB 준비 대기..."
sleep 3

# Alembic 마이그레이션 적용
echo "[3/3] Alembic 마이그레이션 적용..."
cd "$ROOT_DIR/backend"
source .venv/bin/activate
alembic upgrade head

echo "=== DB 초기화 완료 ==="
