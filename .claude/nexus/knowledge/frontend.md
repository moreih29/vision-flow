<!-- tags: frontend, react, typescript, components, labeling, konva, ui, ux -->
# Frontend Architecture

## 디렉토리 구조

```
frontend/src/
├── api/            # Axios 클라이언트 + 리소스별 모듈 (projects, data-stores, images, tasks, label-classes)
├── components/
│   ├── ui/             # shadcn 프리미티브 (Button, Card, Dialog, AlertDialog, DropdownMenu 등)
│   ├── layout/         # AppLayout (공통 헤더 + children)
│   ├── labeling/       # 라벨링 캔버스 컴포넌트
│   ├── task-detail/    # TaskDetailPage 하위 (Header, ClassPanel, ImageGrid, ImageCard, ImageListView)
│   ├── folder-tree/    # FolderTreeView
│   ├── data-pool/      # DataPoolTab 하위 컴포넌트
│   └── __tests__/      # 컴포넌트 테스트
├── hooks/          # React Query hooks (use-projects, use-tasks, use-data-stores) + useMultiSelect, useConfirmDialog
├── pages/          # Login, Register, Projects, ProjectDetail, DataStoreDetail, TaskDetail, Labeling
├── stores/         # Zustand (auth-store, labeling-store)
├── types/          # TypeScript 인터페이스
├── lib/            # cn(), query-client.ts
└── assets/
```

## 라우팅

| 경로 | 페이지 | 인증 |
|------|--------|------|
| `/login`, `/register` | 인증 | X |
| `/`, `/projects` | ProjectsPage | O |
| `/projects/:id` | ProjectDetailPage (DataPool + Tasks 탭) | O |
| `/data-stores/:id` | DataStoreDetailPage | O |
| `/projects/:id/tasks/:taskId` | TaskDetailPage | O |
| `/projects/:id/tasks/:taskId/label` | LabelingPage (전체화면, AppLayout 미적용) | O |

## 상태 관리

- **서버 상태**: React Query (캐싱, 자동 무효화) — `use-projects.ts`, `use-tasks.ts` 등
- **전역 상태**: Zustand — `auth-store.ts` (인증만), `labeling-store.ts` (캔버스 상태)
- **로컬 상태**: React useState/useReducer

## UI 시스템

- **shadcn/ui**: radix-nova 스타일, slate 컬러, HSL CSS 변수
- **Tailwind CSS 4**: 유틸리티 우선, `cn()` = clsx + tailwind-merge
- **lucide-react**: 아이콘
- **sonner**: Toast 알림
- **react-hook-form + zod**: 폼 검증
- **@tanstack/react-virtual**: 가상화 스크롤 — 수만 이미지 DOM 성능 보장 (D019)
- **브라우저 기본 UI 금지** (D022): confirm/alert 대신 shadcn AlertDialog + `useConfirmDialog`
- **이미지 서빙**: FileResponse + JWT 인증 (D018) — 이미지별 접근 권한 제어. CDN 캐싱은 향후 보완.
- **인증**: JWT 7일 유효, localStorage 저장 (D023) — XSS 취약 시 httpOnly 쿠키 전환 검토

## UX 패턴

- **다중 선택**: Ctrl+클릭 (토글), Shift+클릭 (범위) — `useMultiSelect` 훅
- **드래그앤드롭**: 파일 업로드, 폴더 간 이동
- **컨텍스트 메뉴**: 우클릭 (이미지/폴더 작업)
- **뷰 모드**: 그리드/리스트/트리 전환
- **배치 작업**: 20개 단위 분할 업로드 — 서버/브라우저 메모리 보호 (D017)
- **더블 서밋 방지**: deletingRef로 중복 요청 차단

## 라벨링 캔버스 (Konva.js, D003: 외부 도구 대신 자체 구현 — 파이프라인 통합, AI 보조, 커스터마이징)

### 컴포넌트 구조
```
LabelingPage.tsx (데이터 로딩, 키보드, 자동저장)
  ├── ToolPanel.tsx (도구 선택: select/classification/bbox)
  ├── ClassPanel.tsx (라벨 클래스 목록 + 숫자키 단축키)
  ├── LabelingCanvas.tsx (Konva Stage + 이미지)
  │     ├── AnnotationLayer.tsx (bbox rect, classification badge)
  │     ├── tools/BBoxDrawTool.tsx (마우스 드래그 → bbox 생성)
  │     └── tools/BBoxSelectTool.tsx (선택/이동/리사이즈/삭제)
  ├── ImageNavigator.tsx (이전/다음 + 화살표 키)
  └── coord-utils.ts (좌표 변환)
```

### 구현된 기능
- **Classification**: 클래스 클릭 → 즉시 생성/교체 (이미지당 1개)
- **BBox**: 드래그 생성 (최소 5x5px), 선택/이동/리사이즈 (Transformer), Delete 삭제
- **Zoom/Pan**: 마우스 휠 줌 (커서 중심, 0.1x~10x), Space+드래그 팬
- **Undo/Redo**: Ctrl+Z/Ctrl+Shift+Z, 스냅샷 기반 (최대 50), 이미지 전환 시 초기화
- **자동저장**: isDirty 플래그 + 이미지 전환/페이지 이탈 시 Bulk Save

### Zustand 상태 (labeling-store)
`currentImageIndex`, `tool`, `selectedClassId`, `selectedAnnotationId`, `annotations`, `isDirty`, `past`/`future` (undo/redo 스택)
