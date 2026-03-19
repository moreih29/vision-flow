# Data Management

## DataStore와 Task 이원 구조 (D012, D025)

Vision Flow의 데이터 관리는 **DataStore**와 **Task**의 이원 구조로 설계되었다.

### DataStore (구 Dataset/Data Pool)
- **역할**: 원본 이미지의 자유로운 저장소
- **특성**:
  - 버전 관리 없음 — 이미지를 자유롭게 추가/삭제
  - 폴더 구조로 정리 가능
  - 중복 이미지 자동 감지 및 제거 (해시 기반)
  - 라벨 없음 — 순수한 이미지 보관소
- **비유**: "사진 앨범" — 촬영한 사진을 모두 넣어두는 곳

### Task (구 Subset)
- **역할**: 특정 학습 목적에 맞게 큐레이션된 이미지 집합 + 라벨링/학습 작업 단위
- **특성**:
  - Task Type 지정 필수 (Classification, Object Detection 등) — D013
  - Task Type이 라벨 포맷을 결정 (변경 불가)
  - DataStore의 이미지를 선택하여 포함 (참조)
  - 라벨 클래스 관리 (Task별 독립)
  - Status 필드로 워크플로 상태 추적 (draft → labeling → ready → training → completed)
  - 수동 스냅샷 버전 관리 (v1, v2, v3...) — D014
- **비유**: "플레이리스트" — 앨범에서 목적에 맞는 곡을 골라 모은 것

### 관계
```
DataStore (원본)
  │
  │  이미지 선택 (참조)
  ▼
Task A (Classification)  ← 라벨 클래스: 고양이, 개, 새
Task B (Object Detection) ← 라벨 클래스: 차량, 사람, 신호등
Task C (Segmentation)    ← 라벨 클래스: 도로, 건물, 나무
```

- 하나의 이미지가 여러 Task에 포함될 수 있음
- Task의 이미지를 삭제해도 DataStore의 원본은 유지
- DataStore에서 이미지를 삭제하면, 해당 이미지를 참조하는 Task에서도 제거

## Task Type (D013)

Task 생성 시 반드시 하나의 Task Type을 지정한다. 이후 변경 불가.

| Task Type | 라벨 형식 | 설명 |
|-----------|----------|------|
| Classification | 이미지 → 클래스 | 이미지 전체에 하나의 클래스 부여 |
| Object Detection | 이미지 → Bounding Box + 클래스 | 객체 위치를 사각형으로 표시 |
| Instance Segmentation | 이미지 → Polygon + 클래스 | 객체 윤곽을 다각형으로 표시 |
| Pose Estimation | 이미지 → Keypoint + 클래스 | 관절/기준점 좌표 표시 |

### 색상 코딩 (UI)
- Classification: 초록
- Object Detection: 파랑
- Instance Segmentation: 보라
- Pose Estimation: 주황

## Task Status 워크플로

```
draft → labeling → ready → training → completed
```

| 상태 | 설명 |
|------|------|
| draft | Task 생성됨, 이미지/클래스 구성 중 |
| labeling | 라벨링 진행 중 |
| ready | 라벨링 완료, 학습 가능 |
| training | 학습 중 (Phase 4) |
| completed | 학습 완료, 모델 사용 가능 |

## 버전 관리 전략

### 데이터 버전 (Task) — D014
- **수동 스냅샷 방식**: 사용자가 명시적으로 버전 생성 (v1, v2, v3...)
- 자동 버전 관리가 아닌 이유: 사용자가 의미 있는 시점에만 버전을 기록하도록 유도
- 스냅샷은 해당 시점의 이미지 목록 + 라벨 상태를 기록
- **아직 구현되지 않음**

### 내부 중복 관리 — D007
- **해시 기반 중복 제거**: 파일 내용의 SHA-256 해시로 중복 감지
- 사용자에게는 개별 이미지로 보이지만, 물리 파일은 공유
- 디스크 효율성과 사용자 경험의 균형

### 모델 버전 — D016
- **시맨틱 버저닝**: vX.Y.Z
  - X (Major): 클래스 변경 (클래스 추가/제거)
  - Y (Minor): 데이터 변경 (이미지 추가/제거)
  - Z (Patch): 설정 변경 (하이퍼파라미터)
- **아직 구현되지 않음**

### 클래스 스키마 호환성 — D015
- 클래스 구성의 SHA-256 해시를 계산하여 Task 간 호환성 검사
- 동일 클래스 구성 → 호환 (모델 전이 가능)
- 다른 클래스 구성 → 비호환 (새 학습 필요)
- **아직 구현되지 않음**

## 데이터 흐름 요약

```
1. 이미지 수집
   └── DataStore에 업로드 (폴더 정리, 중복 제거)

2. 데이터 큐레이션
   └── DataStore에서 목적별 Task 생성 (Task Type 지정)
   └── Task에 이미지 선택/추가

3. 라벨링
   └── Task의 이미지에 Task Type에 맞는 라벨 부여

4. 학습
   └── Task의 라벨링된 데이터로 모델 학습

5. 추론 & 피드백
   └── 학습된 모델로 새 이미지 추론
   └── 추론 결과를 검증 → 학습 데이터로 재활용
```
