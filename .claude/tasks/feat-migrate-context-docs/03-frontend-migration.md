# Phase D: Frontend Migration

## 목표
기존 Frontend 코드를 마이그레이션하면서 아키텍처를 개선하고 대형 컴포넌트를 분할한다.

## 작업 순서 (의존성 기반)

### D-1. 기반 설정
- [x] React 19 + TypeScript + Vite 8 프로젝트 (B-2에서 완료)
- [x] Tailwind CSS 4 + shadcn/ui 설정
- [x] React Router 7 라우팅 구조
- [x] Axios 클라이언트 + JWT 인터셉터
- [ ] **신규**: React Query 설정 (QueryClient, QueryProvider)
- [ ] **신규**: 공통 레이아웃 컴포넌트 (헤더, 사이드바)
- [ ] **신규**: 전역 에러 바운더리

### D-2. 인증 UI
- [x] Zustand auth-store (login, register, fetchMe, logout)
- [x] LoginPage
- [x] RegisterPage
- [x] ProtectedRoute
- [ ] **개선**: 로그인 폼 react-hook-form + zod 검증 강화

### D-3. 프로젝트 관리 UI
- [x] 프로젝트 API 모듈 (React Query hooks)
- [x] ProjectsPage (목록 + 생성 다이얼로그)
- [x] ProjectDetailPage (탭 구조)
- [ ] **개선**: React Query로 데이터 캐싱/자동 재검증

### D-4. 이미지 관리 UI — 핵심 리팩토링
기존 DataPoolTab(~800줄)과 FolderTreeView(~1000줄)를 분할한다.

#### DataPoolTab 분할 계획:
- [ ] `DataPoolTab.tsx` → 컨테이너 (상태 관리, 레이아웃)
- [ ] `ImageToolbar.tsx` → 상단 툴바 (뷰 모드 전환, 액션 버튼)
- [ ] `ImageUploadZone.tsx` → 드래그앤드롭 업로드 영역
- [ ] `ImageBatchActions.tsx` → 배치 작업 (선택 후 삭제/이동)
- [x] `VirtualImageGrid.tsx` → 가상화 그리드 (기존 유지)
- [x] `VirtualImageList.tsx` → 가상화 리스트 (기존 유지)

#### FolderTreeView 분할 계획:
- [ ] `FolderTree.tsx` → 트리 렌더링
- [ ] `FolderTreeNode.tsx` → 개별 트리 노드
- [ ] `FolderContextMenu.tsx` → 우클릭 컨텍스트 메뉴
- [ ] `useFolderTree.ts` → 트리 상태 관리 훅
- [ ] `useFolderDragDrop.ts` → 드래그앤드롭 로직 훅

#### 공통 훅 마이그레이션:
- [x] `useMultiSelect.ts` — 다중 선택 (기존 유지)
- [x] `useConfirmDialog.tsx` — 확인 다이얼로그 (기존 유지)
- [ ] **신규**: `useImageApi.ts` — React Query 기반 이미지 API 훅
- [ ] **신규**: `useFolderApi.ts` — React Query 기반 폴더 API 훅

### D-5. Subset 관리 UI
- [x] SubsetsTab (목록 + 생성 다이얼로그)
- [x] SubsetDetailPage (이미지 + 클래스 관리)
- [x] ImageSelectionModal
- [ ] **개선**: SubsetDetailPage(~480줄) 분할
  - [ ] `SubsetImageGrid.tsx` — 이미지 표시
  - [ ] `SubsetClassPanel.tsx` — 라벨 클래스 관리
  - [ ] `SubsetHeader.tsx` — 정보 표시 + 액션

### D-6. 타입 시스템
- [x] 기존 타입 마이그레이션 (project, dataset, image, subset, label-class)
- [ ] **개선**: API 응답 타입과 도메인 타입 분리
- [ ] **개선**: zod 스키마에서 타입 추론 (schema → type)

## 기존 레포 대비 개선 목록

| 항목 | 기존 | 개선 |
|------|------|------|
| 서버 데이터 | useState + useEffect | React Query (캐싱, 자동 갱신) |
| DataPoolTab | ~800줄 단일 컴포넌트 | 5~6개 하위 컴포넌트로 분할 |
| FolderTreeView | ~1000줄 단일 컴포넌트 | 4~5개 하위 컴포넌트 + 훅 분할 |
| SubsetDetailPage | ~480줄 단일 컴포넌트 | 3개 하위 컴포넌트로 분할 |
| 레이아웃 | 각 페이지 독립 | 공통 레이아웃 컴포넌트 |
| 에러 처리 | 개별 try/catch | 전역 에러 바운더리 + React Query 에러 |
| API 레이어 | 직접 axios 호출 | React Query hooks |

## 완료 기준
- [x] 모든 기존 페이지가 동일하게 동작
- [ ] 대형 컴포넌트 분할 완료 (각 컴포넌트 200줄 이하 목표)
- [ ] React Query 적용 (캐싱 동작 확인)
- [ ] 공통 레이아웃 적용
- [x] TypeScript strict 모드 에러 없음
