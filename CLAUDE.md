<!-- PROJECT:START -->
## Vision Flow

웹 기반 Vision AI 파이프라인 관리 서비스. 이미지 라벨링과 Git-like 스냅샷 버전 관리를 중심으로 학습/추론 워크플로우를 통합한다.

### Essentials
- Monorepo: `frontend/` (React 19 + Vite + shadcn/ui), `backend/` (FastAPI + SQLAlchemy async), `ai-worker/` (Celery + Ultralytics YOLO), `docker/` (Postgres 16 + Redis 7)
- Backend 계층 준수: Router → Service → Model. Router에서 DB 직접 접근 금지
- Frontend UI: shadcn/ui 컴포넌트 사용. 브라우저 기본 UI(`window.confirm`, `alert`) 금지 — 커스텀 Dialog로 대체
- 언어: 커밋 메시지/주석/문서/UI 모두 한글 우선 (커밋은 conventional commits 형식)
- Python 품질 툴: Ruff (린트) + Pyrefly (타입 체크, mypy 아님), 라인 길이 120
- 개발 실행: `cd docker && docker compose -f docker-compose.dev.yml up -d` → backend 8100 (uvicorn), frontend 5273 (vite), ai-worker celery
- 핵심 도메인: Task 단위 이미지 라벨링 → Git-like 스냅샷 버전 관리 (major.minor, 3-hash dirty detection, stash/restore) → 학습/추론
<!-- PROJECT:END -->
