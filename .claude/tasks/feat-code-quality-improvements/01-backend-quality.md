# Backend 품질 개선

**Status**: Completed
**Depends on**: None

## Tasks

### 보안 (코드 리뷰 기반 — 완료)
- [x] JWT 시크릿 기본값 제거 — 필수 환경변수로 변경 (unplanned)
- [x] IDOR 취약점 수정 — 전 엔드포인트 소유권 검증 추가 (unplanned)
- [x] CORS 와일드카드 제거 — 환경변수 기반 origin 제한 (unplanned)
- [x] 입력 길이 검증 추가 — 전 스키마에 min/max_length 적용 (unplanned)
- [x] `_check_ownership` → `check_ownership` public화 (unplanned)

### 성능 (코드 리뷰 기반 — 완료)
- [x] N+1 쿼리 해결 — list_projects, list_tasks에 JOIN+GROUP BY (unplanned)
- [x] bulk DELETE 적용 — remove_images 루프 삭제 → 단일 쿼리 (unplanned)
- [x] 불필요한 count 쿼리 제거 — 생성 직후 0 직접 설정 (unplanned)
- [x] 응답 빌드 헬퍼 함수 추출 — 라우터 코드 중복 제거 (unplanned)

### 공통 인프라
- [x] 공통 에러 핸들러 — 일관된 에러 응답 형식 (HTTPException → 표준 JSON)
- [x] 구조화된 로깅 — Python 표준 logging + JSON 포맷
- [x] 공통 페이지네이션 스키마 — PaginatedResponse[T] 제네릭 + TaskImageListResponse 적용

### 개선
- [-] Refresh Token 도입 검토 → 별도 이슈로 분리
- [x] 비밀번호 강도 검증 추가 — field_validator (대소문자/숫자/특수문자)
- [-] 배치 작업 트랜잭션 안전성 강화 → 별도 브랜치에서 진행
- [-] 썸네일 생성 파이프라인 → 기능 작업 (Phase 3 이후)
- [-] 이미지 메타데이터 자동 추출 → 기능 작업 (Phase 3 이후)

## Done When
- 모든 API 에러가 동일한 JSON 구조로 반환됨
- 요청마다 구조화된 로그 출력
- 대량 조회 API에 페이지네이션 적용
