# 도메인 구조 변경: DataStore + Task

**Branch**: `refactor/domain-restructure`
**Created**: 2026-03-19

## Goal
`Project > Dataset(Data Pool) > Subset` 구조를 `Project > DataStore > Task`로 변경.
용어와 실제 역할의 불일치를 해소하고, Phase 3(Labeling) ~ Phase 5(Pipeline)까지의 확장에 대비.

## Phases

| # | File | Status | Description |
|---|------|--------|-------------|
| 1 | [01-backend-models](./01-backend-models.md) | Completed | 모델 리네이밍 + Task status 추가 + Alembic 마이그레이션 |
| 2 | [02-backend-api](./02-backend-api.md) | Completed | 스키마, 서비스, 라우터 리네이밍 |
| 3 | [03-frontend](./03-frontend.md) | Completed | 타입, API, 페이지, 컴포넌트 리네이밍 |
| 4 | [04-tests](./04-tests.md) | Completed | 테스트 업데이트 + 전체 검증 |

## 매핑

| 현재 | 변경 후 |
|------|---------|
| Dataset (Data Pool) | DataStore |
| Subset | Task |
| SubsetImage | TaskImage |
| LabelClass.subset_id | LabelClass.task_id |
