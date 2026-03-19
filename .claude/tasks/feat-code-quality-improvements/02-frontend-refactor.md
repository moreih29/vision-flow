# Frontend 리팩토링

**Status**: Completed
**Depends on**: None

## Tasks

### 버그 수정 & 기능 추가 (완료)
- [x] 프로젝트 더블 생성 방지 — creatingRef 동기 가드 추가 (unplanned)
- [x] 태스크 더블 생성 방지 — creatingRef 동기 가드 추가 (unplanned)
- [x] 프로젝트 삭제 기능 추가 — confirm 다이얼로그 + API 연동 (unplanned)
- [x] 태스크 삭제 기능 추가 — confirm 다이얼로그 + API 연동 (unplanned)
- [x] 삭제 더블 서브밋 방지 — deletingRef 가드 추가 (unplanned)
- [x] 모달 backdrop blur 제거 — dialog, alert-dialog 모두 적용 (unplanned)
- [x] 401 인터셉터 auth 엔드포인트 제외 — 로그인 시 리다이렉트 방지 (unplanned)
- [x] 불필요한 "use client" 디렉티브 제거 (unplanned)

### React Query 도입
- [x] React Query 설정 (QueryClient, QueryProvider)
- [x] 프로젝트 API를 React Query hooks로 전환 (useProjects, useCreateProject, useDeleteProject)
- [x] 태스크 API를 React Query hooks로 전환 (useTasks, useCreateTask, useDeleteTask)
- [x] DataStore API를 React Query hooks로 전환 (useDataStores, useCreateDataStore)
- [-] 이미지/폴더 API를 React Query hooks로 전환 → 별도 브랜치 (DataPoolTab 리팩토링과 함께)

### 대형 컴포넌트 분할
- [-] DataPoolTab (~800줄) → 별도 브랜치에서 진행 (리스크 큼)
- [-] FolderTreeView (~1000줄) → 별도 브랜치에서 진행 (리스크 큼)
- [x] TaskDetailPage (~480줄) → Header + ClassPanel + ImageGrid + ImageCard + ImageListView (5개)

### 타입 시스템
- [x] 회원가입 폼 비밀번호 zod 검증 강화 (백엔드 규칙과 일치)
- [-] API 응답 타입과 도메인 타입 분리 → 별도 브랜치에서 진행
- [-] zod 스키마에서 타입 추론 → 별도 브랜치에서 진행

### 공통 UI
- [x] 공통 레이아웃 컴포넌트 (AppLayout — 헤더 + children)
- [x] 전역 에러 바운더리 (ErrorBoundary class component)

## Done When
- useState+useEffect 패턴이 React Query로 대체됨
- 각 컴포넌트 200줄 이하
- 공통 레이아웃 적용
