# Vision Flow — 프로젝트 나침반

## 핵심 가치
웹 기반 Vision AI 모델 학습/추론 파이프라인 관리 서비스.
파이프라인 오케스트레이션 + 데이터 피드백 루프가 핵심 차별점.

## Phase 현황

| Phase | 내용 | 상태 |
|-------|------|------|
| 1. MVP Foundation | 인증, 프로젝트/DataStore CRUD, 이미지 업로드, 폴더 관리 | **완료** |
| 2. Data Curation | Task, 라벨 클래스, 다중 선택, 배치 작업, 가상화 스크롤 | **완료** |
| 3. Labeling | Konva.js 라벨링 도구 (Classification + BBox MVP) | **MVP 완료** |
| 4. Training & Inference | YOLO 학습 파이프라인, SSE 모니터링, 모델 버전 관리 | 미시작 |
| 5. Pipeline & SaaS | React Flow 파이프라인 에디터, 데이터 피드백 루프, 프로덕션 배포 | 미시작 |

## 완료된 브랜치 이력

### feat/migrate-context-docs
코드 + 설계 문서 마이그레이션 (기존 레포 → 신규 레포)

### refactor/domain-restructure
Dataset→DataStore, Subset→Task 도메인 리네이밍 (D025)

### feat/code-quality-improvements
- 보안: JWT 필수화, IDOR 수정, CORS 제한, 입력 검증, 비밀번호 강도
- 성능: N+1 해결, bulk DELETE, 응답 헬퍼
- 인프라: 공통 에러 핸들러, JSON 로깅, 페이지네이션 스키마
- 프론트엔드: React Query, AppLayout, ErrorBoundary, TaskDetailPage 분할
- 테스트: Backend 27 + Frontend 13, pre-commit 훅
- 품질 도구: ruff, pyrefly, ESLint, Husky

### feat/labeling-tool
- 기술 부채: DataPoolTab 949→235줄, FolderTreeView 1124→365줄, React Query 전환
- 백엔드: Annotation 모델 + CRUD API + labeled_count 실계산
- 프론트엔드: Konva.js 라벨링 에디터 (Classification + BBox), Zoom/Pan, Undo/Redo, 자동저장
- E2E 테스트: Playwright 15 시나리오 검증, 버그 3건 수정

## 현재 코드 규모

- Backend: 모델 10, 스키마 9, 서비스 8, 라우터 8, 스토리지 2
- Frontend: 페이지 7, 컴포넌트 30+, hooks 15+, shadcn/ui 13
- 테스트: Backend 27 + Frontend 13
- 설계 문서: `.claude/contexts/` 21개

## 미해결 개선 과제

향후 별도 브랜치에서 진행:
- Phase 3 잔여: Polygon 도구, Keypoint 도구, AI 보조 라벨링
- Refresh Token 도입
- CI/CD, 모니터링, 백업 (운영 단계)
