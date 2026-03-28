<!-- tags: backend, frontend, versioning -->
<!-- tags: backend, frontend, versioning -->
# 버전 관리 시스템

Git-like 버전 관리 (스냅샷 기반)

## 핵심 개념

- **Snapshot**: 특정 시점의 태스크 상태 (이미지 + 폴더 구조 + 클래스 + 어노테이션)
- **HEAD**: `task.current_snapshot_id`가 가리키는 현재 스냅샷
- **Dirty**: 현재 상태와 HEAD 스냅샷의 해시 불일치
- **Stash**: dirty 상태에서 다른 버전 복원 시 자동 생성되는 임시 저장

## 버전 번호
Major.Minor (v1.0, v1.1, v2.0). Major = 클래스 변경 시 +1, Minor = 데이터만 변경 시 +1.

## Dirty Detection

3가지 해시 비교:
- `class_schema_hash`: 클래스 이름 정렬 후 SHA-256
- `image_set_hash`: (image_id, folder_path) 튜플 정렬 후 SHA-256
- `annotation_hash`: (image_id, folder_path) 기준 정렬 + 어노테이션 데이터 SHA-256

빠른 판별: count 비교 우선 (image_count, class_count). 불일치 시 해시 계산 생략하고 즉시 dirty 반환.

## Stash (git stash 대응)

- 생성: 다른 버전 복원 시 dirty면 자동 stash 생성 + `restored_from_id = 원래 HEAD`
- 복원: stash 데이터 적용 + `current_snapshot_id = stash.restored_from_id` (원래 HEAD) + stash 삭제 (pop)
- skip_stash: "변경사항 버리기" 시 stash 생성 없이 복원

## 복원 (Restore)

1. 기존 TaskImage, LabelClass, TaskFolderMeta 전체 삭제
2. 스냅샷 아이템에서 재생성
3. `current_snapshot_id` 업데이트
4. 해시 재계산 후 스냅샷에 저장 (복원 후 dirty=false 보장)

## version-status API 응답

```json
{
  "current_version": "v5.0",
  "current_snapshot_id": 42,
  "is_dirty": true,
  "changes": {"data_changed": true, "class_changed": false},
  "counts": {"image_added": 5, "image_removed": 2, "image_moved": 0, "class_added": 0, "class_removed": 0}
}
```

## Frontend

- 헤더 칩: `v5.0` / `v5.0*` (dirty). 클릭 → 버전 팝오버
- 팝오버: 타임라인 커밋 로그 (수직선 + ●/○ dot, HEAD 마커)
- dirty 배너: count 요약 + "버전 생성" + "변경사항 버리기"
- 복원 중 오버레이: 뷰어 전체 차단 + 스피너

## 소스 파일

- Backend: `backend/app/services/snapshot.py`, `backend/app/models/task_snapshot.py`, `backend/app/routers/snapshots.py`
- Frontend: `frontend/src/components/task-detail/VersionPanel.tsx`, `frontend/src/hooks/use-snapshots.ts`, `frontend/src/types/snapshot.ts`
