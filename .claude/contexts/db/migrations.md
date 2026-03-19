# Database Migrations

## 마이그레이션 도구

**Alembic** (비동기 모드, asyncpg 드라이버)

## 마이그레이션 히스토리

| 버전 | 이름 | 내용 |
|------|------|------|
| 001 | create_users_table | users 테이블 생성 |
| 002 | create_projects_datasets_images | projects, datasets, images 테이블 생성 |
| 003 | add_image_folder_path | images 테이블에 folder_path 컬럼 추가 |
| 004 | remove_storage_key_unique | images.storage_key의 UNIQUE 제약조건 제거 (해시 중복 제거 허용) |
| 005 | create_subsets_and_classes | subsets, subset_images, label_classes, folder_meta 테이블 생성 |
| 006 | dataset_to_datastore_rename | Dataset→DataStore, Subset→Task 리네이밍 + task status 컬럼 |
| 007 | add_annotations_table | annotations 테이블 생성 (JSONB data, FK task_images + label_classes) |

## 마이그레이션 실행

```bash
cd backend
# 마이그레이션 적용
alembic upgrade head

# 새 마이그레이션 생성
alembic revision --autogenerate -m "description"

# 현재 버전 확인
alembic current

# 한 단계 롤백
alembic downgrade -1
```

## 마이그레이션 설계 원칙

### 1. 순방향 호환성 우선
- 새 컬럼 추가 시 기본값을 설정하거나 NULLABLE로 선언
- 기존 데이터가 깨지지 않도록 주의

### 2. 스키마 변경의 이유 기록
- 004번 마이그레이션처럼, 제약조건 변경의 이유를 명확히 문서화
- `storage_key` UNIQUE 제거: 해시 기반 중복 제거로 여러 이미지 레코드가 동일한 물리 파일을 참조해야 함

### 3. Autogenerate 활용
- SQLAlchemy 모델 변경 → `alembic revision --autogenerate`로 마이그레이션 자동 생성
- 자동 생성된 코드를 반드시 검토 후 적용

## 주의사항

- 마이그레이션은 비동기(`run_async`)로 실행됨 (`alembic/env.py` 참조)
- PostgreSQL 16의 UUID 생성은 `uuid_generate_v4()` 또는 Python 측 `uuid.uuid4()` 사용
- ENUM 타입(TaskType)은 PostgreSQL의 native ENUM으로 생성됨 — 값 추가는 가능하나 삭제/변경은 어려움
