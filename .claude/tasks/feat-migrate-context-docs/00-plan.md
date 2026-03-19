# Vision Flow 2 - Migration & Setup Plan

## 목적

기존 레포(vision-flow)의 코드, 설계, 문서를 이 레포(vision-flow-2)로 마이그레이션하되,
단순 복사가 아닌 재검토 및 개선을 동반한다.

## 전체 작업 흐름

```
Phase A: 문서화 ✅
  └── 기존 레포의 설계/철학을 .claude/contexts에 정리

Phase B: 프로젝트 초기화 ✅
  └── 01-project-init.md 참조

Phase C: Backend 마이그레이션 ✅
  └── 02-backend-migration.md 참조

Phase D: Frontend 마이그레이션 🔧 (빌드 에러 수정 필요)
  └── 03-frontend-migration.md 참조

Phase E: AI Worker 마이그레이션 ✅ (E-1 기반 마이그레이션)
  └── 04-ai-worker-migration.md 참조

Phase F: 인프라 & DevOps ✅ (F-1~4 완료, F-5~7 운영 단계)
  └── 05-infra-setup.md 참조

Phase G: 품질 & 테스트 🔧 (프레임워크 완료, 추가 테스트 필요)
  └── 06-quality-testing.md 참조
```

## Phase A: 문서화 (완료)

### 작성된 Context 문서

#### architecture/ (구조)
- `system-overview.md` — 전체 시스템 구조, 서비스 간 통신, 기술 스택
- `frontend.md` — Frontend 아키텍처 (React, 라우팅, 상태 관리, 컴포넌트)
- `backend.md` — Backend 아키텍처 (FastAPI, 계층 구조, DI, 인증)
- `ai-worker.md` — AI Worker 아키텍처 (Celery, YOLO, 비동기 학습)

#### db/ (데이터)
- `schema.md` — 데이터베이스 스키마 (8개 테이블, ER 다이어그램)
- `migrations.md` — Alembic 마이그레이션 히스토리 및 전략
- `storage.md` — 파일 스토리지 전략 (해시 기반 CAS, 중복 제거)

#### design/ (UI/UX)
- `ui-system.md` — UI 시스템 (shadcn/ui, Tailwind, 컴포넌트 구성)
- `ux-patterns.md` — UX 패턴 (네비게이션, 이미지 관리, 드래그앤드롭)
- `pages.md` — 페이지 설계 (6개 페이지 + 사용자 흐름)

#### infra/ (인프라)
- `dev-environment.md` — 개발 환경 설정 (Docker Compose, 포트, 실행 방법)
- `deployment.md` — 배포 전략 (현재 상태 + 목표 아키텍처)
- `performance.md` — 성능 최적화 (적용된 + 향후 과제)

#### core/ (핵심 가치)
- `vision.md` — 프로젝트 비전, 차별점, 타겟 사용자
- `data-management.md` — Data Pool/Subset 이원 구조, 버전 관리 전략
- `labeling.md` — 라벨링 시스템 설계 (Konva.js, AI 보조)
- `training.md` — 학습 파이프라인 (Celery, YOLO, 메트릭, 버전 관리)
- `pipeline.md` — 파이프라인 오케스트레이션 (React Flow, 피드백 루프)
- `decisions.md` — 설계 결정 기록 (D001~D024, 재검토 결과)
- `roadmap.md` — 개발 로드맵 (5단계, 현재 Phase 2 완료)

## Phase B~G: 세부 작업 계획

각 Phase의 세부 내용은 아래 파일을 참조:

| 파일 | Phase | 핵심 내용 |
|------|-------|----------|
| [01-project-init.md](./01-project-init.md) | B | 모노레포 구조, 의존성, 설정 파일 초기화 |
| [02-backend-migration.md](./02-backend-migration.md) | C | Backend 코드 마이그레이션 + 개선 |
| [03-frontend-migration.md](./03-frontend-migration.md) | D | Frontend 코드 마이그레이션 + 개선 |
| [04-ai-worker-migration.md](./04-ai-worker-migration.md) | E | AI Worker 마이그레이션 + 구현 |
| [05-infra-setup.md](./05-infra-setup.md) | F | Docker, CI/CD, 모니터링 |
| [06-quality-testing.md](./06-quality-testing.md) | G | 테스트, 린팅, 코드 품질 |

## Phase 간 의존성

```
Phase A (문서화) ✅
  │
  ▼
Phase B (프로젝트 초기화) ✅
  │
  ├──────────┬──────────┐
  ▼          ▼          ▼
Phase C ✅  Phase D ✅  Phase E ✅
(Backend)  (Frontend) (AI Worker)
  │          │          │
  └──────────┼──────────┘
             ▼
         Phase F (인프라)
             │
             ▼
         Phase G (품질)
```

- Phase B 완료 후, C/D/E는 병렬 작업 가능
- Phase F는 C/D/E 중 하나 이상 완료 후 시작
- Phase G는 전체 진행 중 지속적으로 병행

## 마이그레이션 원칙

1. **단순 복사 금지**: 모든 코드를 재검토하며 옮긴다.
2. **기술 부채 해소**: 기존 레포에서 식별된 문제점을 이번에 해결한다.
3. **테스트 우선**: 새 레포에서는 처음부터 테스트를 작성한다.
4. **점진적 마이그레이션**: 한 번에 모두 옮기지 않고, 서비스 단위로 단계적으로 진행한다.
5. **문서 주도**: 코드 작성 전에 설계 문서를 먼저 작성/검토한다.
