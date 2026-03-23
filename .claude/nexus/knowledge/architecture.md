<!-- tags: architecture, system, tech-stack, services, communication -->
# System Architecture

## 모노레포 구조

세 개의 독립 서비스로 구성. 서비스 간 공유 패키지 없음, 각각 독립 빌드/배포.

```
vision-flow/
├── frontend/       # React SPA (UI)
├── backend/        # FastAPI (API Gateway + Business Logic)
├── ai-worker/      # Celery Worker (AI Training/Inference)
└── docker/         # 개발 인프라 (PostgreSQL, Redis)
```

## 서비스 간 통신 흐름

```
Browser
  │  HTTP (JWT Auth, /api/v1/*)
  ▼
Frontend (React 19, Vite 8)
  │  Proxy /api/* → localhost:8002
  ▼
Backend (FastAPI, uvicorn)
  ├── PostgreSQL (asyncpg) ─── 모든 CRUD
  ├── Local Filesystem ─────── 이미지 파일 (hash-based CAS)
  ├── Redis ─────────────────── Celery 브로커
  │
  │  Celery Task Dispatch (비동기)
  ▼
AI Worker (Celery Consumer)
  ├── Redis (broker + result backend)
  ├── Local Filesystem (모델 가중치, 학습 데이터)
  └── GPU (YOLO 학습/추론)
```

## 기술 스택

| 계층 | 기술 |
|------|------|
| Frontend | React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, shadcn/ui (radix-nova/slate), Zustand 5, React Query, react-konva, Axios |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic, asyncpg, python-jose (JWT), bcrypt, aiofiles |
| AI Worker | Python 3.11+, Celery, Ultralytics (YOLO), Redis |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Dev Infra | Docker Compose |

## 포트 할당

| 서비스 | 포트 | 비고 |
|--------|------|------|
| Frontend (Vite) | 5174 | 개발 서버 |
| Backend (uvicorn) | 8002 | API 서버 |
| PostgreSQL | 5433 | 기본 포트 충돌 방지 |
| Redis | 6379 | 기본 포트 |

## 핵심 설계 원칙

1. **Backend = 유일한 API Gateway**: Frontend↔DB/AI Worker 직접 접근 금지. 모든 인증·권한·비즈니스 로직은 Backend에서 처리.
2. **비동기 AI 처리**: Celery를 통한 비동기 학습. 브라우저 닫아도 학습 중단 안됨. SSE로 실시간 모니터링 (D004).
3. **스토리지 추상화**: `StorageBackend` ABC → 현재 `LocalStorage` (D001: MinIO가 GPU와 리소스 경쟁하므로 로컬 우선), 향후 S3 확장 가능. SHA-256 해시 기반 CAS로 중복 제거.
4. **서비스 독립성**: 공유 코드 없음. AI Worker는 GPU 서버 분리 배포 가능.
5. **Docker Compose는 인프라만** (D002): DB+Redis만 Docker, 앱은 호스트 실행 (HMR/핫리로드). 프로덕션은 별도 Dockerfile.
