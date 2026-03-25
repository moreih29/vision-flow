<!-- tags: backend, fastapi, sqlalchemy, api, models, services -->
<!-- tags: backend, fastapi, sqlalchemy, api, models, services -->

# Backend

## 계층 구조

```
Router → Service → Model (SQLAlchemy)
```

**규칙**: Router에서 직접 DB 접근 금지. 반드시 Service 계층을 통해 처리.

## 디렉토리

```
backend/app/
├── main.py            # FastAPI 앱, 라우터 등록, CORS, lifespan
├── config.py          # pydantic-settings 기반 환경 설정 (.env)
├── routers/           # API 엔드포인트 (Router 계층)
├── services/          # 비즈니스 로직 (Service 계층)
├── models/            # SQLAlchemy ORM 모델
├── schemas/           # Pydantic 요청/응답 스키마
└── storage/           # 파일 저장 추상화 (StorageBackend → LocalStorage)
```

## 도메인 모델

| 모델 | 역할 |
|------|------|
| User | 사용자 계정, 인증 |
| Project | 프로젝트 (최상위 컨테이너) |
| DataStore | 프로젝트별 데이터 저장소 |
| Image | 업로드 이미지 (hash 기반 중복 관리) |
| FolderMeta | 데이터풀 폴더 메타데이터 |
| Task | 라벨링 태스크 |
| TaskImage | 태스크에 할당된 이미지 (M:N 관계) |
| TaskFolderMeta | 태스크 폴더 메타데이터 |
| TaskSnapshot / TaskSnapshotItem | 태스크 버전 스냅샷 (시맨틱 버전) |
| LabelClass | 라벨 클래스 정의 |
| Annotation | 이미지별 어노테이션 (바운딩 박스 등) |

## API 라우트

모든 라우트는 `/api/v1` 프리픽스 사용.

| 라우터 | 주요 기능 |
|--------|-----------|
| auth | 회원가입, 로그인, JWT 발급 |
| projects | 프로젝트 CRUD |
| data_stores | 데이터 저장소 관리 |
| images | 이미지 업로드, 조회, 폴더별 목록 |
| tasks | 태스크 CRUD, 이미지 할당, 폴더 관리 |
| label_classes | 라벨 클래스 CRUD |
| annotations | 어노테이션 저장/조회 |
| snapshots | 태스크 스냅샷 생성/조회 |

## 주요 설정 (환경변수)

| 키 | 기본값 | 설명 |
|----|--------|------|
| DATABASE_URL | `postgresql+asyncpg://...localhost:5433/vision_flow` | DB 연결 |
| REDIS_URL | `redis://localhost:6379/0` | Redis |
| JWT_SECRET_KEY | (필수) | JWT 서명 키 |
| STORAGE_BASE_PATH | `./data/storage` | 파일 저장 경로 |
| CORS_ORIGINS | `http://localhost:5273` | 허용 오리진 |

## 도구

- **린터**: ruff (line-length=120, target py311)
- **타입체크**: pyrefly
- **테스트**: pytest + pytest-asyncio (asyncio_mode=auto)
- **마이그레이션**: Alembic
