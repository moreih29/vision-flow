# Architecture

Vision Flow는 3개의 독립 서비스로 구성된 모노레포다. 각 서비스는 명확한 책임 경계를 가지며, Postgres와 Redis를 공유 인프라로 사용한다.

## 서비스 토폴로지

```
┌──────────┐      ┌──────────┐      ┌──────────┐
│ frontend │ ───▶ │ backend  │ ◀──▶ │ Postgres │
│ (Vite)   │      │(FastAPI) │      │          │
└──────────┘      └──────────┘      └──────────┘
                       │
                       ▼
                  ┌──────────┐      ┌──────────┐
                  │  Redis   │ ◀─── │ ai-worker│
                  │ (broker) │      │ (Celery) │
                  └──────────┘      └──────────┘
```

- **frontend**: 브라우저 SPA. 백엔드와 REST/JSON으로만 통신한다. `vite.config.ts`가 dev 프록시(`/api` → `:8100`)를 담당하므로 코드에서는 상대 경로만 쓴다.
- **backend**: 단일 REST API 서버. 인증, 데이터 영속화, 비즈니스 로직, 파일 스토리지 게이트웨이를 모두 담당한다. `/api/v1` prefix가 고정.
- **ai-worker**: Celery 워커. 학습/추론 등 장기 작업을 별도 프로세스에서 수행한다. 현재는 태스크 스켈레톤만 존재하며 backend와의 연동 경로(태스크 전달, 결과 회신)는 아직 구현되어 있지 않다.

## 데이터 플로우

핵심 도메인 흐름:
1. **Project 생성** → 사용자 단위 최상위 네임스페이스
2. **Data Pool**로 이미지 업로드 → 프로젝트 공용 이미지 풀
3. **Task** 생성 (object_detection / classification / instance_segmentation / pose_estimation) → 데이터 풀에서 이미지를 선택해 라벨링 작업 정의
4. **Label Classes**를 Task에 정의 → 라벨링 스키마 확정
5. **Annotation** 작성 → 이미지별 bbox/polygon/keypoint/classification
6. **Snapshot** 생성 → 현재 상태를 불변 버전으로 동결 (자세한 건 versioning.md)
7. **학습/추론** → 스냅샷 기반으로 ai-worker에게 전달 (미구현 경로)

## Backend 계층 구조

backend는 **Router → Service → Model** 3층을 강제한다. Router는 HTTP 경계만 다루고, 비즈니스 로직은 모두 Service에 있으며, Service가 SQLAlchemy AsyncSession으로 DB를 조작한다. Router가 DB 세션을 직접 쿼리하는 패턴은 금지된다.

- **Router 계층** (`app/routers/`): APIRouter 정의, Depends로 DB 세션·인증 사용자 주입, Pydantic 스키마로 입출력 검증. 로직 없음.
- **Service 계층** (`app/services/`): 각 도메인별 단일 Service 클래스(싱글턴 인스턴스 export). 권한 검증(`check_ownership`)부터 시작해 DB 조작까지 일괄 책임.
- **Model 계층** (`app/models/`): SQLAlchemy Declarative. `Mapped` / `mapped_column` / `relationship`으로 선언. `app/database.py`의 Base를 상속.
- **Schema 계층** (`app/schemas/`): Pydantic v2 기반 요청/응답 DTO. Model과 분리되어 있다.
- **Storage 추상화** (`app/storage/`): `StorageBackend` 인터페이스 + `LocalStorage` 구현. 미래의 S3/GCS 전환을 염두에 둔 설계.

모든 DB 접근은 **async** (asyncpg + SQLAlchemy async session). Router 엔드포인트는 `async def`가 기본.

## 인증 및 권한

- **JWT Bearer** (HS256, 7일 만료). `python-jose` + `bcrypt`로 직접 구현 (OAuth2 서드파티 없음).
- 토큰은 frontend의 localStorage에 `auth_token` 키로 저장되며, axios 요청 인터셉터가 Authorization 헤더에 주입한다.
- 401 응답 시 frontend는 자동으로 로그아웃 처리 + 로그인 페이지로 리다이렉트.
- Backend Depends: `get_current_user` / `get_current_active_user` / `get_current_admin_user` 3종.
- 리소스 권한은 Service 레벨 `check_ownership` 패턴으로 검증한다 (user_id 비교).

## 에러 응답 포맷

`app/error_handler.py`가 공통 포맷을 강제한다:

```json
{"error": {"code": "NOT_FOUND", "message": "...", "details": [...]}}
```

Router에서는 `HTTPException(status_code, detail)` 또는 Pydantic `ValidationError`를 raise하면, 전역 핸들러가 위 포맷으로 감싼다. Frontend는 axios 인터셉터에서 이 포맷을 전제로 에러를 해석한다.

## Frontend 아키텍처

- **라우팅**: `react-router-dom` v7. 보호 라우트는 `ProtectedRoute` 컴포넌트로 감싼다.
- **서버 상태**: TanStack Query. 도메인별 훅(`use-projects`, `use-tasks`, `use-snapshots` 등)으로 캡슐화. staleTime/retry는 `lib/query-client.ts`에서 일괄 설정.
- **클라이언트 상태**: Zustand. 현재는 `auth-store` 하나만 존재 (user/token/isAuthenticated).
- **폼**: react-hook-form + zod (런타임 검증과 타입이 일치).
- **UI**: shadcn/ui (base-nova 스타일, lucide 아이콘). 모든 UI 프리미티브는 `components/ui/`에 생성하고 CVA로 variant를 정의한다.
- **캔버스 라벨링**: react-konva. `components/labeling/`에 캔버스, 오버레이, 도구(BBox draw/select)가 분리되어 있다. 좌표 변환 로직은 `hooks/use-canvas-transform.ts` 같은 전용 훅으로 추출.
- **가상화**: 대량 이미지 리스트는 `@tanstack/react-virtual` 사용.

### 명령형 UI 금지 규약

`window.confirm` / `window.alert` / `window.prompt`는 사용하지 않는다. 확인 다이얼로그가 필요하면 `hooks/useConfirmDialog.tsx` 같은 공용 훅 + shadcn Dialog 조합으로 대체한다. 이는 Tailwind/다크모드 테마 일관성과 접근성을 위해 강제된다.

## AI Worker

`ai-worker`는 backend와는 완전히 독립된 파이썬 프로젝트 (별도 venv, 별도 pyproject.toml). Celery 앱 이름은 `vision_flow_worker`이고, 소스 모듈은 `app.celery_app`에 정의되어 있다. 태스크는 `app.tasks.training.train_model` 하나만 선언되어 있으며 내용은 `NotImplementedError`를 raise한다. YOLOService (`app/services/yolo.py`)도 동일하게 스켈레톤만 존재한다.

Backend와의 연동 경로(태스크 enqueue, 결과 회신, 진행률 스트리밍)는 현재 없다. 기능 구현 시 다음을 결정해야 한다:
- 태스크 enqueue 주체 (backend에서 celery send_task? 공유 브로커 URL은 어떻게 설정?)
- 결과 회신 (Celery 결과 백엔드 polling? backend 엔드포인트 콜백? DB 직접 쓰기?)
- 모델 가중치/데이터셋 스토리지 공유 (로컬 볼륨 vs 공유 객체 스토리지)

## 공유 인프라

`docker/docker-compose.dev.yml`이 **PostgreSQL 16** (호스트 포트 5433 → 컨테이너 5432)과 **Redis 7** (6379)을 띄운다. Backend와 ai-worker는 같은 Redis 인스턴스를 bare-metal로 각각 참조한다 (dev 기본 DB 0: broker, DB 1: result backend). Production compose(`docker-compose.prod.yml`)는 Nginx + 3개 앱 서비스 + DB/Redis가 모두 한 네트워크에 들어간다.

## 관측/운영 상태

- **CI/CD 없음** (`.github/workflows/` 부재).
- **구조화 로깅**: `app/logging_config.py`의 `setup_logging()` 호출이 전부. 외부 APM/트레이싱 연동 없음.
- **헬스체크**: `GET /health` (backend), `GET /health` (ai-worker FastAPI — Celery와는 별개로 떠있음). Docker compose가 이를 활용한다.
- **테스트**:
  - backend: `pytest` + `pytest-asyncio` (auto mode), conftest가 `vision_flow_test` DB를 테스트마다 생성/삭제.
  - frontend: `vitest` + `@testing-library/react`, jsdom 환경.
