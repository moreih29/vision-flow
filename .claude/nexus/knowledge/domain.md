<!-- tags: domain, datastore, task, labeling, pipeline, training, data-management -->
# Domain Concepts

## 프로젝트 정의

Vision Flow — 웹 기반 Vision AI 모델 학습/추론 파이프라인 관리 서비스.
이미지 업로드 → 라벨링 → 모델 학습 → 추론 → 파이프라인 구성 → 피드백 루프 전체 사이클.

### 차별점 (vs Roboflow, V7 Labs)
1. **파이프라인 오케스트레이션**: React Flow 기반 노드 편집기로 다중 모델 연결 (예: 물체 감지 → 크롭 → 분류)
2. **데이터 피드백 루프**: 추론 결과를 검증/수정 → 새 학습 데이터로 편입 (Active Learning)

## DataStore + Task 이원 구조 (D012, D025)

### DataStore (원본 저장소)
- 이미지를 자유롭게 추가/삭제하는 "사진 앨범"
- 폴더 구조로 정리, 해시 기반 중복 제거
- 라벨 없음 — 순수 이미지 보관

### Task (작업 단위)
- 특정 학습 목적의 큐레이션 이미지 + 라벨링/학습 단위 — "플레이리스트"
- Task Type 필수 (Classification, Object Detection, Segmentation, Pose) — 생성 후 변경 불가 (D013)
- Status: draft → labeling → ready → training → completed
- 수동 스냅샷 버전 관리 (D014)
- Task별 독립 라벨 클래스

### 관계
```
DataStore (원본)
  │  이미지 선택 (참조, M:N)
  ▼
Task A (Classification)  ← 클래스: 고양이, 개
Task B (Detection)       ← 클래스: 차량, 사람
```
- 하나의 이미지 → 여러 Task에 포함 가능
- Task 이미지 삭제 → DataStore 원본 유지
- DataStore 이미지 삭제 → 참조 Task에서도 제거

## Annotation 모델

| 필드 | 설명 |
|------|------|
| task_image_id | FK → task_images (어떤 Task의 어떤 이미지) |
| label_class_id | FK → label_classes (어떤 클래스) |
| data | JSONB — 라벨 타입별 다른 구조 |

### data 포맷
- **Classification**: `{"type": "classification"}` (이미지당 1개)
- **BBox**: `{"type": "bbox", "x": f, "y": f, "width": f, "height": f}` (이미지 좌표 기준)

### API 엔드포인트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/tasks/{id}/images/{img_id}/labels` | 이미지별 조회 |
| POST | `/tasks/{id}/images/{img_id}/labels` | 단일 생성 |
| PUT | `/tasks/{id}/images/{img_id}/labels` | Bulk 저장 (전체 교체) |
| PUT | `/labels/{id}` | 단일 수정 |
| DELETE | `/labels/{id}` | 단일 삭제 |

## 파이프라인 (설계 완료, 구현 미시작)

React Flow 기반 노드 DAG 편집기. 노드 유형: Input, Preprocessing, Model, Postprocessing, Output, Branch, Merge.

## 학습 (스캐폴드 완료, 구현 미완)

Celery + Ultralytics YOLO. AI Worker의 모든 서비스 메서드가 현재 `NotImplementedError`.
스키마는 완전 정의 — `TrainingRequest`, `TrainingStatus`, `PredictionRequest`, `PredictionResult`.

## 데이터 관리 설계 결정

| ID | 결정 | 이유 |
|----|------|------|
| D007 | 하이브리드 버전 관리 | 내부: 해시 dedup, 외부: 스냅샷 버전 (디스크 효율 + 직관적 UX) |
| D012 | DataStore + Task 이원 구조 | 원본과 작업 분리 — 자유로운 관리 + 체계적 학습 |
| D013 | Task Type 생성 시 확정, 변경 불가 | 라벨 포맷 결정. 변경 시 기존 라벨 호환성 깨짐 |
| D014 | 수동 스냅샷 버전 관리 | 의미 있는 시점에만 기록 |
| D015 | 클래스 스키마 SHA-256 해시 | Task 간, 버전 간 클래스 호환성 자동 판단 |
| D025 | Dataset→DataStore, Subset→Task 리네이밍 | 역할을 명확히 표현 |
