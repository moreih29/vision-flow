<!-- tags: backend, fastapi, routers, services, models, auth -->
# Backend Structure

## 진입점
- `app/main.py` — FastAPI 앱, CORS, 라우터 등록, health check (`GET /health`)
- `app/config.py` — Pydantic BaseSettings, .env 로드

## 계층 구조: Router → Service → Model

### Routers (`app/routers/`, 8개)
모두 `/api/v1` prefix, Depends()로 DB/인증 주입
- auth.py (44L) — register, login, me
- projects.py (80L) — 프로젝트 CRUD
- data_stores.py (90L) — 데이터 스토어
- tasks.py (248L) — 태스크, 이미지 관리, 폴더 연산
- images.py (292L) — 이미지 업로드/조회/썸네일
- label_classes.py (74L) — 라벨 클래스
- annotations.py (104L) — 어노테이션
- snapshots.py (230L) — 스냅샷

### Services (`app/services/`, 8개)
비즈니스 로직 계층
- auth.py — 패스워드 해싱, JWT 생성/검증
- image.py (25KB) — 업로드, 리사이즈, 해시, 썸네일, 폴더 관리
- task.py (18KB) — 태스크 로직, 폴더 연산, 스냅샷
- snapshot.py (21KB) — 스냅샷 생성/diff
- project.py, data_store.py, annotation.py, label_class.py

### Models (`app/models/`, 14개)
SQLAlchemy DeclarativeBase, async
- User, Project, DataStore, Image, FolderMeta
- Task, TaskImage, TaskFolderMeta, TaskSnapshot, TaskSnapshotItem
- LabelClass, Annotation
- Enums: TaskType, TaskStatus, AnnotationType
- 전체 cascade delete 설정

### Schemas (`app/schemas/`, 10개)
Pydantic v2 요청/응답 모델

## 인증
- OAuth2 Password Bearer + JWT (HS256, 7일 만료)
- `get_current_user()` 의존성으로 보호
- `get_current_admin_user()` 관리자 전용

## 스토리지
- `app/storage/base.py` — StorageBackend 추상 클래스
- `app/storage/local.py` — 로컬 파일시스템 (`./data/storage/`)
- `get_storage()` 의존성 주입

## DB
- AsyncPG + async_sessionmaker
- Alembic 마이그레이션 (6 versions)