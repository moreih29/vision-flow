# Phase G: Quality & Testing

## 목표
기존 레포에 없었던 테스트 체계를 처음부터 구축하고,
코드 품질 도구를 설정하여 지속적인 품질 관리를 한다.

## 작업 항목

### G-1. Backend 테스트

#### 테스트 프레임워크
- [x] pytest + pytest-asyncio 설정
- [x] httpx AsyncClient (FastAPI TestClient 대체)
- [x] 테스트용 DB 설정 (테스트마다 격리된 DB)
- [x] 테스트 fixtures (사용자, 프로젝트, 데이터셋, 이미지 등)
- [ ] Factory 패턴 (테스트 데이터 생성)

#### 단위 테스트
- [ ] 서비스 레이어 테스트 (비즈니스 로직)
- [ ] 스토리지 테스트 (LocalStorage)
- [ ] 인증 유틸리티 테스트 (JWT, bcrypt)
- [ ] 유틸리티 함수 테스트

#### 통합 테스트
- [x] Auth API 테스트 (회원가입, 로그인, 인증 검증)
- [x] Projects API 테스트 (CRUD + 권한)
- [x] Datasets API 테스트 (CRUD + 프로젝트 소속)
- [ ] Images API 테스트 (업로드, 중복 제거, 폴더, 배치)
- [ ] Subsets API 테스트 (CRUD + 이미지 멤버십)
- [ ] Label Classes API 테스트 (CRUD + Subset 소속)

#### 커버리지 목표
- 서비스 레이어: 80% 이상
- API 엔드포인트: 100% (모든 경로 + 에러 케이스)
- 유틸리티: 90% 이상

### G-2. Frontend 테스트

#### 테스트 프레임워크
- [x] Vitest 설정 (Vite 통합)
- [x] React Testing Library
- [ ] MSW (Mock Service Worker) — API 모킹

#### 컴포넌트 테스트
- [ ] 인증 컴포넌트 (LoginPage, RegisterPage, ProtectedRoute)
- [ ] 프로젝트 관리 컴포넌트
- [ ] 이미지 관리 컴포넌트 (업로드, 다중 선택)
- [ ] Subset 관리 컴포넌트

#### 훅 테스트
- [x] useMultiSelect 테스트
- [ ] useConfirmDialog 테스트
- [ ] React Query 훅 테스트

#### E2E 테스트 (선택)
- [ ] Playwright 설정
- [ ] 핵심 사용자 흐름 테스트
  - 회원가입 → 로그인 → 프로젝트 생성
  - 이미지 업로드 → 폴더 관리
  - Subset 생성 → 이미지 추가 → 클래스 관리

### G-3. 코드 품질 도구

#### Backend
- [x] Ruff (린트 + 포맷) 설정
- [ ] mypy (타입 체크) 설정
- [ ] pre-commit 훅 설정

#### Frontend
- [ ] ESLint 설정 (TypeScript 규칙)
- [ ] Prettier 설정
- [ ] TypeScript strict 모드
- [ ] Husky + lint-staged 설정

### G-4. 품질 메트릭
- [ ] 테스트 커버리지 리포트 (pytest-cov, vitest coverage)
- [ ] 린트 경고 0개 유지
- [x] TypeScript 에러 0개 유지
- [ ] 번들 사이즈 모니터링 (Vite 빌드 리포트)

## 테스트 전략

### 테스트 피라미드

```
         /  E2E Tests  \        ← 적음, 느림, 핵심 흐름만
        / Integration   \       ← 중간, API 엔드포인트
       /  Unit Tests     \      ← 많음, 빠름, 로직 중심
      ──────────────────────
```

### 원칙
1. **실제 DB 사용**: 통합 테스트에서 실제 PostgreSQL 사용 (모킹 금지)
2. **격리**: 각 테스트는 독립적 (이전 테스트에 의존하지 않음)
3. **빠른 피드백**: 단위 테스트는 1초 이내, 전체 스위트는 30초 이내 목표
4. **의미 있는 테스트**: 커버리지 수치보다 핵심 비즈니스 로직 검증 우선

## 완료 기준
- [ ] Backend 통합 테스트 전체 통과
- [ ] Frontend 컴포넌트 테스트 전체 통과
- [ ] 린트/타입체크 에러 0개
- [ ] 테스트 커버리지 리포트 생성
- [ ] pre-commit 훅 동작 확인
