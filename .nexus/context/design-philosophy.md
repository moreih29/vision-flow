# Design Philosophy

## 북극성 (Design North Star)

> Vision Flow는 데이터셋을 코드처럼 진지하게 다루는 Vision AI 팀을 위한, 라벨링·버전 관리·학습 파이프라인이 한 몸인 플랫폼이다.

Vision Flow는 비전문가를 위한 도구가 아니다. Git을 쓰는 팀이 라벨링 데이터에도 같은 엄격함을 요구할 때 선택하는 플랫폼이다.

---

### 핵심 원칙 5개

**1. Keyboard first**
단축키는 숨겨진 고급 기능이 아니라 UI의 일부다.
모든 인터랙티브 요소 옆에 단축키 힌트가 보여야 한다. 라벨링 중인 사람은 마우스를 들지 않고도 다음 이미지로 넘어가고, 라벨을 바꾸고, 버전을 확인할 수 있어야 한다.
_적용 예시: QWEASD 도구 전환, A/D 이미지 내비게이션, V 키 버전 패널 토글 — 모두 옆에 `<Kbd>` 힌트 상시 노출._

**2. Version in sight**
버전 상태는 항상 보이는 곳에 있다.
라벨링 중인 사람이 현재 상태가 HEAD인지, dirty인지, stash가 있는지를 별도 화면으로 이동하지 않고 확인할 수 있어야 한다. 버전은 메타데이터가 아니라 작업 공간의 1급 시민이다.
_적용 예시: TaskDetail 우측 고정 버전 레일(Right Version Rail), metaBar 상시 버전 pill, `v1.3*` dirty 별표 표기._

**3. Fast feedback**
행동의 결과는 즉시 보여야 한다.
라벨 저장, 버전 확정, 복원 — 모든 액션에는 시각·모션 피드백이 따른다. 사용자가 "됐나?"를 물어야 하는 상태를 허용하지 않는다.
_적용 예시: 키 눌림 시 버튼 200ms pulse, 버전 확정 후 commit lane 즉시 갱신, diff 미리보기로 복원 영향 사전 확인._

**4. One state, one look**
같은 상태는 같은 모양이다.
dirty, 리뷰 완료, 할당됨 — 동일 상태가 페이지마다 다른 색으로 표현되어서는 안 된다. 모든 색·간격·형태는 semantic 토큰을 통과한다.
_적용 예시: `--dirty`, `--reviewed`, `--assigned-me` semantic 토큰, `<StatusBadge>` 공용 컴포넌트, `<SelectionRing>` 통일._

**5. Collaboration is asynchronous**
협업은 실시간 동시 편집이 아니라 Git 스타일 비동기 분할·병합이다.
여러 사람이 같은 Task를 동시에 편집하는 UI에 베팅하지 않는다. 대신 영역 분할 → 각자 작업 → 병합/리뷰의 흐름을 공간 언어로 표현한다.
_적용 예시: 할당 영역 색 코딩, blame 아바타, 영역 진입 배너 (구현은 별도 plan)._

---

### Anti-원칙 2개

**A. 비전문가 온보딩을 추구하지 않는다**
왜: Vision Flow의 타겟은 Git을 쓰는 AI 팀이다. 비전문가를 위한 단순화는 전문가의 밀도 있는 작업 흐름을 방해한다.
대신: 단축키 힌트와 Drawer Cheatsheet로 학습 곡선을 낮추되, 인터페이스 자체를 단순화하지 않는다.

**B. 실시간 동시 편집 인터페이스에 베팅하지 않는다**
왜: 라벨링 데이터의 충돌 해소는 Google Docs 모델로 해결되지 않는다. 스냅샷 기반 버전 관리가 이미 우리의 진짜 협업 모델이다.
대신: 비동기 분할·병합·blame을 공간 언어로 표현한다. 다인 협업은 1급 시민이되, 실시간 presence는 아니다.

---

### 판단 기준 페르소나

**선우** — 하루 수백 장을 라벨링하는 어노테이터. 마우스를 최소화하고, 리듬을 깨는 UX를 싫어한다. 단축키를 외우고, 버전을 자주 확정한다. 새로운 기능보다 안정적인 키보드 흐름이 중요하다.

**지원** — Task 전체를 관리하는 버전 리드. 누가 어떤 영역을 작업했는지, 언제 스키마가 바뀌었는지, 어느 버전이 학습에 쓰였는지를 추적한다. 버전 히스토리가 신뢰할 수 있어야 한다.

새 기능을 판단할 때: 선우의 라벨링 리듬을 끊는가? 지원이 버전 히스토리를 읽을 수 있는가?

---

## 버전 관리 UX

**추상화 수준: Semantic Visualization** — Git 시각 은유를 유지하되, 용어는 한국어 의미 중심으로 치환한다. Git을 모르는 사람도 읽을 수 있고, Git을 아는 사람은 즉시 구조를 파악한다.

> _북극성 한 줄:_ "Git처럼 믿을 수 있고, Git보다 읽기 쉬운 버전 관리"
> _판단 기준:_ "라벨링 중인 사람의 눈으로, 버전 관리하는 사람의 확신으로"

---

### 용어 치환 규칙

| Git 원어 | Vision Flow 표현 | 비고 |
|----------|-----------------|------|
| HEAD | "현재" 배지 + dot | 항상 시각적으로 강조 |
| commit (동사) | "버전 확정" | 전체 통일 |
| snapshot (명사) | "버전" | 사용자 노출 명칭 |
| stash | "임시 저장" | 유지 |
| dirty | `v1.3*` 별표 + tooltip | major 표기와 구분 |
| major/minor | 숫자 그대로 노출 + tooltip 설명 | "클래스 스키마 변경 시 major 증가" |
| hash | 완전 은폐 | 디버그 drawer에만 |
| restore (동사) | "되돌아가기" | |
| restore (명사) | "복원" | |

**현 시점 사용 금지 용어:** hash, commit(명사), merge, branch. 백엔드 불변 스냅샷 구조 확보 후 재검토 가능.

---

### 시각 축: Compact Commit Lane

- 기존 commit graph 방향 유지, "Compact commit lane"으로 정련
- major 경계에 시각적 gap 명시화 (클래스 스키마 변경 지점 가시화)
- `restored_from` 엣지를 별도 선으로 시각화
- popover 확장 아이콘 추가

### 액션 축 우선순위

- **지금 구현:** diff — 복원 다이얼로그에 diff 기반 영향 미리보기 포함
- **다음 단계:** branch/merge — "Collaboration is asynchronous" 원칙 완성 시
- **제외:** cherry-pick, rebase, squash

**전제:** 이 UX는 백엔드 불변 스냅샷 구조를 전제로 설계된다. 관련 백엔드 수정(4건)은 별도 plan 세션에서 다룬다.

---

## 작업 공간 모델

**모드 모델: 단일 우주 + 캔버스 예외.** "탐색 모드 vs 집중 모드" 이분법을 쓰지 않는다. "작업 밀도 축"으로 이야기한다.

> _북극성 한 줄:_ "같은 chrome 위에 세 개의 작업 밀도 — 훑기, 정하기, 몰입하기"
> _판단 기준:_ "이건 chrome이야, canvas야?"

---

### Layout Primitive 3개

| Layout | 적용 페이지 | 특성 |
|--------|-----------|------|
| **BrowseLayout** | Projects 목록 | 탐색 밀도, max-width + 통일 padding |
| **DetailLayout** | ProjectDetail, DataPool, TaskDetail | 좌 rail + 중앙 main, py-6 통일 |
| **WorkspaceLayout** | LabelingPage | 전체폭 + resizable panels, `tone="dark"` 슬롯 허용 |

각 Layout이 max-width와 padding을 강제한다 — 레이아웃 계약이 컴포넌트에 분산되지 않는다.

### 정보 밀도 기본값

- 탐색 3페이지: py-6 통일 (기존 py-4/py-8 혼재 해소)
- LabelingPage 우측 FileTree: 기본 접힘 (사용자 설정 localStorage 복원)
- LabelingPage InspectorPanel: 기본 접힘 (사용자 설정 localStorage 복원)

### 전환 감각

캔버스 배경만 어두워진다. header·sidebar·sub-bar는 사용자 테마를 일관되게 유지한다. "순간이동"이 아니라 "조명 변화"다. 이를 위해 캔버스 배경색은 CSS 변수(`--canvas-bg`)로 격리한다. WorkspaceLayout의 `tone="dark"` 슬롯은 "One state, one look"의 타협 지점이다 — 캔버스 픽셀 작업의 기능적 정당성(이미지 대비, 시선 피로)과 규약화(하드코딩 아닌 토큰)를 동시에 만족한다.

### TaskDetailPage 방향: Right Version Rail

VersionPanel을 Popover에서 우측 고정 rail로 이동한다. metaBar에 version pill 상시 표시. "Version in sight" 원칙의 공간 구현이다. V 키로 toggle("Keyboard first"와 연결).

### Collaboration 공간 표현 (철학 선언)

할당은 공간 언어로 표현한다. 실시간 presence 없이 비동기 분할·병합·blame이 공간에 드러난다. 구현(assignment 모델 + 영역 색 코딩/blame/진입 배너 UI)은 별도 plan 세션으로 분리.

---

## 상호작용 우선순위

**전략: Inline Hint + Drawer Cheatsheet.** 단축키는 UI에 각인되어 있어야 배울 수 있다.

> _북극성 한 줄:_ "키보드는 눈에 보여야 배울 수 있다 — 단축키는 UI의 chrome에 각인된다"
> _판단 기준:_ "이 interactive element가 단축키를 가지고 있다면 그 힌트가 옆에 보이는가?"

---

### Inline Hint

모든 단축키가 매핑된 요소 옆에 1-2자 mono `<Kbd>` 힌트 항상 표시. 규약: "단축키가 있으면 반드시 `<Kbd>` 힌트 표시."

### Drawer Cheatsheet

`KeyboardShortcutsOverlay`를 Dialog에서 우하단 Drawer(shadcn Sheet)로 전환. `?` 키 토글. 캔버스를 덮지 않아 라벨링 리듬을 유지한다. Drawer 열림 시 검색 input 자동 포커스, Esc 닫힘.

### 단축키 3-Tier 카테고리

| 레벨 | 범위 | 예시 |
|------|------|------|
| 글로벌 | 전체 앱 | `?`, `Ctrl+S`, `V`, `T` |
| 페이지별 | 해당 페이지만 | QWEASD, A/D, 1-9 라벨 선택 |
| 컨텍스트 | 선택된 상태 한정 | Delete, Enter (annotation 선택 시) |

**커스터마이징은 제공하지 않는다.** 내부 팀 도구로서 공통 근육 기억이 커스터마이징보다 가치 있다. 마우스 전용 사용자는 2등 시민 — Anti-원칙 A와 일관된다.

### 피드백 모션 정책

키 눌림 시 버튼 200ms pulse (CSS @keyframes). framer-motion 의존성 도입을 피한다.

---

## 디자인 토큰 & 시스템 강도

**정책: Strict Tokens + Semi-strict Migration.** Vision Flow는 한 가지 언어로 말한다. 방언을 허용하지 않는다.

> _북극성 한 줄:_ "Vision Flow는 한 가지 언어로 말한다. 방언을 허용하지 않는다"
> _판단 기준:_ "이 색/간격/모양이 토큰을 통과했는가, 아니면 고유 방언인가?"

---

### Semantic Token 확장 목록

| 토큰 | 용도 |
|------|------|
| `--dirty` / `--dirty-foreground` | dirty 상태 (warning 계열) |
| `--dirty-subtle` / `--dirty-subtle-foreground` | stash 배너 안도 톤 |
| `--canvas-bg` / `--canvas-foreground` | LabelingCanvas 전용 dark 배경 |
| `--reviewed` / `--reviewed-foreground` | 리뷰 완료 상태 |
| `--assigned-me` | 내 할당 영역 (Collaboration 예정) |

유틸 색상(bg-blue-100, text-amber-600 등) 직접 사용 금지. Tailwind @theme에 `bg-dirty`, `text-dirty-foreground` 등 유틸로 노출.

### Scale 통일 규약

- **Spacing:** 1/2/3/4/6/8단계만 허용 (4/8/12/16/24/32px). 0.5/1.5는 컴포넌트 내부 특수 용도만.
- **Rounded:** 3단계 — sm/md/full. md/lg/xl/2xl 난립 제거.
- **Icon:** 3단계 — h-3.5/h-4/h-5.
- **Shadow:** 3단계 — sm/md/lg.

### Typography Role

4개 semantic class: `text-title` / `text-body` / `text-caption` / `text-code`. 도메인 코드에서는 role을 우선 사용하고, primitive(text-xs/sm/base)는 보조로만.

### Loading & 상태 표현 통일

- **Loading 2종:** Skeleton(형태 있는 콘텐츠) + inline shimmer(짧은 액션). Loader2 border-spinner는 풀스크린 초기 로딩에만.
- **상태 공용 컴포넌트:** `<StatusBadge state="dirty|reviewed|labeling|draft">` / `<SelectionRing>`. 도메인에서 색상 직접 조립 금지.

### 모션 정책

CSS @keyframes 4종만: fade / slide / pulse / scale. framer-motion은 불가피한 경우에만 최소 도입. 신규 모션은 리뷰 검토.

### 강제 수준

- 신규 코드: 즉시 적용
- 기존 코드: 파생 task와 묶어 점진 migration
- ESLint rule: 추후 필요 시 업그레이드 가능

---

## 별도 Plan 예약 목록

다음 항목들은 본 디자인 철학 확정 이후 별도 [plan] 세션에서 다룬다.

1. **백엔드 불변 스냅샷 수정** (4건)
   - 해시 재계산 제거
   - partial restore 정책 수립
   - LabelClass id 복원 안정화
   - advisory lock 도입

2. **Collaboration 공간 표현 구현**
   - assignment 모델 스키마 설계
   - 영역 색 코딩 UI
   - blame 아바타
   - 영역 진입 배너
