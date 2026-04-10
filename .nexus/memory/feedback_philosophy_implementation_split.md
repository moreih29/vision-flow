---
name: 철학과 구현의 plan 분리 선호
description: 사용자는 상위 개념(철학/정책) plan과 하위 실행(구현/기술 부채) plan을 명시적으로 분리하는 것을 선호함
type: feedback
originSessionId: fdf56d86-b3af-4cc9-8d00-264b16ed4cf6
---
복잡한 plan에서 철학 결정과 구현 실행이 섞이면 사용자는 "여기선 철학만"이라고 명시적으로 분리한다. 별도 plan 세션으로 분리할 항목을 plan 문서에 예약 목록으로 기록하는 것을 선호한다.

**Why:** 2026-04-10 디자인 철학 plan에서 반복 관찰됨:
- Issue #2(버전 관리 UX) 경로 2 결정 시: "이 철학만 잘 설계해두고 백엔드 수정은 그 철학을 보고 별도 plan을 잡아서 진행할 것"
- Issue #3(Collaboration 공간 표현): "여기선 철학만. 구현은 별도 플랜 세션 [d]"
- 결과: plan 문서(.nexus/context/design-philosophy.md)에 "별도 Plan 예약 목록" 섹션이 만들어져 두 개의 follow-up plan(백엔드 불변 스냅샷, Collaboration 구현)이 명시적으로 기록됨
- 사용자의 의도: 하나의 plan에 너무 많은 층위가 섞이면 scope 폭발 + 우선순위 흐려짐. 철학 문서가 먼저 존재해야 하위 plan이 그 기준으로 분석될 수 있음.

**How to apply:**
- 큰 주제 plan에서 실행 세부 사항(스키마 변경, 구현 방법 등)이 철학 결정과 섞이면 "이건 별도 plan 세션으로 분리하는 것이 어떨까요?"를 먼저 제안
- plan의 decision summary에 "파생 plan 예약" 섹션을 명시적으로 포함
- context 문서(.nexus/context/)는 추상 수준의 "왜"와 "무엇"만 다루고, "어떻게"는 별도 plan으로 넘김
- 구현 task를 tasks.json에 넣을 때도 "이건 철학 plan의 범위인가 별도 plan인가?"를 판단
