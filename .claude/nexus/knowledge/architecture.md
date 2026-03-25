<!-- tags: architecture, system, services, data-flow, overview -->
<!-- tags: architecture, system, overview, services, data-flow -->

# 시스템 아키텍처

## 서비스 구성

```
┌─────────────┐    /api/v1     ┌─────────────┐     async     ┌─────────────┐
│  Frontend   │ ──(proxy)────▶ │   Backend   │ ──(asyncpg)─▶ │ PostgreSQL  │
│  Vite:5273  │                │ FastAPI:8100│               │   16:5433   │
└─────────────┘                └──────┬──────┘               └─────────────┘
                                      │
                                      │ Celery task
                                      ▼
                               ┌─────────────┐     broker    ┌─────────────┐
                               │  AI Worker  │ ◀──(redis)──▶ │   Redis 7   │
                               │   Celery    │               │   :6379     │
                               └─────────────┘               └─────────────┘
```

| 서비스 | 기술 스택 | 역할 |
|--------|-----------|------|
| Frontend | React 19, TypeScript, Vite 8, Tailwind 4, shadcn/ui | SPA, 라벨링 캔버스 |
| Backend | Python 3.11+, FastAPI, SQLAlchemy 2 (async), Alembic | REST API, 비즈니스 로직 |
| AI Worker | Python 3.11+, Celery, Ultralytics (YOLO) | 모델 학습/추론 |
| PostgreSQL 16 | asyncpg 드라이버 | 주 데이터베이스 |
| Redis 7 | — | Celery broker/backend |

## 데이터 흐름

1. **이미지 업로드**: Frontend → Backend `/api/v1/images/upload` → LocalStorage(`./data/storage/`)에 파일 저장 + DB 레코드
2. **폴더 탐색**: Frontend FileTreeView → Backend folder/image API → 페이지네이션(skip/limit) 응답
3. **라벨링**: LabelingCanvas(Konva) → Backend annotation API → DB 저장
4. **학습**: Backend → Celery task 발행 → AI Worker가 YOLO 학습 수행 → 결과 반환

## 스토리지

- **파일 저장**: `StorageBackend` 추상 클래스 → 현재 `LocalStorage` 구현 (로컬 파일시스템)
- **저장 경로**: `backend/data/storage/` (설정: `STORAGE_BASE_PATH`)
- **확장 설계**: S3 등 오브젝트 스토리지 백엔드 추가 가능 (추상 인터페이스 준비됨)

## 인증

- JWT 기반 (HS256), `Authorization: Bearer` 헤더
- 토큰 만료: 7일 (설정 가능)
- 401 응답 시 프론트엔드 자동 로그아웃 + 리다이렉트
