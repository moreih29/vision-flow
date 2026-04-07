<!-- tags: dev-workflow, scripts, conventions, migrations -->
# Development Workflow

## 실행 순서
1. `cd docker && docker compose -f docker-compose.dev.yml up -d` — PostgreSQL 16 (:5433) + Redis 7 (:6379)
2. `cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8100 --reload`
3. `cd frontend && npm run dev` — Vite dev server (:5273), /api → proxy to :8100
4. (선택) `cd ai-worker && source .venv/bin/activate && celery -A app.celery_app worker --loglevel=info`

## 스크립트
- `scripts/dev-start.sh` — 전체 서비스 일괄 시작
- `scripts/dev-stop.sh` — 전체 서비스 중지
- `scripts/db-reset.sh` — DB 초기화 (볼륨 삭제 → 재시작 → Alembic migrate)

## DB 마이그레이션
```bash
cd backend
alembic upgrade head      # 마이그레이션 적용
alembic revision --autogenerate -m "description"  # 새 마이그레이션 생성
```

## 컨벤션
- 커밋 메시지: 영어, conventional commits (feat:, fix:, refactor:, docs:)
- 문서/주석/UI 텍스트: 한국어
- 브랜치: feat/*, fix/* → main 머지
- Frontend: shadcn/ui 컴포넌트 필수, 브라우저 기본 UI 금지
- Backend: Router에서 직접 DB 접근 금지 (Service 계층 경유)
- Linting: Ruff (Python), ESLint (TypeScript)