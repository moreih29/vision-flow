---
name: 후속 plan 예약 목록 (2026-04-10 기준, 4건)
description: 디자인 철학 및 TaskDetailPage 재구조화 plan에서 파생된 4개 follow-up plan. 각각 독립된 [plan] 세션으로 실행 예정
type: project
originSessionId: fdf56d86-b3af-4cc9-8d00-264b16ed4cf6
---
Vision Flow의 두 개 major plan(디자인 철학 수립 2026-04-10 cycle 11, TaskDetailPage 재구조화 2026-04-10 cycle 12)에서 파생된 4건의 후속 plan이 예약되어 있다. 각각은 독립된 [plan] 세션으로 진행될 예정.

**Why:** 각 plan의 결정 당시 scope에 포함하기에는 너무 크거나(state 이동, 스키마 변경) 관심사가 달랐음. 상위 철학 plan에서 선언된 원칙을 구현 plan이 이어받는 구조. 사용자는 "철학-구현 plan 분리"를 선호하며 이 패턴을 반복해서 확인함(feedback_philosophy_implementation_split 참조).

**How to apply:** 다음 [plan] 세션 시작 시 이 목록에서 우선순위를 사용자와 협의. 각 plan은 `.nexus/context/design-philosophy.md` / `design-system.md`를 입력 문서로 받음.

---

## 1. TaskDetailPage 완전 분할 (cycle 12 잔여분)

**상태:** cycle 12에서 scope 축소로 미완. 현재 TaskDetailPage.tsx 약 1803줄 (원 1785줄에서 소폭 증가 — Phase 1의 신규 JSX 때문). viewerMode ternary 26개 그대로.

**남은 작업:**
- `useTaskDetailState` 훅 추출 — state 선언 + useEffect들을 별도 훅 파일로
- 키보드 핸들러 분리 — `taskDetailKeyboardHandlers` (useKeyboardManager 전달 배열을 독립 모듈로)
- `TaskViewerSection` / `PoolViewerSection` 분리 — viewerMode별 독립 섹션 컴포넌트
- `activeItems` / `activeSelectedKeys` 등 26개 ternary 완전 해소
- 최종 목표: TaskDetailPage.tsx ~500줄 + 6-7개 신규 파일

**본질:** 단순 presentational 분리가 아니라 **state/handler 소유권 이동**이 핵심. Props drilling이 아닌 상태 캡슐화. cycle 12에서 "presentational only"로 축소한 이유가 이 부분(state 이동)이 단일 세션에 부담이었기 때문.

**전제:** Opus 1M engineer 전용. Sonnet 200K context로는 반복 실패 확인됨 (cycle 12에서 2회 실패 후 Lead 직접 개입).

**입력 문서:** 
- cycle 12 history (`.nexus/history.json`의 archived plan)
- `.nexus/context/design-philosophy.md` (작업 공간 모델 섹션)
- 현 TaskDetailPage.tsx 실측

---

## 2. 백엔드 불변 스냅샷 수정 (디자인 철학 plan Issue #2 파생)

**철학 전제:** 경로 2 — "스냅샷은 불변 아카이브" 약속을 기술적으로 보장. UI가 이 전제를 이미 사용하여 설계됨.

**수정 항목 4건:**
- **해시 재계산 제거**: `backend/app/services/snapshot.py:694-701`의 복원 후 해시 재계산 삭제. 스냅샷은 생성 시점 값 유지.
- **Partial restore 정책**: 이미지 유실 시 silent skip(`snapshot.py:633-638`) 대신 명시적 에러 또는 경고 + 사용자 선택.
- **LabelClass id 복원 안정화**: DELETE+INSERT 대신 UPSERT로 id 유지. 외부 export(YOLO txt 등)의 class_index 무효화 방지.
- **Advisory lock 도입**: 동시 수정 보호. 현재 advisory lock, row lock, SELECT FOR UPDATE 없음.

**입력 문서:** 
- `.nexus/context/design-philosophy.md` (버전 관리 UX 섹션)
- `.nexus/context/versioning.md`
- cycle 11 Architect 분석 (history.json archived)

**주의:** 스키마 변경 없이 처리 가능. 단 기존 스냅샷의 해시가 "현재 복원된 상태 기준"으로 덮어써져 있어 데이터 마이그레이션(재해싱)이 필요할 수 있음.

---

## 3. Collaboration 공간 표현 구현 (디자인 철학 plan Issue #3 파생)

**철학 전제:** "할당은 공간 언어로 표현한다 — 실시간 presence 없이 비동기 분할·병합·blame이 공간에 드러난다" (Collaboration is asynchronous 원칙).

**구현 항목:**
- **Assignment 모델 스키마** (backend): Task-User 관계에 assigned_folders 또는 assigned_image_ids 추가
- **영역 색 코딩 UI**: 파일 트리의 폴더/파일에 담당자 색 점 (기존 `--assigned-me` 토큰 활용)
- **Blame 아바타**: 이미지 카드/FilmStrip 우상단에 마지막 수정자 이니셜/아바타
- **영역 진입 배너**: LabelingPage 진입 시 "내 할당: N개 폴더, M장" 1회성 표시
- **"다른 사람 영역 보기" 토글**: LabelingFilter에 assignee 필터 추가

**입력 문서:**
- `.nexus/context/design-philosophy.md` (작업 공간 모델 섹션 — Collaboration 공간 표현)
- cycle 11 Designer 분석 (history.json archived, 아이디어 4개 중 영역 색 코딩 최우선)

**예약된 토큰:** `--assigned-me`는 이미 index.css에 정의됨 (cycle 11 Phase 5 기반)

---

## 4. LabelingPage 단축키 UX 마무리 (디자인 철학 plan Issue #4 미완)

**철학 전제:** "키보드는 눈에 보여야 배울 수 있다 — 단축키는 UI의 chrome에 각인된다" (Keyboard first 원칙).

**미완 항목:**
- `KeyboardShortcutsOverlay` Dialog → **Sheet(Drawer) 리팩터** — 우하단 slide-in, 캔버스 덮지 않음, `?` 키 토글 + 검색 input 포커스 + Esc 닫힘
- `keyboard-shortcuts.ts` **단축키 매핑 데이터 추출** — 현재 LabelingPage useEffect 내 하드코딩. 카테고리 3-tier(글로벌/페이지별/컨텍스트)
- **FloatingToolbar/ImageNavigator/ClassPanel에 `<Kbd>` 힌트 일괄 추가** — FloatingToolbar는 shortcut 필드만 추가된 상태 (cycle 11에서 부분), 실제 Kbd 렌더링 미완
- **Restore 다이얼로그 diff 미리보기** (VersionPanel) — `use-snapshots.ts`의 `useSnapshotDiff` 훅이 이미 존재하나 UI에서 미사용. Issue #2의 "diff 지금 분기 필요"가 미완 상태로 남음.

**입력 문서:**
- `.nexus/context/design-philosophy.md` (상호작용 우선순위 섹션)
- `.nexus/context/design-system.md` (Kbd 컴포넌트 규약)

**주의:** 이 항목들은 TaskDetailPage와 무관하고 주로 LabelingPage 및 VersionPanel을 건드림. scope가 독립적이므로 다른 plan과 병렬 진행 가능.
