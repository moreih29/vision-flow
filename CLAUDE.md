# Vision Flow

웹 기반 Vision AI 모델 학습/추론 파이프라인 관리 서비스.

## 구조

```
frontend/    # React 19 + TypeScript + Vite + Tailwind + shadcn/ui
backend/     # Python 3.11+ + FastAPI + SQLAlchemy (async) + Alembic
ai-worker/   # Python 3.11+ + Celery + Ultralytics (YOLO)
docker/      # 개발 인프라 (PostgreSQL 16 + Redis 7)
```

## 실행

```bash
# 인프라
cd docker && docker compose -f docker-compose.dev.yml up -d

# Backend
cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8100 --reload

# Frontend
cd frontend && npm run dev

# AI Worker
cd ai-worker && source .venv/bin/activate && celery -A app.celery_app worker --loglevel=info
```

## 컨벤션

- 코드 커밋 메시지: 영어 (conventional commits)
- 문서/주석/UI: 한국어
- Backend: Router → Service → Model 계층 준수. Router에서 직접 DB 접근 금지.
- Frontend: shadcn/ui 컴포넌트 사용. 브라우저 기본 UI(`confirm`, `alert`) 사용 금지.