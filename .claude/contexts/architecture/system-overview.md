# System Architecture Overview

## Monorepo 구조

Vision Flow는 세 개의 독립 서비스로 구성된 모노레포 프로젝트이다.
서비스 간 공유 패키지는 없으며, 각 서비스는 독립적으로 빌드/배포된다.

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
  │
  │  HTTP (JWT Auth, /api/v1/*)
  ▼
Frontend (React, Vite Dev Server)
  │
  │  Proxy /api/* → localhost:8002
  ▼
Backend (FastAPI, uvicorn)
  ├── PostgreSQL (asyncpg) ─── 모든 CRUD
  ├── Local Filesystem ─────── 이미지 파일 저장 (hash-based)
  ├── Redis ─────────────────── Celery 브로커 (학습 작업 큐)
  │
  │  Celery Task Dispatch (비동기)
  ▼
AI Worker (Celery Consumer)
  ├── Redis (broker + result backend)
  ├── Local Filesystem (모델 가중치, 학습 데이터)
  └── GPU (YOLO 학습/추론)
```

## 핵심 설계 원칙

### 1. Backend가 유일한 API Gateway
- Frontend는 Backend를 통해서만 데이터에 접근한다.
- Frontend ↔ DB 직접 접근 금지.
- Frontend ↔ AI Worker 직접 통신 금지.
- 모든 인증, 권한 검증, 비즈니스 로직은 Backend에서 처리한다.

### 2. 비동기 AI 처리
- 학습은 수 시간~수 일이 걸릴 수 있으므로 Celery를 통한 비동기 처리가 필수.
- 브라우저를 닫아도 학습이 중단되지 않는다.
- 실시간 학습 진행 모니터링은 SSE(Server-Sent Events)로 설계되어 있다.

### 3. 스토리지 추상화
- `StorageBackend` ABC를 통해 파일 저장소를 추상화한다.
- 현재는 `LocalStorage` 구현만 존재하며, 향후 S3 호환 스토리지로 확장 가능하다.
- 컨텐츠 주소 기반 저장(SHA-256 해시)으로 중복 파일을 제거한다.

### 4. 서비스 독립성
- 각 서비스는 독립적인 의존성과 빌드 체인을 가진다.
- 공유 코드가 없으므로 한 서비스의 변경이 다른 서비스에 영향을 미치지 않는다.
- AI Worker는 잠재적으로 GPU 서버에 분리 배포될 수 있도록 설계되었다.

## 기술 스택 요약

| 계층 | 기술 |
|------|------|
| Frontend | React 19, TypeScript 5.9, Vite 8, Tailwind CSS 4, shadcn/ui, Zustand 5 |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2.0 (async), Alembic, python-jose (JWT) |
| AI Worker | Python 3.11+, Celery, Ultralytics (YOLO), Redis |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 |
| Dev Infra | Docker Compose |

## 포트 할당

| 서비스 | 포트 | 비고 |
|--------|------|------|
| Frontend (Vite) | 5174 | 개발 서버 |
| Backend (uvicorn) | 8002 | API 서버 |
| PostgreSQL | 5433 | 기본 포트(5432) 충돌 방지 |
| Redis | 6379 | 기본 포트 |
