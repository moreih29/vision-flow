# Backend 모델 + 마이그레이션

**Status**: Not Started
**Depends on**: None

## Tasks

### 모델 리네이밍
- [ ] `models/dataset.py` → `models/data_store.py` (Dataset → DataStore)
- [ ] `models/subset.py` → `models/task.py` (Subset → Task)
- [ ] `models/subset_image.py` → `models/task_image.py` (SubsetImage → TaskImage)
- [ ] `models/label_class.py` — FK `subset_id` → `task_id`
- [ ] `models/image.py` — FK `dataset_id` → `data_store_id`
- [ ] `models/folder_meta.py` — FK `dataset_id` → `data_store_id`
- [ ] `models/project.py` — relationship 이름 업데이트
- [ ] `models/__init__.py` — import 업데이트

### Task 모델 확장
- [ ] `status` 컬럼 추가 (draft, labeling, ready, training, completed)
- [ ] `task` 컬럼명을 `task_type`으로 변경
- [ ] `task_type`을 DB Enum 또는 CHECK 제약조건으로 강화
- [ ] `config` JSONB 컬럼 추가 (nullable, Phase 4 대비)

### Alembic 마이그레이션
- [ ] 마이그레이션 스크립트 작성 (rename_table + alter_column)
- [ ] 마이그레이션 실행 및 검증

## Done When
- 모든 모델 파일이 새 이름으로 존재
- Task 모델에 status, task_type, config 컬럼 존재
- Alembic 마이그레이션 성공
