<!-- tags: dev, docker, setup, ports, scripts, tools -->
<!-- tags: dev, docker, setup, ports, scripts -->

# 개발 환경

## 인프라 (Docker)

```bash
cd docker && docker compose -f docker-compose.dev.yml up -d
```

| 서비스 | 컨테이너 | 포트 |
|--------|----------|------|
| PostgreSQL 16 | vf-postgres | 5433:5432 |
| Redis 7 | vf-redis | 6379:6379 |

DB 기본 인증: `postgres:postgres`, 데이터베이스: `vision_flow`

## 서비스 실행

| 서비스 | 명령 | 포트 |
|--------|------|------|
| Backend | `cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8100 --reload` | 8100 |
| Frontend | `cd frontend && npm run dev` | 5273 |
| AI Worker | `cd ai-worker && source .venv/bin/activate && celery -A app.celery_app worker --loglevel=info` | — |

## 유틸리티 스크립트

```
scripts/
├── db-reset.sh    # DB 초기화
├── dev-start.sh   # 전체 개발 환경 시작
└── dev-stop.sh    # 전체 개발 환경 정지
```

## 프록시 설정

Vite dev server가 `/api` 요청을 `http://localhost:8100`으로 프록시.

## 코드 품질

| 도구 | 범위 | 용도 |
|------|------|------|
| ESLint 9 + Prettier | Frontend | 린트 + 포맷팅 |
| Ruff | Backend, AI Worker | 린트 (line-length=120) |
| Pyrefly | Backend | 타입 체크 |
| Vitest | Frontend | 단위 테스트 |
| Pytest | Backend | 단위/통합 테스트 |
| Husky + lint-staged | Frontend | pre-commit 훅 |

## Alembic 마이그레이션

```bash
cd backend
alembic revision --autogenerate -m "description"
alembic upgrade head
```

현재 마이그레이션 9개 (initial → task_snapshot → version_split → 3level_version_stash)
