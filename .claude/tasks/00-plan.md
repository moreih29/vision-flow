# Vision Flow — 프로젝트 나침반

## 핵심 가치
웹 기반 Vision AI 모델 학습/추론 파이프라인 관리 서비스.
파이프라인 오케스트레이션 + 데이터 피드백 루프가 핵심 차별점.

## Phase 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| 1. MVP Foundation | 인증, 프로젝트/데이터셋 CRUD, 이미지 업로드, 폴더 관리 | **완료** |
| 2. Data Curation | Subset, 라벨 클래스, 다중 선택, 배치 작업, 가상화 스크롤 | **완료** |
| 3. Labeling | Konva.js 라벨링 도구, AI 보조 (SAM, Grounding DINO) | 미시작 |
| 4. Training & Inference | YOLO 학습 파이프라인, SSE 모니터링, 모델 버전 관리 | 미시작 |
| 5. Pipeline & SaaS | React Flow 파이프라인 에디터, 데이터 피드백 루프, 프로덕션 배포 | 미시작 |

## 마이그레이션 현황

기존 레포(vision-flow) → 신규 레포(vision-flow-2)로 코드 + 설계 마이그레이션 완료.

- 설계 문서 20개 (`.claude/contexts/`)
- Backend: 모델 9, 스키마 7, 서비스 6, 라우터 6, 스토리지 2
- Frontend: 페이지 6, 컴포넌트 14+, shadcn/ui 13
- AI Worker: 스캐폴딩 + 스키마 (구현은 Phase 4)
- 인프라: Dockerfile 3, Docker Compose 2, Nginx, 개발 스크립트
- 테스트: Backend 27 + Frontend 13
- 품질 도구: ruff, pyrefly, ESLint, Husky pre-commit

## 코드 품질 개선 (완료 — `feat/code-quality-improvements`)

- 보안: JWT 필수화, IDOR 수정, CORS 제한, 입력 검증, 비밀번호 강도
- 성능: N+1 해결, bulk DELETE, 응답 헬퍼
- 인프라: 공통 에러 핸들러, JSON 로깅, 페이지네이션 스키마
- 프론트엔드: React Query, AppLayout, ErrorBoundary, TaskDetailPage 분할
- 테스트: Backend 27 + Frontend 13, pre-commit 훅

## 미해결 개선 과제

향후 별도 브랜치에서 진행:
- 대형 컴포넌트 분할 (DataPoolTab ~800줄, FolderTreeView ~1000줄)
- 이미지/폴더 API React Query 전환
- Refresh Token 도입
- CI/CD, 모니터링, 백업 (운영 단계)
