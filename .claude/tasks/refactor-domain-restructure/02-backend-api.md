# Backend 스키마 + 서비스 + 라우터

**Status**: Not Started
**Depends on**: 01-backend-models

## Tasks

### 스키마 리네이밍
- [ ] `schemas/dataset.py` → `schemas/data_store.py`
- [ ] `schemas/subset.py` → `schemas/task.py` (+ status, task_type, config 필드)

### 서비스 리네이밍
- [ ] `services/dataset.py` → `services/data_store.py`
- [ ] `services/subset.py` → `services/task.py`

### 라우터 리네이밍
- [ ] `routers/datasets.py` → `routers/data_stores.py` (엔드포인트: /data-stores)
- [ ] `routers/subsets.py` → `routers/tasks.py` (엔드포인트: /tasks)
- [ ] `routers/label_classes.py` — subset 참조를 task로 변경
- [ ] `routers/images.py` — dataset 참조를 data_store로 변경
- [ ] `routers/folders.py` — dataset 참조를 data_store로 변경
- [ ] `app/main.py` — 라우터 등록 업데이트

### Enums
- [ ] `enums.py` — TaskType 유지, TaskStatus 추가

## Done When
- 모든 API 엔드포인트가 새 이름으로 동작
- Swagger 문서에서 DataStore/Task 용어 확인
