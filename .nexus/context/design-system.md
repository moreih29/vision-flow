# Design System

> 리뷰 체크 질문: "이 색/간격/모양이 토큰을 통과했는가, 아니면 고유 방언인가?"

---

## 1. 토큰 정의

### 기존 Semantic Token (유지)

`index.css`에 이미 정의됨. 직접 수정 금지.

| Token | 용도 |
|---|---|
| `--background` / `--foreground` | 앱 기본 배경/텍스트 |
| `--card` / `--card-foreground` | 카드 컨테이너 |
| `--popover` / `--popover-foreground` | 팝오버/드롭다운 |
| `--primary` / `--primary-foreground` | 주요 액션, CTA |
| `--secondary` / `--secondary-foreground` | 보조 액션 |
| `--muted` / `--muted-foreground` | 비활성/부제 텍스트 |
| `--accent` / `--accent-foreground` | 선택 상태, 강조 |
| `--destructive` | 삭제/취소/위험 액션 |
| `--border` / `--input` / `--ring` | 테두리, 입력, 포커스 링 |
| `--success` / `--success-foreground` | 성공 상태 |
| `--warning` / `--warning-foreground` | 경고 상태 |
| `--info` / `--info-foreground` | 정보 상태 |
| `--sidebar-*` | 사이드바 전용 계열 |
| `--chart-1` ~ `--chart-5` | 차트 전용 |

### 신규 Semantic Token (추가 대상)

`index.css`에 추가 정의 필요. Tailwind `@theme`에 유틸로도 노출할 것.

| Token | 용도 | 이유 (Issue 참조) |
|---|---|---|
| `--dirty` / `--dirty-foreground` | 변경사항 있음 — `v1.3*` 별표, 상단 배너 | Issue #1 "Version in sight", Issue #2 dirty 상태 시각화 |
| `--dirty-subtle` | stash 배너 배경 — 안도 톤, 경고 아님 | Issue #2 Designer: amber는 경고 계열, stash는 임시저장 안도 계열 — 별도 톤 필요 |
| `--canvas-bg` | LabelingPage 캔버스 영역 전용 다크 배경 | Issue #3 WorkspaceLayout `tone="dark"` 슬롯 — 기능적 정당성(이미지 대비, 시선 피로), CSS variable로 격리 |
| `--reviewed` / `--reviewed-foreground` | 리뷰 완료 이미지/배지 | Issue #2 "Version in sight" 원칙 — 상태별 one state, one look |
| `--assigned-me` | 내 할당 영역 색 코딩 (Collaboration) | Issue #3 Collaboration 공간 표현 — 현재 미구현, 예약 토큰 |

### 금지 사항

- **유틸 색상 직접 사용 금지**: `bg-blue-100`, `bg-amber-500`, `text-amber-600`, `bg-neutral-900` 등 Tailwind 팔레트 직접 참조 불가
- **예외**: `bg-transparent`, `text-white`, `text-black` — contrast가 본질인 경우에 한해 허용
- 신규 코드: 즉시 적용. 기존 위반 코드: 파생 task에 묶어 점진 migration (ESLint rule은 추후 업그레이드 가능)

---

## 2. Scale 규약

### Spacing

허용 단계: **1 / 2 / 3 / 4 / 6 / 8** (4 / 8 / 12 / 16 / 24 / 32px)

| 허용 | Tailwind class | px |
|---|---|---|
| ✅ | `gap-1` / `p-1` / `m-1` | 4 |
| ✅ | `gap-2` / `p-2` / `m-2` | 8 |
| ✅ | `gap-3` / `p-3` / `m-3` | 12 |
| ✅ | `gap-4` / `p-4` / `m-4` | 16 |
| ✅ | `gap-6` / `p-6` / `m-6` | 24 |
| ✅ | `gap-8` / `p-8` / `m-8` | 32 |
| ⚠ 예외 | `p-0.5` / `p-1.5` | 2 / 6 — `<Kbd>` 같은 특수 컴포넌트 내부만 |
| ❌ | `p-5` / `p-7` / `gap-5` 등 | 금지 — 비표준 값(p-5=20px)은 시각 리듬 파괴 |

이유: Issue #5 결정 — 4/8/12/16/24/32 grid 통일.

### Rounded

| 단계 | class | 용도 |
|---|---|---|
| sm | `rounded-sm` | input, chip, kbd |
| md | `rounded-md` | card, panel, dialog |
| full | `rounded-full` | badge, avatar, dot |

이유: Issue #5 — `rounded-md` / `lg` / `xl` / `2xl` / `3xl` / `4xl` 난립 제거. 3단계로 충분.

### Icon Size

| 단계 | class | 용도 |
|---|---|---|
| inline | `h-3.5 w-3.5` | 텍스트 인라인 아이콘 |
| default | `h-4 w-4` | 버튼 내 기본 아이콘 |
| prominent | `h-5 w-5` | 강조 / 네비게이션 아이콘 |

### Shadow

| 단계 | class | 용도 |
|---|---|---|
| sm | `shadow-sm` | card resting |
| md | `shadow-md` | card hover, dropdown |
| lg | `shadow-lg` | dialog, modal |

---

## 3. 컴포넌트 규약

### `<StatusBadge>`

- `state` variant: `dirty` | `reviewed` | `labeling` | `draft` | `completed`
- 각 state는 semantic token만 사용 — domain에서 색상 직접 조립 금지
- 모든 상태 표시는 `<StatusBadge>`를 통해서만 처리

리뷰 체크: "이 배지가 `<StatusBadge state="...">` 를 통해 렌더링되는가?"

### `<SelectionRing>`

- 선택 상태를 일관되게 표현하는 wrapping 컴포넌트
- `ring` + `bg-accent` 패턴 통일 — 도메인 코드에서 직접 `ring-*` / `border-*` 조립 금지

### `<Kbd>`

- 단축키 힌트 표시 전용 컴포넌트 (`components/ui/kbd.tsx`)
- mono font, 1-2자, semantic token 기반 색상
- **규약: 단축키 매핑된 interactive element 옆에 반드시 동반** (Issue #4 결정)
- spacing 예외 허용 대상 (`p-0.5` / `p-1.5`)

리뷰 체크: "이 interactive element에 단축키가 있다면 `<Kbd>` 힌트가 옆에 보이는가?"

### Typography Role

`text-xs` / `text-sm` 등 primitive 클래스보다 role 클래스 우선 사용.

| Role | class | 용도 |
|---|---|---|
| title | `text-title` | 페이지 / 섹션 제목 |
| body | `text-body` | 본문 텍스트 |
| caption | `text-caption` | 부제 / 설명 |
| code | `text-code` | 코드 / 기술 값 |

primitive(`text-xs` / `text-sm` / `text-base`)는 role class로 표현 불가한 경우에만 보조 사용.

### Loading 패턴

| 패턴 | 용도 | 조건 |
|---|---|---|
| Skeleton | 콘텐츠 shape이 알려진 로딩 | 200ms ~ 1s |
| Inline shimmer | 버튼 / 칩 짧은 액션 대기 | 200ms ~ 1s |
| (없음) | 200ms 미만 로딩 | 로더 아예 안 띄움 |
| Full-screen spinner | 앱 초기 로드 | 1s 초과, 전체 화면 |

`Loader2` border-spinner는 풀스크린 초기 로드 외 사용 금지.

---

## 4. 정책

### 모션 정책

CSS `@keyframes` 4종만 허용: `fade` / `slide` / `pulse` / `scale`

- `framer-motion`: 4종으로 불가피한 경우에만 도입 — 리뷰 검토 필수
- 신규 모션 추가 시 리뷰에서 "4종 중 어디에 해당하는가?" 반드시 답해야 함
- 키 눌림 피드백: 200ms `pulse` CSS keyframe (Issue #4 결정)

### 색상 하드코딩 금지

- 신규 코드: 즉시 적용
- 기존 코드: 파생 task와 묶어 점진 migration
  - 주요 대상: `bg-neutral-*` 하드코딩 (LabelingPage:787, FilmStrip:45, LabelingCanvas:256/348/370/393)
- ESLint rule: 추후 필요 시 추가 (현재는 리뷰 기반 강제)

### Layout 계약

| Layout | 적용 페이지 | 특성 |
|---|---|---|
| `AppLayout` | 전체 | 공통 nav 유지 |
| `BrowseLayout` | Projects 등 탐색 | max-width + `py-6` 통일 |
| `DetailLayout` | ProjectDetail, DataPool, TaskDetail | 좌 rail + 중앙 main |
| `WorkspaceLayout` | LabelingPage | 전체폭 + resizable panels + `tone="dark"` 슬롯 허용 |

리뷰 체크: "이 색상/배경이 chrome인가 canvas인가?" — canvas(`--canvas-bg`)는 WorkspaceLayout 내부에서만 어두워짐.

### 리뷰 체크 질문 (요약)

1. "이 색/간격/모양이 토큰을 통과했는가, 아니면 고유 방언인가?"
2. "이 배지/상태 표시가 `<StatusBadge>`를 통해 렌더링되는가?"
3. "이 interactive element에 단축키가 있다면 `<Kbd>` 힌트가 옆에 보이는가?"
4. "이 모션이 4종(fade/slide/pulse/scale) 중 어디에 해당하는가?"
5. "이건 chrome인가 canvas인가?"
