# Backend Architecture

## 기술 스택

- **Python 3.11+**: 런타임
- **FastAPI**: 웹 프레임워크 (비동기, 자동 OpenAPI 문서)
- **SQLAlchemy 2.0** (async mode) + **asyncpg**: ORM + PostgreSQL 드라이버
- **Alembic**: 데이터베이스 마이그레이션
- **python-jose**: JWT 토큰 생성/검증
- **bcrypt**: 비밀번호 해싱
- **Redis**: 캐시 및 Celery 브로커
- **httpx**: 비동기 HTTP 클라이언트 (AI Worker 통신용)
- **aiofiles**: 비동기 파일 I/O
- **pydantic-settings**: 환경변수 기반 설정

## 디렉토리 구조

```
backend/
├── app/
│   ├── config.py           # pydantic-settings 설정 (환경변수)
│   ├── database.py         # 비동기 엔진 + 세션 팩토리 + Base
│   ├── dependencies.py     # FastAPI DI (인증, DB, 스토리지)
│   ├── main.py             # FastAPI 앱 + CORS + 라우터 등록
│   ├── models/             # SQLAlchemy ORM 모델 (8개)
│   │   ├── user.py, project.py, data_store.py, image.py
│   │   ├── task.py, task_image.py, label_class.py
│   │   ├── folder_meta.py, enums.py
│   │   └── __init__.py     # 모델 barrel export
│   ├── schemas/            # Pydantic 요청/응답 DTO
│   │   ├── user.py, project.py, data_store.py, image.py
│   │   ├── task.py, task_image.py, label_class.py
│   ├── routers/            # FastAPI 라우트 핸들러 (7개)
│   │   ├── auth.py, projects.py, data_stores.py, images.py
│   │   ├── tasks.py, label_classes.py, folders (images.py 내 포함)
│   ├── services/           # 비즈니스 로직 레이어 (7개)
│   │   ├── auth.py, project.py, data_store.py, image.py
│   │   ├── task.py, label_class.py
│   └── storage/            # 파일 저장소 추상화
│       ├── base.py         # StorageBackend ABC
│       └── local.py        # LocalStorage 구현
├── alembic/                # 마이그레이션 스크립트
│   ├── env.py              # 비동기 마이그레이션 러너
│   └── versions/           # 마이그레이션 파일 (001~005)
├── alembic.ini
├── pyproject.toml
└── .env
```

## 계층형 아키텍처

```
Router (라우트 핸들러)
  │  요청 검증, 응답 직렬화
  ▼
Service (비즈니스 로직)
  │  도메인 규칙, 트랜잭션 관리
  ▼
Model (ORM 엔티티)
  │  데이터 접근, 관계 정의
  ▼
Database (PostgreSQL)
```

### 원칙
- **Router에서 직접 DB 접근 금지**: 반드시 Service를 통해서만 데이터 조작
- **Service는 싱글톤 인스턴스**: `auth_service = AuthService()` 형태로 모듈 레벨에서 생성
- **Repository 레이어 없음**: Service가 SQLAlchemy를 직접 사용 (현재 규모에서는 적절함)

## 의존성 주입 (FastAPI Depends)

```python
# dependencies.py
get_db()           → AsyncSession (DB 세션)
get_current_user() → User (JWT 토큰 검증 → 사용자 조회)
get_storage()      → StorageBackend (현재 LocalStorage)
```

## 인증 흐름

1. `POST /auth/register` → 비밀번호 bcrypt 해싱 → User 생성
2. `POST /auth/login` → 이메일/비밀번호 검증 → JWT 토큰 발급 (HS256, 7일 만료)
3. 요청마다 `Authorization: Bearer <token>` 헤더에서 JWT 디코딩
4. 토큰의 `sub` 필드(이메일)로 사용자 조회
5. 이미지 파일 다운로드: `?token=` 쿼리 파라미터 지원 (`<img src>` 호환)

## API 엔드포인트 (모두 `/api/v1` 하위)

| 라우터 | 주요 엔드포인트 |
|--------|----------------|
| auth | `POST /register`, `POST /login`, `GET /me` |
| projects | `CRUD /projects` |
| data-stores | `CRUD /projects/{id}/data-stores` |
| images | 업로드, 조회, 파일 다운로드, 배치 삭제/이동 (`/data-stores/{id}/images`) |
| folders | 트리 조회, 생성, 삭제, 이름변경, 배치 삭제/이동 (`/data-stores/{id}/folders`) |
| tasks | `CRUD /projects/{id}/tasks` + 이미지 멤버십 관리 |
| label_classes | `CRUD /tasks/{id}/classes` |

## 스토리지 추상화

```python
class StorageBackend(ABC):
    async def save(key: str, data: bytes) -> str
    async def load(key: str) -> bytes
    async def delete(key: str) -> None
    async def exists(key: str) -> bool
```

- `LocalStorage`: 로컬 파일시스템에 해시 기반 샤딩으로 저장
- 경로 형식: `{hash[:2]}/{hash[2:4]}/{full_hash}.{ext}`
- 향후 `S3Storage` 구현으로 확장 가능

## 설계 개선 포인트

1. **에러 핸들링 표준화**: 현재 각 서비스에서 개별적으로 HTTPException을 발생시킴. 공통 에러 핸들러 도입 고려.
2. **페이지네이션 표준화**: 일부 엔드포인트에만 페이지네이션 적용. 공통 페이지네이션 스키마 도입 고려.
3. **테스트 부재**: 유닛 테스트, 통합 테스트가 없음. 테스트 프레임워크(pytest + httpx) 도입 필요.
4. **로깅**: 체계적인 로깅 시스템 미구축. structlog 등 도입 고려.
