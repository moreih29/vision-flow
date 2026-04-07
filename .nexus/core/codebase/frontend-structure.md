<!-- tags: frontend, react, routing, components, hooks -->
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

## 상태 관리
- **Zustand** (`src/stores/`): auth-store (인증), labeling-store (라벨링 UI 상태)
- **React Query** (`src/lib/query-client.ts`): 서버 상태 캐싱/동기화

## API 클라이언트
- `src/api/client.ts`: Axios 인스턴스, base `/api/v1`, Bearer 토큰 인터셉터, 401 시 로그아웃
- `src/api/`: auth, projects, data-stores, images, tasks, label-classes, annotations, snapshots

## 주요 컴포넌트
- `src/components/layout/` — AppLayout
- `src/components/ui/` — shadcn/ui 래퍼
- `src/components/file-tree/` — 파일 트리 뷰 (가상화)
- `src/components/content-viewer/` — 콘텐츠 미리보기
- `src/pages/` — DataPoolTab (28KB), TaskDetailPage (54KB), LabelingPage (19KB) 등 핵심 페이지

## 커스텀 훅 (`src/hooks/`, 22+개)
- `use-canvas-transform.ts` (12KB) — 캔버스 줌/패닝
- `use-folder-operations.ts` — 폴더 CRUD
- `use-image-drag-drop.ts` — D&D 이미지 처리
- `use-bulk-operations.ts` — 배치 이미지 작업
- `use-folder-contents.ts`, `use-infinite-scroll.ts` 등

## 타입 정의 (`src/types/`, 8개)
- TaskType: classification, object_detection, instance_segmentation, pose_estimation
- TaskStatus: draft, labeling, ready, training, completed