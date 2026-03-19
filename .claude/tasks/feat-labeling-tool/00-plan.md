# Phase 3: Labeling Tool + Tech Debt

**Branch**: `feat/labeling-tool`
**Created**: 2026-03-19

## Goal
라벨링 에디터 MVP 구현 (Classification + BBox) 및 대형 컴포넌트 기술 부채 해결.

## Parallel Groups

| Group | Tasks | 선행 조건 |
|-------|-------|-----------|
| **P0** | C1 (TaskStatus enum) | None |
| **P1** | A1 (DataPoolTab), A2 (FolderTreeView), B1 (Annotation 모델) | None |
| **P2** | B2 (Annotation API) | B1 |
| **P3** | C2 (LabelingPage scaffold), B3 (labeled_count) | C1, B2 |
| **P4** | C3 (Canvas core) | C2 |
| **P5** | C4 (Classification), C5 (BBox) | C3+B2 |
| **P6** | C6 (Undo/Redo + 자동저장) | C4, C5 |

## Phases

| # | Task | Status | Size | 독립성 |
|---|------|--------|------|--------|
| C1 | TaskStatus enum FE/BE 일치 | Not Started | S | 독립 |
| A1 | DataPoolTab 분할 + React Query | Not Started | L | 독립 |
| A2 | FolderTreeView 분할 | Not Started | M | 독립 |
| B1 | Annotation 모델 + Alembic | Not Started | M | 독립 |
| B2 | Annotation CRUD API + FE API | Not Started | M | B1 |
| C2 | konva 설치 + LabelingPage scaffold | Not Started | M | C1 |
| B3 | labeled_count/label_count 실계산 | Not Started | S | B2 |
| C3 | Konva 캔버스 + Zoom/Pan | Not Started | L | C2 |
| C4 | Classification 도구 | Not Started | M | C3+B2 |
| C5 | BBox 도구 | Not Started | L | C3+B2 |
| C6 | Undo/Redo + 자동저장 | Not Started | M | C4,C5 |

## Scope 외 (Phase 4+)
- Instance Segmentation (polygon tool)
- Pose Estimation (keypoint + skeleton)
- AI 보조 라벨링 (SAM, Grounding DINO)
- YOLO 포맷 export
