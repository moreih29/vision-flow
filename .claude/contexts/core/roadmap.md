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

## Phase 3: Labeling (미시작)
**목표**: 라벨링 도구 구현 + AI 보조

### 계획 항목
- [ ] Konva.js 기반 라벨링 캔버스
- [ ] Bounding Box 도구 (Object Detection)
- [ ] Classification 도구
- [ ] Polygon 도구 (Instance Segmentation)
- [ ] Keypoint 도구 (Pose Estimation)
- [ ] 라벨 데이터 저장/조회 API
- [ ] 라벨링 키보드 단축키
- [ ] 실행 취소/다시 실행
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

## 기술 부채

Phase 1~2 완료 시점에서 식별된 기술 부채:

1. **테스트 부재**: 유닛/통합 테스트 없음. Phase 3 시작 전 테스트 프레임워크 도입 권장.
2. **에러 핸들링**: 각 서비스에서 개별적으로 HTTPException. 공통 에러 핸들러 필요.
3. **로깅**: 체계적 로깅 시스템 미구축.
4. **페이지네이션**: 일부 엔드포인트만 적용. 공통 페이지네이션 스키마 필요.
5. **대형 컴포넌트**: DataPoolTab, FolderTreeView 분할 필요.
6. **서버 데이터 관리**: useState+useEffect 패턴 → React Query 도입 고려.
7. **보안**: CORS 전체 허용, JWT localStorage 저장 → 프로덕션 전 보안 강화.
8. **도메인 구조 변경 완료**: Dataset→DataStore, Subset→Task 리네이밍 완료 (D025).
