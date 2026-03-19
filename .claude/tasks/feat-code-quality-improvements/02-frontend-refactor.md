# Frontend 리팩토링

**Status**: Not Started
**Depends on**: None

## Tasks

### React Query 도입
- [ ] React Query 설정 (QueryClient, QueryProvider)
- [ ] 프로젝트/데이터셋 API를 React Query hooks로 전환
- [ ] 이미지/폴더 API를 React Query hooks로 전환

### 대형 컴포넌트 분할
- [ ] DataPoolTab (~800줄) → 컨테이너 + 하위 컴포넌트
- [ ] FolderTreeView (~1000줄) → 트리 + 노드 + 컨텍스트메뉴 + 훅
- [ ] SubsetDetailPage (~480줄) → 헤더 + 이미지그리드 + 클래스패널

### 타입 시스템
- [ ] 로그인 폼 react-hook-form + zod 검증 강화
- [ ] API 응답 타입과 도메인 타입 분리
- [ ] zod 스키마에서 타입 추론 (schema → type)

### 공통 UI
- [ ] 공통 레이아웃 컴포넌트 (헤더, 사이드바)
- [ ] 전역 에러 바운더리

## Done When
- useState+useEffect 패턴이 React Query로 대체됨
- 각 컴포넌트 200줄 이하
- 공통 레이아웃 적용
