<!-- tags: frontend, react, typescript, components, routing, state -->
<!-- tags: frontend, react, typescript, components, routing, state -->
<!-- tags: frontend, react, typescript, components, routing, state -->

# Frontend

## 기술 스택

| 범주 | 기술 |
|------|------|
| 프레임워크 | React 19 + TypeScript 5.9 |
| 빌드 | Vite 8 |
| 스타일 | Tailwind CSS 4 + shadcn/ui |
| 라우팅 | react-router-dom 7 |
| 서버 상태 | @tanstack/react-query 5 |
| 클라이언트 상태 | zustand 5 (auth-store, labeling-store) |
| 캔버스 | Konva + react-konva (라벨링) |
| 가상화 | @tanstack/react-virtual (파일 트리, 이미지 그리드) |
| 폼 | react-hook-form + zod |
| HTTP | axios |
| 아이콘 | lucide-react |
| 토스트 | sonner |

## 디렉토리

```
frontend/src/
├── pages/             # 페이지 컴포넌트
├── components/        # 공용 + 도메인 컴포넌트
│   ├── ui/            # shadcn/ui 기본 컴포넌트
│   ├── layout/        # 레이아웃 (GNB 등)
│   ├── file-tree/     # FileTreeView (일반화된 트리)
│   ├── content-viewer/ # VirtualGrid, VirtualList, ContentArea, ImageQuickLook, types
│   ├── labeling/      # 라벨링 캔버스, 도구
│   ├── task-detail/   # 태스크 상세 패널 (VersionPanel, ClassManagePopover, TaskDetailHeader 포함)
│   └── data-pool/     # 데이터풀 전용 컴포넌트
├── hooks/             # 커스텀 훅 (API 호출, 상태 관리)
├── api/               # axios 클라이언트 + API 모듈
├── stores/            # zustand 전역 상태
├── types/             # TypeScript 타입 정의
└── lib/               # 유틸리티 (format, utils, query-client)
```

## 페이지 구조

| 페이지 | 경로 | 설명 |
|--------|------|------|
| LoginPage | `/login` | 로그인 |
| RegisterPage | `/register` | 회원가입 |
| ProjectsPage | `/` | 프로젝트 목록 |
| ProjectDetailPage | `/projects/:id` | 프로젝트 상세 (데이터풀/태스크 탭) |
| TaskDetailPage | `/projects/:id/tasks/:taskId` | 태스크 상세 (2-column + toggleable pool panel 구조) |
| LabelingPage | `/projects/:id/tasks/:taskId/labeling` | 라벨링 작업 (좌우 사이드 활용 + 폴더 트리) |

## 핵심 컴포넌트

### FileTreeView (`components/file-tree/`)

일반화된 파일 트리 컴포넌트. 데이터풀과 태스크 양쪽에서 사용.

- **가상화**: `@tanstack/react-virtual` flat list (28px 고정 행 높이, overscan 10)
- **무한 스크롤**: placeholder 기반 자동 로딩 (페이지 크기 50)
- **독립 Props**: `readOnly`, `checkable`, `collapsible` — 세 축이 독립적으로 동작
- **콜백 위임**: `fetchFolderContents`, `onItemDrop`, `onExternalFileDrop` 등으로 도메인 로직 외부 위임
- **노드 타입**: folder (`path`가 `/`로 끝남) / file (`fileId` 보유)
- **키 전략**: `${node.path}:${node.fileId}` (동일 이미지 다른 폴더 중복 허용)

### content-viewer (`components/content-viewer/`)

VirtualGrid / VirtualList 통합 뷰어 (react-virtual 기반). ContentArea가 그리드/리스트 전환 및 폴더 네비게이션을 담당. ImageQuickLook으로 이미지 미리보기 모달 제공.

### VersionPanel (`components/task-detail/`)

타임라인 커밋 로그 스타일 버전 패널. 수직선 + ●/○ dot, HEAD 마커 표시. dirty 상태에서 인라인 확정(버전 생성) 및 "변경사항 버리기" 지원.

### ClassManagePopover (`components/task-detail/`)

자체 상태 관리 팝오버. 헤더 칩 형태로 노출. 라벨 클래스 CRUD.

### LabelingCanvas (`components/labeling/`)

Konva 기반 이미지 라벨링 캔버스.
- AnnotationLayer: 바운딩 박스 렌더링/편집
- ToolPanel: 도구 선택 (bbox, polygon 등)
- ClassPanel: 라벨 클래스 선택
- FilmStrip: 이미지 목록 네비게이션

## 주요 훅

| 훅 | 위치 | 역할 |
|----|------|------|
| useSnapshots, useCreateSnapshot, useRestoreSnapshot, useVersionStatus, useStash | `hooks/use-snapshots.ts` | 버전 관리 API 연동 |
| (drag & drop) | `hooks/use-image-drag-drop.ts` | 이미지 드래그 & 드롭 통합 |
| (context menu) | `hooks/use-image-context-menu.ts` | 이미지 컨텍스트 메뉴 |
| (bulk operations) | `hooks/use-task-bulk-operations.ts` | 벌크 삭제/이동/드롭 |

## API 클라이언트

- `api/client.ts`: axios 인스턴스, baseURL `/api/v1`, JWT 인터셉터
- Vite dev proxy: `/api` → `http://localhost:8100`
- 각 도메인별 API 모듈: `api/{domain}.ts`

## 컨벤션

- **UI 컴포넌트**: shadcn/ui 사용, 브라우저 기본 UI (`confirm`, `alert`) 사용 금지
- **테스트**: vitest + @testing-library/react
- **린트**: ESLint 9 + prettier
- **pre-commit**: husky + lint-staged
