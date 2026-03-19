# Labeling System

## 현재 상태: MVP 구현 완료 (Classification + BBox)

Konva.js 기반 라벨링 에디터가 구현되어 있으며, Classification과 Object Detection(BBox) 도구가 동작한다.

## 기술 스택

- **konva** + **react-konva**: HTML5 Canvas 기반 2D 그래픽
- **Zustand**: 라벨링 캔버스 상태 관리 (`labeling-store.ts`)
- **Annotation API**: Backend CRUD + Bulk Save

## 아키텍처

### 라우트
- `/projects/:id/tasks/:taskId/label` — 전체화면 라벨링 에디터 (AppLayout 미적용)

### 프론트엔드 컴포넌트 구조
```
pages/LabelingPage.tsx          — 메인 페이지 (데이터 로딩, 키보드, 자동저장)
  ├── components/labeling/ToolPanel.tsx      — 도구 선택 (task_type 기반)
  ├── components/labeling/ClassPanel.tsx     — 라벨 클래스 목록 + 숫자키 단축키
  ├── components/labeling/LabelingCanvas.tsx — Konva Stage + 이미지 렌더링
  │     ├── AnnotationLayer.tsx             — 어노테이션 오버레이 (bbox rect, classification badge)
  │     ├── tools/BBoxDrawTool.tsx          — 마우스 드래그로 bbox 생성
  │     └── tools/BBoxSelectTool.tsx        — bbox 선택/이동/리사이즈/삭제
  ├── components/labeling/ImageNavigator.tsx — 이전/다음 이미지 네비게이션
  └── components/labeling/coord-utils.ts    — 좌표 변환 유틸리티
```

### 백엔드 API
| 엔드포인트 | 설명 |
|-----------|------|
| `GET /tasks/{task_id}/images/{image_id}/labels` | 이미지별 어노테이션 조회 |
| `POST /tasks/{task_id}/images/{image_id}/labels` | 단일 어노테이션 생성 |
| `PUT /tasks/{task_id}/images/{image_id}/labels` | Bulk 저장 (전체 교체) |
| `PUT /labels/{id}` | 단일 어노테이션 수정 |
| `DELETE /labels/{id}` | 단일 어노테이션 삭제 |

모든 엔드포인트에서 프로젝트 소유권 검증 (`task_service.check_ownership`).

### 상태 관리 (Zustand)
`labeling-store.ts`:
- `currentImageIndex` — 현재 이미지 인덱스
- `tool` — 활성 도구 ('select' | 'classification' | 'bbox')
- `selectedClassId` — 선택된 라벨 클래스
- `selectedAnnotationId` — 선택된 어노테이션
- `annotations` — 현재 이미지의 어노테이션 배열
- `isDirty` — 변경사항 존재 여부
- `past` / `future` — Undo/Redo 스택 (스냅샷 기반, 최대 50)

## 구현된 기능

### Classification 도구
- 좌측 ClassPanel에서 클래스 클릭 → 즉시 classification annotation 생성/변경
- 이미지당 classification 1개 제한 (기존 있으면 교체)
- 캔버스에 클래스명+색상 배지 표시

### BBox 도구 (Object Detection)
- **그리기**: 마우스 드래그로 사각형 생성 (최소 5x5 픽셀)
- **선택**: 클릭으로 기존 bbox 선택
- **이동**: 선택된 bbox 드래그로 위치 변경
- **리사이즈**: Konva Transformer로 꼭짓점 드래그 리사이즈
- **삭제**: Delete/Backspace 키
- **시각화**: 클래스 색상 테두리, 호버 하이라이트, 선택 핸들

### Zoom/Pan
- **줌**: 마우스 휠 (커서 중심, 0.1x~10x)
- **팬**: Space+드래그

### 이미지 네비게이션
- 이전/다음 버튼 + 좌/우 화살표 키
- 현재 인덱스/총 개수 표시

### Undo/Redo
- Ctrl+Z (undo), Ctrl+Shift+Z (redo)
- 스냅샷 기반 (annotations 전체 상태)
- 이미지 전환 시 히스토리 초기화

### 자동저장
- 이미지 전환 시 isDirty 체크 → bulkSave API 호출
- Ctrl+S 수동 저장
- beforeunload 경고 (미저장 변경사항)
- 저장 상태 표시: "저장됨" / "변경사항 있음" / "저장 중..."

### labeled_count / label_count
- `TaskResponse.labeled_count`: annotations가 1개 이상인 task_images 수 (실시간 계산)
- `LabelClassResponse.label_count`: 해당 클래스의 annotation 수 (JOIN 쿼리)

## 좌표 체계

모든 annotation 좌표는 **normalized (0.0-1.0)** 로 저장:
- 저장 시: 이미지 좌표 → normalized (`rectToNormalizedBBox`)
- 렌더링 시: normalized → 이미지 좌표 → 스테이지 좌표 (`normalizedBBoxToRect`)
- 줌/팬 상태와 무관하게 정확한 좌표 보장

## 미구현 (Phase 3 잔여 / Phase 4+)

- Instance Segmentation (polygon tool)
- Pose Estimation (keypoint + skeleton)
- AI 보조 라벨링 (SAM, Grounding DINO) — AI Worker 인프라 필요
- YOLO 포맷 내보내기
- 라벨 복사/붙여넣기

## 알려진 제한사항

1. **Image width/height nullable**: 라벨링 시 이미지 크기가 null이면 좌표 변환 불가. 업로드 시 Pillow로 추출하고 있으나 보장되지 않음.
2. **동시 편집**: Last-write-wins (MVP). 다중 사용자/탭 충돌 미처리.
3. **Konva+Playwright**: Konva canvas 이벤트는 자동화 도구(Playwright)로 시뮬레이션 어려움. BBox 그리기는 수동 테스트 필요.
