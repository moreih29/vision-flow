<!-- tags: frontend, react, routing, components, hooks, design-system -->
# Frontend Structure

## 진입점 및 라우팅
- `src/main.tsx` → React 엔트리
- `src/App.tsx` → 라우트 정의, ErrorBoundary, Sonner

### 라우트
| 경로 | 페이지 | 인증 |
|------|--------|------|
| `/login` | LoginPage | 공개 |
| `/register` | RegisterPage | 공개 |
| `/projects` (= `/`) | ProjectsPage | 보호 |
| `/projects/:id` | ProjectDetailPage | 보호 |
| `/projects/:id/tasks/:taskId` | TaskDetailPage | 보호 |
| `/projects/:id/tasks/:taskId/label` | LabelingPage | 보호 |

## 디자인 시스템
- **서체**: Plus Jakarta Sans Variable (기하학적, 현대적)
- **Radius**: 0.375rem (6px) — Sharp & Professional 톤
- **Primary**: oklch(0.58 0.18 260) blue
- **표면 계층**: background(0.955 회색) → card(흰색, shadow-sm) → popover(shadow-lg)
- **다크모드**: 3단계 밝기 (bg 0.13 → card 0.18 → popover 0.22), border 14%
- **커스텀 스크롤바**: CSS scrollbar-width: thin + webkit 6px
- **시맨틱 색상**: success(green), warning(amber), info(blue), destructive(red)
- **인터랙션 패턴**: `INTERACTIVE_CARD` 상수 (lib/styles.ts) — hover:-translate-y-0.5 + shadow-md
- **브랜딩**: "Vision" (regular) + "Flow" (bold, primary color) 타이포 로고

## 상태 관리
- **Zustand** (`src/stores/`): auth-store (인증), labeling-store (라벨링 UI 상태)
- **React Query** (`src/lib/query-client.ts`): 서버 상태 캐싱/동기화

## API 클라이언트
- `src/api/client.ts`: Axios 인스턴스, base `/api/v1`, Bearer 토큰 인터셉터, 401 시 로그아웃
- `src/api/`: auth, projects, data-stores, images, tasks, label-classes, annotations, snapshots

## 주요 컴포넌트
- `src/components/layout/AppLayout` — 헤더(sticky, backdrop-blur 스크롤 반응, 다크모드 토글)
- `src/components/ui/` — shadcn/ui 커스터마이징 (button hover 수정, card shadow, badge 시맨틱 variants, dialog duration 150ms)
- `src/components/file-tree/` — 파일 트리 뷰 (가상화, role="tree", aria-expanded)
- `src/components/content-viewer/` — 콘텐츠 미리보기
- `src/pages/` — 로그인(그라디언트 배경), ProjectsPage(카드 컬러 스트라이프), TaskDetailPage(모드 시각 강화, useKeyboardManager)

## 커스텀 훅 (`src/hooks/`)
- `use-keyboard-manager.ts` — 중앙화된 키보드 단축키 관리 (priority, ignoreInput, enabled)
- `use-canvas-transform.ts` — 캔버스 줌/패닝
- `use-folder-operations.ts` — 폴더 CRUD
- `use-image-drag-drop.ts` — D&D 이미지 처리 (cursor-grab 힌트)
- `use-bulk-operations.ts` — 배치 이미지 작업
- `use-folder-contents.ts`, `use-infinite-scroll.ts` 등

## 유틸리티
- `src/lib/styles.ts` — 인터랙션 패턴 상수 (INTERACTIVE_CARD)
- `src/lib/utils.ts` — cn() 등 유틸리티
- `src/lib/query-client.ts` — React Query 설정

## 타입 정의 (`src/types/`, 8개)
- TaskType: classification, object_detection, instance_segmentation, pose_estimation
- TaskStatus: draft, labeling, ready, training, completed