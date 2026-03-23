<!-- tags: dev-environment, docker, testing, deployment, performance, quality-tools, roadmap -->
# Development & Operations

## 개발 환경

### 필수 도구
Node.js 18+, Python 3.11+, Docker & Docker Compose, Git

### 인프라 실행
```bash
cd docker && docker compose -f docker-compose.dev.yml up -d
# PostgreSQL 16 (포트 5433) + Redis 7 (포트 6379)
```

### 애플리케이션 실행
```bash
# Backend (포트 8100)
cd backend && source .venv/bin/activate && uvicorn app.main:app --port 8100 --reload

# Frontend (포트 5174)
cd frontend && npm run dev

# AI Worker
cd ai-worker && source .venv/bin/activate && celery -A app.celery_app worker --loglevel=info
```

### 마이그레이션
```bash
cd backend
alembic upgrade head              # 적용
alembic revision --autogenerate -m "desc"  # 생성
alembic downgrade -1              # 롤백
```

## 품질 도구

| 도구 | 영역 | 용도 |
|------|------|------|
| ruff | Backend | Linter + Formatter (E,F,W,I,N,UP,B,A,SIM) |
| pyrefly | Backend | 타입 체크 |
| ESLint | Frontend | Linter (react-hooks, react-refresh) |
| Prettier | Frontend | Formatter |
| Husky + lint-staged | Frontend | Pre-commit 자동 검사 |
| Vitest | Frontend | 단위/컴포넌트 테스트 |
| pytest + pytest-asyncio | Backend | 비동기 테스트 |
| Playwright MCP | E2E | 브라우저 기반 E2E 테스트 |

## 테스트

### Backend
```bash
cd backend && pytest  # asyncio_mode = "auto"
```

### Frontend
```bash
cd frontend && npx vitest run
```

### E2E (Playwright MCP)
사전 조건: Docker 인프라 + Backend (8100) + Frontend (5273) 실행 중.
시나리오: S01(회원가입/로그인) → S02(프로젝트 CRUD) → S03(DataStore/이미지) → S04(Task/라벨클래스) → S05(라벨링).

## 성능 최적화 (적용 완료)

- **가상화 스크롤** (D019): @tanstack/react-virtual — 10만 이미지도 부드러운 스크롤
- **배치 업로드** (D017): 20개씩 분할 순차 업로드 — 메모리 제어
- **해시 dedup**: SHA-256 동일 파일 감지 — 디스크 절감
- **스토리지 샤딩**: 2단계 디렉토리 분산 (65,536) — 파일시스템 성능
- **비동기 I/O**: asyncpg, aiofiles, httpx — 높은 동시성

## 로드맵 진행 상황

| Phase | 목표 | 상태 |
|-------|------|------|
| 1: MVP Foundation | 인프라 + 데이터 업로드/관리 | ✅ 완료 |
| 2: Data Curation | Task 기반 큐레이션 + UI 고도화 | ✅ 완료 |
| 3: Labeling | 라벨링 도구 (Classification + BBox MVP) | 🔄 MVP 완료, 잔여 항목 있음 |
| 4: Training | 모델 학습 파이프라인 | ⬜ 미시작 |
| 5: Pipeline | 파이프라인 오케스트레이션 | ⬜ 미시작 |
| 6: Production | 배포 인프라 + 모니터링 | ⬜ 미시작 |

### Phase 3 잔여 항목
- Polygon/Segmentation 도구
- AI 보조 라벨링 (사전 추론)
- 라벨링 통계 대시보드
- labeled_count 실시간 업데이트
