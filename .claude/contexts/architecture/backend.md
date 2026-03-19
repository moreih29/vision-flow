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
│   ├── main.py             # FastAPI 앱 + CORS + 라우터 등록 + 에러 핸들러 + 로깅
│   ├── error_handler.py    # 공통 에러 핸들러 (표준 JSON 응답)
│   ├── logging_config.py   # 구조화된 JSON 로깅 (Python 표준 logging)
│   ├── models/             # SQLAlchemy ORM 모델 (8개)
│   │   ├── user.py, project.py, data_store.py, image.py
│   │   ├── task.py, task_image.py, label_class.py
│   │   ├── folder_meta.py, enums.py
│   │   └── __init__.py     # 모델 barrel export
│   ├── schemas/            # Pydantic 요청/응답 DTO
│   │   ├── user.py, project.py, data_store.py, image.py
│   │   ├── task.py, task_image.py, label_class.py
│   │   └── pagination.py   # 공통 페이지네이션 (PaginatedResponse[T])
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

## 보안

- **JWT 시크릿**: `.env`에 `JWT_SECRET_KEY` 필수 (기본값 없음, 미설정 시 서버 시작 실패)
- **소유권 검증**: 전 엔드포인트에서 `check_ownership` 호출 (IDOR 방지)
- **CORS**: `CORS_ORIGINS` 환경변수로 허용 origin 제한 (기본값 `http://localhost:5273`)
- **입력 검증**: 전 스키마에 `min_length`/`max_length` Field 제약 적용
- **비밀번호 강도**: 8자 이상, 대소문자/숫자/특수문자 각 1개 이상 (`@field_validator`)

## 에러 핸들링

- `error_handler.py`에서 3종 예외 일괄 처리:
  - `HTTPException` → `{"error": {"code": "NOT_FOUND", "message": "...", "details": []}}`
  - `RequestValidationError` → 필드별 `field`/`message`/`type` 상세
  - `Exception` → 500 일반 메시지 (스택트레이스는 로그에만)

## 로깅

- `logging_config.py`: Python 표준 logging + JSON 포맷
- 환경변수 `LOG_LEVEL`로 레벨 제어 (기본 INFO)
- uvicorn 로거도 동일 JSON 포매터 적용

## 성능 최적화

- `list_projects`, `list_tasks`: JOIN + GROUP BY 단일 쿼리 (N+1 해결)
- `remove_images`: bulk DELETE 문 (루프 삭제 제거)
- 생성 직후 count 쿼리 생략 (0 직접 설정)
- 응답 빌드 헬퍼 함수로 라우터 코드 중복 제거

## 설계 개선 포인트

1. ~~에러 핸들링 표준화~~ → 완료 (공통 에러 핸들러 도입)
2. ~~페이지네이션 표준화~~ → 완료 (PaginatedResponse[T] 제네릭 스키마)
3. **테스트 부재**: 유닛 테스트, 통합 테스트가 부족. 테스트 프레임워크(pytest + httpx) 확충 필요.
4. ~~로깅~~ → 완료 (JSON 구조화 로깅)
