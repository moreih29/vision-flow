# Phase C: Backend Migration

## 목표
기존 Backend 코드를 마이그레이션하면서 기술 부채를 해소하고 품질을 높인다.

## 작업 순서 (의존성 기반)

### C-1. 핵심 인프라 (기반)
- [x] 설정 시스템 (config.py) — pydantic-settings 환경변수 기반
- [x] 데이터베이스 연결 (database.py) — 비동기 SQLAlchemy + asyncpg
- [x] 의존성 주입 (dependencies.py) — get_db, get_current_user, get_storage
- [ ] 공통 에러 핸들러 — 일관된 에러 응답 형식
- [ ] 구조화된 로깅 — structlog/loguru 도입
- [ ] 공통 페이지네이션 스키마

### C-2. 인증 시스템
- [x] User 모델 + 스키마
- [x] AuthService (bcrypt 해싱, JWT 생성/검증)
- [x] Auth 라우터 (POST /register, POST /login, GET /me)
- [ ] **개선**: 비밀번호 강도 검증 추가
- [ ] **개선**: Refresh Token 도입 고려 (현재 Access Token 7일은 보안 약점)
- [x] Auth 통합 테스트

### C-3. 프로젝트/데이터셋 관리
- [x] Project 모델 + 스키마 + 서비스 + 라우터
- [x] Dataset 모델 + 스키마 + 서비스 + 라우터
- [x] 소유권 검증 로직
- [ ] **개선**: 공통 CRUD 베이스 서비스 추출 (중복 코드 제거)
- [x] 프로젝트/데이터셋 단위 테스트 + 통합 테스트

### C-4. 스토리지 시스템
- [x] StorageBackend ABC
- [x] LocalStorage 구현 (해시 기반 샤딩)
- [x] 이미지 업로드 + 해시 중복 제거
- [x] 이미지 서빙 (FileResponse + JWT 쿼리 파라미터)
- [ ] **개선**: 썸네일 생성 파이프라인 (업로드 시 자동 생성)
- [ ] **개선**: 이미지 메타데이터 자동 추출 (EXIF, dimensions)
- [ ] 스토리지 단위 테스트

### C-5. 이미지/폴더 관리
- [x] Image 모델 + 스키마 + 서비스 + 라우터
- [x] FolderMeta 모델 + 서비스
- [x] 폴더 CRUD (생성, 이름 변경, 이동, 삭제)
- [x] 폴더 트리 조회
- [x] 배치 작업 (삭제, 이동)
- [ ] **개선**: 배치 작업 트랜잭션 안전성 강화
- [ ] 이미지/폴더 통합 테스트

### C-6. Subset 시스템
- [x] Subset 모델 + SubsetImage 조인 테이블
- [x] LabelClass 모델
- [x] TaskType ENUM
- [x] Subset 서비스 + 라우터
- [x] LabelClass 서비스 + 라우터
- [x] 이미지 멤버십 관리 (추가/제거)
- [ ] Subset 통합 테스트

### C-7. DB 마이그레이션
- [x] Alembic 마이그레이션 스크립트 재생성 (깔끔한 초기 마이그레이션)
- [x] **개선**: 단일 초기 마이그레이션 (5개를 1개로 통합)
- [ ] 마이그레이션 테스트 (up/down 확인)

## 기존 레포 대비 개선 목록

| 항목 | 기존 | 개선 |
|------|------|------|
| 에러 핸들링 | 서비스별 개별 HTTPException | 공통 에러 핸들러 + 일관된 응답 |
| 로깅 | 없음 | structlog/loguru 구조화 로깅 |
| 페이지네이션 | 부분 적용 | 공통 커서 기반 페이지네이션 |
| 테스트 | 없음 | pytest + httpx 통합 테스트 |
| 마이그레이션 | 5개 점진적 | 1개 깔끔한 초기 스키마 |
| CRUD 패턴 | 서비스마다 중복 | 베이스 서비스 추출 |
| 비밀번호 | 강도 검증 없음 | zxcvbn 또는 규칙 기반 검증 |
| 이미지 | 원본만 저장 | 썸네일 자동 생성 |

## 완료 기준
- [x] 모든 기존 API 엔드포인트가 동일하게 동작
- [ ] 통합 테스트 전체 통과
- [ ] 구조화된 로깅 동작 확인
- [ ] 에러 응답 형식 일관성 확인
