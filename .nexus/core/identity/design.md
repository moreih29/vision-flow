<!-- tags: design, principles, architecture, philosophy -->
# Design Principles

## 계층 분리
- Frontend / Backend / AI Worker 를 독립 모듈로 분리
- Backend는 Router → Service → Model 계층을 엄격히 준수
- AI Worker는 Celery로 비동기 처리, Backend과 느슨하게 결합

## 사용자 경험 우선
- 비개발자도 사용할 수 있는 직관적 UI
- shadcn/ui 기반의 일관된 컴포넌트 체계
- Konva 캠버스로 네이티브 수준의 라벨링 경험 제공

## 데이터 관리 철학
- 프로젝트 → 데이터 스토어 → 이미지 계층 구조
- 태스크는 데이터 스토어에서 이미지를 참조하여 사용
- 스냅샷으로 라벨링 상태를 버전 관리

## 기술 선택 근거
- Async 우선: FastAPI + AsyncPG로 이미지 대량 처리 시 I/O 병목 최소화
- 로컬 우선 스토리지: 초기에는 파일시스템 저장, StorageBackend 추상화로 향후 S3 등 확장 가능
- Redis 이중 역할: 캐싱 + Celery 브로커