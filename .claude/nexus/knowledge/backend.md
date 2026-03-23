<!-- tags: backend, fastapi, sqlalchemy, database, schema, migrations, storage, api -->
# Backend Architecture

## 디렉토리 구조

```
backend/
├── app/
│   ├── config.py           # pydantic-settings (환경변수)
│   ├── database.py         # 비동기 엔진 + 세션 팩토리 + Base
│   ├── dependencies.py     # FastAPI DI (인증, DB, 스토리지)
│   ├── main.py             # FastAPI 앱 + CORS + 라우터 등록 + 에러 핸들러
│   ├── error_handler.py    # 공통 에러 핸들러 (표준 JSON 응답)
│   ├── logging_config.py   # 구조화된 JSON 로깅
│   ├── models/             # SQLAlchemy ORM (user, project, data_store, image, task, task_image, label_class, folder_meta, enums)
│   ├── schemas/            # Pydantic 요청/응답 DTO + pagination.py
│   ├── routers/            # FastAPI 라우트 (auth, projects, data_stores, images, tasks, label_classes)
│   ├── services/           # 비즈니스 로직 (auth, project, data_store, image, task, label_class)
│   └── storage/            # StorageBackend ABC + LocalStorage
├── alembic/                # 마이그레이션 (비동기, versions/ 001~007)
├── pyproject.toml
└── .env
```

## 계층형 아키텍처

```
Router (요청 검증, 응답 직렬화)
  → Service (도메인 규칙, 트랜잭션)
    → Model (ORM, 관계 정의)
      → Database (PostgreSQL)
```

- **Router에서 직접 DB 접근 금지** — 반드시 Service를 통해서만
- Service는 모듈 레벨 싱글톤: `auth_service = AuthService()`
- Repository 레이어 없음 (현재 규모에 적절)

## 의존성 주입

```python
get_db()           → AsyncSession
get_current_user() → User (JWT 검증)
get_storage()      → StorageBackend (LocalStorage)
```

## DB 스키마 (PostgreSQL 16)

```
users ──1:N──▶ projects ──1:N──▶ data_stores ──1:N──▶ images
                  │                                      ▲
                  │ 1:N                            M:N   │
                  ▼                                      │
                tasks ──1:N──▶ label_classes    task_images
                                            folder_meta (DataStore 1:N)
```

### 주요 테이블

| 테이블 | PK | 핵심 컬럼 |
|--------|-----|----------|
| users | UUID | email (UNIQUE), hashed_password, is_admin |
| projects | UUID | name, owner_id (FK users) |
| data_stores | UUID | name, project_id (FK projects) |
| images | UUID | original_filename, storage_key, file_hash (IDX), folder_path (IDX), data_store_id |
| tasks | UUID | name, task_type (ENUM), status, project_id |
| task_images | UUID | task_id (FK), image_id (FK) — M:N 조인 |
| label_classes | UUID | name, color, task_id (FK) |
| annotations | UUID | data (JSONB), task_image_id (FK), label_class_id (FK) |
| folder_meta | UUID | path, data_store_id (FK) |

### 마이그레이션 히스토리

| 버전 | 내용 |
|------|------|
| 001 | users 테이블 |
| 002 | projects, datasets, images |
| 003 | images.folder_path 추가 |
| 004 | images.storage_key UNIQUE 제거 (해시 dedup) |
| 005 | subsets, subset_images, label_classes, folder_meta |
| 006 | Dataset→DataStore, Subset→Task 리네이밍 + task status |
| 007 | annotations 테이블 (JSONB data) |

## 파일 스토리지 (CAS)

- SHA-256 해시 기반 Content-Addressable Storage
- 경로: `{base}/{hash[0:2]}/{hash[2:4]}/{full_hash}.{ext}` (2단계 샤딩, 65,536 디렉토리)
- 동일 해시 → 물리 파일 1회 저장, DB 레코드만 추가 (dedup)
- `StorageBackend` ABC: `save()`, `load()`, `delete()`, `exists()`
