# Frontend 리네이밍

**Status**: Not Started
**Depends on**: 02-backend-api

## Tasks

### 타입
- [ ] `types/dataset.ts` → `types/dataStore.ts`
- [ ] `types/subset.ts` → `types/task.ts` (+ status, taskType, config)

### API 레이어
- [ ] `api/datasets.ts` → `api/dataStores.ts` (엔드포인트 URL 변경)
- [ ] `api/subsets.ts` → `api/tasks.ts`

### 페이지
- [ ] `DatasetDetailPage.tsx` → `DataStoreDetailPage.tsx`
- [ ] `SubsetDetailPage.tsx` → `TaskDetailPage.tsx`
- [ ] 라우터 경로 업데이트 (App.tsx)

### 컴포넌트
- [ ] `DataPoolTab.tsx` — "Data Pool" → "DataStore" UI 텍스트 변경
- [ ] `ImageSelectionModal.tsx` — subset 참조를 task로 변경
- [ ] 기타 컴포넌트에서 dataset/subset 참조 일괄 변경

## Done When
- 프론트엔드 빌드 에러 없음
- UI에서 DataStore/Task 용어로 표시
