# 테스트 & 품질 도구

**Status**: Not Started
**Depends on**: 01-backend-quality, 02-frontend-refactor (일부)

## Tasks

### Backend 추가 테스트
- [ ] Images API 테스트 (업로드, 중복 제거, 폴더, 배치)
- [ ] Tasks API 테스트 (CRUD + 이미지 멤버십)
- [ ] Label Classes API 테스트 (CRUD + Task 소속)
- [ ] 서비스 레이어 단위 테스트
- [ ] 스토리지 단위 테스트 (LocalStorage)

### Frontend 추가 테스트
- [ ] MSW (Mock Service Worker) 도입 — API 모킹
- [ ] useConfirmDialog 테스트
- [ ] 인증 컴포넌트 테스트 (LoginPage, RegisterPage)
- [ ] 프로젝트 관리 컴포넌트 테스트

### E2E 테스트 (선택)
- [ ] Playwright 설정
- [ ] 핵심 사용자 흐름 (회원가입 → 로그인 → 프로젝트 → 업로드 → Task)

### 품질 도구
- [ ] mypy 설정 (Backend 타입 체크)
- [ ] pre-commit 훅 설정 (ruff + mypy)
- [ ] Husky + lint-staged 설정 (Frontend)
- [ ] ESLint + Prettier 통합

### 품질 메트릭
- [ ] 테스트 커버리지 리포트 (pytest-cov, vitest coverage)
- [ ] 번들 사이즈 모니터링 (Vite 빌드 리포트)

## Done When
- Backend 통합 테스트 전체 통과
- Frontend 컴포넌트 테스트 주요 경로 커버
- pre-commit 훅 동작 확인
