# Development Roadmap

## Phase 1: MVP Foundation (완료)
**목표**: 기본 인프라 + 데이터 업로드/관리

### 완료 항목
- [x] 모노레포 스캐폴딩 (Frontend + Backend + AI Worker)
- [x] Docker Compose 개발 인프라 (PostgreSQL + Redis)
- [x] JWT 인증 (회원가입, 로그인, 토큰 관리)
- [x] 프로젝트 CRUD
- [x] DataStore(원본 데이터 저장소) CRUD
- [x] 이미지 업로드 (해시 기반 중복 제거)
- [x] 폴더 구조 관리 (생성, 이름 변경, 이동, 삭제)
- [x] 스토리지 추상화 레이어 (StorageBackend)
- [x] 컨텐츠 주소 기반 저장 (SHA-256 샤딩)

## Phase 2: Data Curation (완료)
**목표**: Task 기반 데이터 큐레이션 + UI 고도화

### 완료 항목
- [x] Task CRUD (Task Type 지정, Status 관리)
- [x] Task ↔ Image 멤버십 관리
- [x] 라벨 클래스 CRUD
- [x] 가상화 이미지 그리드/리스트 (대량 이미지 성능)
- [x] 다중 선택 (Shift/Ctrl 클릭)
- [x] 배치 작업 (삭제, 이동)
- [x] 드래그앤드롭 (업로드, 폴더 이동)
- [x] 컨텍스트 메뉴 (우클릭)
- [x] 확인 다이얼로그 (shadcn AlertDialog)
- [x] 배치 업로드 (20개씩 분할)
- [x] 이미지 선택 모달 (Task용)
- [x] Dataset→DataStore, Subset→Task 도메인 구조 변경 (D025)

## Phase 3: Labeling (MVP 완료, 잔여 항목 있음)
**목표**: 라벨링 도구 구현 + AI 보조

### 완료 항목
- [x] Konva.js 기반 라벨링 캔버스 (줌/팬, 이미지 네비게이션)
- [x] Classification 도구 (클래스 선택 → 즉시 배정)
- [x] Bounding Box 도구 (그리기/선택/이동/리사이즈/삭제)
- [x] Annotation 모델 + CRUD API (Bulk Save 포함)
- [x] 라벨링 키보드 단축키 (Ctrl+Z/Y, 숫자키 클래스 선택)
- [x] 실행 취소/다시 실행 (스냅샷 기반)
- [x] 자동저장 (이미지 전환 시 + Ctrl+S)
- [x] labeled_count / label_count 실계산

### 잔여 항목
- [ ] Polygon 도구 (Instance Segmentation)
- [ ] Keypoint 도구 (Pose Estimation)
- [ ] AI 보조 라벨링: SAM 통합
- [ ] AI 보조 라벨링: Grounding DINO 통합

## Phase 4: Training & Inference (미시작)
**목표**: 모델 학습/추론 + 모니터링

### 계획 항목
- [ ] YOLO 학습 파이프라인 (Celery 태스크 구현)
- [ ] 학습 데이터 준비 (Task → YOLO 포맷 변환)
- [ ] 학습 진행 모니터링 (SSE 스트리밍)
- [ ] 학습 결과 저장/조회
- [ ] 모델 버전 관리 (시맨틱 버저닝)
- [ ] 단일 모델 추론 API
- [ ] 추론 결과 시각화
- [ ] 모델 내보내기 (ONNX, TorchScript, TFLite, CoreML)
- [ ] Task 스냅샷 버전 관리

## Phase 5: Pipeline & SaaS (미시작)
**목표**: 파이프라인 에디터 + 프로덕션 배포

### 계획 항목
- [ ] React Flow 기반 파이프라인 에디터
- [ ] 파이프라인 노드 시스템 (입력, 전처리, 모델, 후처리, 출력)
- [ ] 파이프라인 실행 엔진
- [ ] 데이터 피드백 루프
- [ ] 대시보드 페이지
- [ ] 프로덕션 Dockerfile (Frontend, Backend, AI Worker)
- [ ] 프로덕션 Docker Compose
- [ ] 리버스 프록시 (Nginx/Caddy)
- [ ] SSL/TLS 설정
- [ ] 멀티 테넌트 지원
- [ ] 모니터링/로깅 시스템

## Phase 간 의존성

```
Phase 1 (완료) → Phase 2 (완료) → Phase 3 (라벨링)
                                       │
                                       ▼
                                  Phase 4 (학습/추론)
                                       │
                                       ▼
                                  Phase 5 (파이프라인/배포)
```

- Phase 3은 Phase 2의 Task/클래스 관리에 의존
- Phase 4는 Phase 3의 라벨 데이터에 의존
- Phase 5는 Phase 4의 학습된 모델에 의존
- 단, 파이프라인 에디터 UI는 Phase 3과 병행 개발 가능

## 기술 부채 (해결 현황)

| # | 항목 | 상태 |
|---|------|------|
| 1 | 테스트 | **해결** — BE 27 + FE 13 테스트, pre-commit 훅 |
| 2 | 에러 핸들링 | **해결** — 공통 에러 핸들러 (표준 JSON 응답) |
| 3 | 로깅 | **해결** — JSON 구조화 로깅 |
| 4 | 페이지네이션 | **해결** — PaginatedResponse[T] 제네릭 스키마 |
| 5 | 대형 컴포넌트 | **해결** — DataPoolTab 949→235줄, FolderTreeView 1124→365줄 |
| 6 | 서버 데이터 관리 | **해결** — React Query 도입 (프로젝트/태스크/DataStore/이미지/폴더) |
| 7 | 보안 | **해결** — CORS 환경변수, JWT 필수, IDOR 수정, 입력 검증 |
| 8 | 도메인 리네이밍 | **해결** — Dataset→DataStore, Subset→Task (D025) |

### 잔여 기술 부채
- Refresh Token 도입 (현재 Access Token 7일)
- 이미지 width/height 업로드 시 보장
- CI/CD, 모니터링, 백업 (프로덕션 단계)
