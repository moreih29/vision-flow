# Phase B: Project Initialization

## 목표
모노레포 구조를 초기화하고, 각 서비스의 기본 골격을 세팅한다.
기존 레포의 구조를 따르되, 개선점을 반영한다.

## 작업 항목

### B-1. 모노레포 루트 설정
- [x] `.gitignore` 작성 (기존 기반 + 추가 항목)
- [x] `CLAUDE.md` 작성 (프로젝트 규칙, 컨벤션, context 시스템 참조)
- [-] 루트 `package.json` (워크스페이스 관리, 선택적)
- [-] EditorConfig / Prettier 설정 (코드 스타일 통일)

### B-2. Frontend 프로젝트 초기화
- [x] Vite + React + TypeScript 프로젝트 생성
- [x] Tailwind CSS 4 설정
- [x] shadcn/ui 설정 (radix-nova, slate)
- [x] 경로 별칭 (`@/`) 설정
- [-] ESLint + Prettier 설정
- [x] 디렉토리 구조 생성 (api/, components/, hooks/, pages/, stores/, types/, lib/)

### B-3. Backend 프로젝트 초기화
- [x] Python 프로젝트 구조 (pyproject.toml)
- [x] FastAPI 앱 스캐폴딩 (main.py, config.py, database.py)
- [x] 디렉토리 구조 생성 (models/, schemas/, routers/, services/, storage/)
- [x] Alembic 초기화
- [x] 의존성 정의 (FastAPI, SQLAlchemy, asyncpg, python-jose, bcrypt 등)
- [x] .env.example 작성

### B-4. AI Worker 프로젝트 초기화
- [x] Python 프로젝트 구조 (pyproject.toml)
- [x] Celery 앱 스캐폴딩
- [x] FastAPI 앱 스캐폴딩 (헬스체크)
- [x] 디렉토리 구조 생성 (tasks/, services/, schemas/)

### B-5. Docker 인프라
- [x] `docker/docker-compose.dev.yml` 작성 (PostgreSQL 16 + Redis 7)
- [x] `.env.example` 작성
- [x] 헬스체크 설정

## 기존 레포 대비 개선사항

### 구조적 개선
1. **루트 레벨 lint/format**: 전체 프로젝트에 일관된 코드 스타일 적용
2. **Git hooks**: pre-commit으로 린트/포맷 자동 실행 (husky 또는 pre-commit)
3. **공통 스크립트**: 프로젝트 루트에서 전체 서비스 일괄 시작/중지 스크립트

### Backend 개선
1. **구조화된 로깅**: structlog 또는 loguru 도입
2. **공통 에러 핸들러**: exception_handler로 일관된 에러 응답
3. **공통 페이지네이션**: 커서 기반 페이지네이션 스키마 표준화
4. **설정 검증**: pydantic-settings로 필수 환경변수 검증 강화

### Frontend 개선
1. **React Query**: 서버 데이터 캐싱, 중복 요청 제거
2. **공통 레이아웃**: 헤더/사이드바 레이아웃 컴포넌트
3. **에러 바운더리**: 전역 에러 처리

## 완료 기준
- [x] 각 서비스가 독립적으로 시작 가능 (빈 페이지/헬스체크 응답)
- [x] Docker Compose로 인프라 서비스 실행 확인
- [x] Alembic 초기 마이그레이션 실행 확인
- [-] 린트/포맷 자동 실행 확인
