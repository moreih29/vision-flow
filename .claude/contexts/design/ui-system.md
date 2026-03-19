# UI System

## 디자인 시스템 기반

### shadcn/ui
- **스타일**: radix-nova
- **베이스 컬러**: slate
- **아이콘**: lucide-react
- **CSS 변수**: HSL 기반 (Tailwind CSS 4 호환)
- Radix UI 프리미티브 위에 구축된 복사/붙여넣기 가능한 컴포넌트

### Tailwind CSS 4
- 유틸리티 우선 스타일링
- `@/` 경로 별칭으로 import
- PostCSS 기반 빌드

## 컴포넌트 구성

### UI 프리미티브 (shadcn/ui)
`frontend/src/components/ui/` 디렉토리에 위치:

- **레이아웃**: Card, Separator, ScrollArea
- **입력**: Button, Input, Textarea, Select, Checkbox, Switch
- **오버레이**: Dialog, AlertDialog, DropdownMenu, ContextMenu, Popover, Tooltip
- **네비게이션**: Tabs, Breadcrumb
- **데이터**: Table, Badge
- **피드백**: Toast (sonner)

### 비즈니스 컴포넌트
`frontend/src/components/` 루트에 위치:

| 컴포넌트 | 규모 | 역할 |
|---------|------|------|
| DataPoolTab | 대형 (~800줄) | 데이터 풀 이미지 관리 전체 |
| FolderTreeView | 대형 (~1000줄) | 폴더 트리 네비게이션 + 컨텍스트 메뉴 |
| VirtualImageGrid | 중형 (~500줄) | 가상화 이미지 그리드 뷰 |
| VirtualImageList | 중형 (~500줄) | 가상화 이미지 리스트 뷰 |
| SubsetDetailPage | 대형 (~480줄) | Subset 상세 (이미지 + 클래스 관리) |
| ImageSelectionModal | 중형 (~400줄) | Subset용 이미지 선택 모달 |
| SubsetsTab | 중형 (~260줄) | Subset 목록 + 생성 |
| ImageUploader | 소형 (~200줄) | 드래그앤드롭 업로더 |

## 스타일링 컨벤션

### 클래스 유틸리티
```typescript
import { cn } from '@/lib/utils';
// cn() = clsx + tailwind-merge
```

### 반응형 패턴
- 현재 데스크톱 중심 레이아웃
- 모바일 대응은 향후 과제

### 다크 모드
- shadcn/ui 기본 다크 모드 지원 구조 존재
- 현재 라이트 모드만 사용

## 디자인 원칙

### 1. 브라우저 기본 UI 금지 (D022)
- `window.confirm()`, `window.alert()` 사용 금지
- 모든 확인/알림은 shadcn AlertDialog 사용
- `useConfirmDialog` 훅으로 Promise 기반 API 제공

### 2. 대량 데이터 대응
- 이미지 목록은 반드시 가상화 스크롤 적용
- 한 번에 렌더링하는 DOM 노드 수 최소화

### 3. 일관된 컴포넌트 패턴
- 모든 form은 react-hook-form + zod 검증
- 모든 목록은 로딩/빈 상태/에러 상태 처리
- 모든 삭제/위험 작업은 확인 다이얼로그

## 개선 포인트

1. **대형 컴포넌트 분할**: DataPoolTab(~800줄), FolderTreeView(~1000줄)가 너무 큼. 하위 컴포넌트로 분리 필요.
2. **디자인 토큰 체계화**: 색상, 간격, 타이포그래피 등의 일관된 토큰 시스템 구축
3. **접근성(a11y)**: 키보드 네비게이션, 스크린 리더 지원 강화
4. **애니메이션**: 전환 효과, 로딩 스켈레톤 등 사용자 체감 개선
