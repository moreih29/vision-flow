# Backend 품질 개선

**Status**: Not Started
**Depends on**: None

## Tasks

### 공통 인프라
- [ ] 공통 에러 핸들러 — 일관된 에러 응답 형식 (HTTPException → 표준 JSON)
- [ ] 구조화된 로깅 — structlog/loguru 도입
- [ ] 공통 페이지네이션 스키마 — 커서 기반 표준화

### 개선
- [ ] Refresh Token 도입 검토 (현재 Access Token 7일은 보안 약점)
- [ ] 비밀번호 강도 검증 추가
- [ ] 배치 작업 트랜잭션 안전성 강화
- [ ] 썸네일 생성 파이프라인 (업로드 시 자동 생성)
- [ ] 이미지 메타데이터 자동 추출 (width, height)

## Done When
- 모든 API 에러가 동일한 JSON 구조로 반환됨
- 요청마다 구조화된 로그 출력
- 대량 조회 API에 페이지네이션 적용
