<!-- tags: conventions, backend, frontend, commit, branch -->
# Development Conventions

## Backend
- Router에서 직접 DB 접근 금지. 반드시 Service 계층 경유
- 새 테이블/컬럼 변경 시 Alembic 마이그레이션 필수
- Pydantic schema로 요청/응답 검증. 라우터에서 dict 직접 반환 금지
- 에러 처리는 HTTPException 또는 error_handler 활용

## Frontend
- shadcn/ui 컴포넌트 우선. 브라우저 기본 UI (alert, confirm, prompt) 사용 금지
- 서버 상태는 React Query, 클라이언트 상태는 Zustand
- API 함수는 src/api/ 하위에 모듈별로 분리
- 컴포넌트 파일명: kebab-case.tsx

## 공통
- 커밋 메시지: 영어, conventional commits (feat:, fix:, refactor:, docs:, chore:)
- 문서/주석/UI 텍스트: 한국어
- 브랜치: feat/*, fix/* → main 머지