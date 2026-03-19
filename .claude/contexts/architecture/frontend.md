# Frontend Architecture

## 기술 스택

- **React 19** + **TypeScript 5.9**: UI 프레임워크
- **Vite 8**: 빌드 도구 (HMR, API 프록시)
- **Tailwind CSS 4**: 유틸리티 기반 스타일링
- **shadcn/ui** (radix-nova 스타일, slate 컬러): UI 컴포넌트 라이브러리
- **Zustand 5**: 전역 상태 관리 (인증만)
- **React Router 7**: 클라이언트 사이드 라우팅
- **Axios**: HTTP 클라이언트
- **@tanstack/react-virtual**: 가상화 스크롤 (대량 이미지 처리)
- **react-hook-form + zod**: 폼 검증
- **react-konva**: 라벨링 캔버스 (예정)
- **reactflow**: 파이프라인 에디터 (예정)
- **lucide-react**: 아이콘

## 디렉토리 구조

```
frontend/src/
├── api/            # API 레이어 (axios 클라이언트 + 리소스별 모듈)
│   ├── client.ts       # Axios 인스턴스 (baseURL, JWT 인터셉터, 401 리다이렉트)
│   ├── projects.ts     # 프로젝트 API
│   ├── datasets.ts     # 데이터셋 API
│   ├── images.ts       # 이미지 API (업로드, 폴더, 배치 작업)
│   ├── subsets.ts      # Subset API
│   └── label-classes.ts # 라벨 클래스 API
├── components/     # 비즈니스 컴포넌트
│   ├── ui/             # shadcn 프리미티브 (Button, Card, Dialog 등)
│   ├── DataPoolTab.tsx     # 데이터 풀 탭 (이미지 관리 핵심)
│   ├── SubsetsTab.tsx      # Subset 목록/생성 탭
│   ├── FolderTreeView.tsx  # 폴더 트리 네비게이션
│   ├── VirtualImageGrid.tsx # 가상화 이미지 그리드
│   ├── VirtualImageList.tsx # 가상화 이미지 리스트
│   ├── ImageSelectionModal.tsx # Subset용 이미지 선택 모달
│   ├── ImageUploader.tsx   # 드래그앤드롭 이미지 업로더
│   ├── FolderBreadcrumb.tsx # 경로 탐색
│   ├── FolderCard.tsx      # 폴더 카드
│   ├── FolderPickerDialog.tsx # 폴더 선택 다이얼로그
│   └── ProtectedRoute.tsx  # 인증 가드
├── hooks/          # 커스텀 훅
│   ├── useMultiSelect.ts      # Shift/Ctrl 클릭 다중 선택
│   └── useConfirmDialog.tsx   # Promise 기반 확인 다이얼로그
├── pages/          # 라우트 페이지 컴포넌트
│   ├── LoginPage.tsx
│   ├── RegisterPage.tsx
│   ├── ProjectsPage.tsx
│   ├── ProjectDetailPage.tsx
│   ├── DatasetDetailPage.tsx
│   └── SubsetDetailPage.tsx
├── stores/         # 전역 상태
│   └── auth-store.ts  # Zustand 인증 스토어
├── types/          # TypeScript 인터페이스
│   ├── project.ts, dataset.ts, image.ts, subset.ts, label-class.ts
├── lib/            # 유틸리티 (cn() 등)
└── assets/         # 정적 에셋
```

## 라우팅

| 경로 | 페이지 | 인증 필요 |
|------|--------|----------|
| `/login` | LoginPage | X |
| `/register` | RegisterPage | X |
| `/`, `/projects` | ProjectsPage | O |
| `/projects/:id` | ProjectDetailPage (DataPool + Subsets 탭) | O |
| `/projects/:id/subsets/:subsetId` | SubsetDetailPage | O |

## 상태 관리 전략

### 전역 상태: Zustand (인증만)
- `auth-store.ts`: login, register, fetchMe, logout, token/user 상태
- 토큰은 `localStorage`에 저장

### 서버 데이터: 로컬 상태 패턴
- React Query나 SWR을 사용하지 않음
- 각 페이지/컴포넌트에서 `useState` + `useEffect`로 직접 API 호출
- **개선 포인트**: 캐싱, 로딩 상태, 에러 핸들링이 컴포넌트마다 중복됨. 향후 React Query 도입을 고려할 수 있음.

## API 레이어 패턴

```typescript
// client.ts - 공통 Axios 인스턴스
const client = axios.create({ baseURL: '/api/v1' });
// 요청 인터셉터: Authorization: Bearer <token> 자동 삽입
// 응답 인터셉터: 401 시 토큰 제거 + /login 리다이렉트
```

- 모든 API 모듈은 `client`를 import하여 사용
- 이미지 파일 다운로드는 `?token=` 쿼리 파라미터 사용 (`<img src>` 태그 호환)

## 핵심 UI 패턴

### 가상화 스크롤
- 대량의 이미지(수천~수만)를 처리하기 위해 `@tanstack/react-virtual` 사용
- 그리드 뷰와 리스트 뷰 모두 가상화 적용

### 다중 선택
- `useMultiSelect` 훅으로 Shift+클릭(범위 선택), Ctrl+클릭(토글 선택) 지원
- 이미지 배치 작업(삭제, 이동)에 활용

### 확인 다이얼로그
- 브라우저 기본 `confirm()` 대신 shadcn AlertDialog 사용 (D022)
- `useConfirmDialog` 훅으로 Promise 기반 API 제공

### 폴더 관리
- 트리 뷰 + 그리드 뷰 전환
- 드래그앤드롭 폴더 이동
- 우클릭 컨텍스트 메뉴 (생성, 이름 변경, 삭제, 이동)
- 브레드크럼 네비게이션
