# Phase F: Infrastructure & DevOps

## 목표
프로덕션 배포를 위한 인프라를 구축하고, 개발 워크플로를 자동화한다.

## 작업 항목

### F-1. 개발 인프라 (우선)
- [x] `docker/docker-compose.dev.yml` — PostgreSQL 16 + Redis 7
- [x] `.env.example` 각 서비스별 작성
- [x] 전체 서비스 일괄 시작 스크립트 (`scripts/dev-start.sh`)
- [x] 전체 서비스 일괄 중지 스크립트 (`scripts/dev-stop.sh`)
- [x] DB 초기화 스크립트 (`scripts/db-reset.sh`)

### F-2. Dockerfile 작성
- [x] `frontend/Dockerfile`
  - Multi-stage build: Node → Nginx
  - Vite 빌드 → 정적 파일
  - Nginx 설정 (SPA fallback)
- [x] `backend/Dockerfile`
  - Python 3.13 slim 기반
  - 의존성 설치 + uvicorn 실행
  - 비루트 사용자 실행
- [x] `ai-worker/Dockerfile`
  - CPU 전용 기본 이미지
  - Python 의존성 + Celery Worker 실행
  - GPU 버전은 별도 Dockerfile.gpu로 안내

### F-3. 프로덕션 Docker Compose
- [x] `docker/docker-compose.prod.yml`
  - 전체 서비스 정의 (Frontend, Backend, AI Worker, PostgreSQL, Redis)
  - 볼륨 설정 (데이터 영속성)
  - 헬스체크
  - 리소스 제한 (메모리, CPU)
- [x] 환경변수 분리 (.env.prod)

### F-4. 리버스 프록시
- [x] Nginx 설정
  - `/` → Frontend 정적 파일 (SPA fallback)
  - `/api/*` → Backend proxy
  - SSE 엔드포인트 전용 설정
  - 정적 파일 캐싱 (30일)
  - gzip 압축
  - 요청 크기 제한 (100MB)
- [ ] SSL/TLS (Let's Encrypt) — 배포 시 설정

### F-5. CI/CD (선택)
- [ ] GitHub Actions 워크플로
  - PR 시: 린트 + 테스트 + 타입체크
  - 머지 시: Docker 이미지 빌드 + 푸시
  - 태그 시: 프로덕션 배포
- [ ] Docker 이미지 레지스트리 (GHCR 또는 DockerHub)

### F-6. 모니터링 & 로깅 (선택)
- [ ] 구조화된 로그 출력 (JSON 형식)
- [ ] 로그 수집 (선택: ELK, Loki 등)
- [ ] 메트릭 수집 (선택: Prometheus + Grafana)
- [ ] 알림 설정 (학습 완료/실패, 서버 다운)

### F-7. 백업 전략
- [ ] PostgreSQL 정기 백업 (pg_dump cron)
- [ ] 이미지 스토리지 백업 (rsync 또는 S3 미러)
- [ ] 학습된 모델 백업
- [ ] 복원 절차 문서화

## 우선순위

```
F-1 (개발 인프라) ← 즉시 필요
  │
  ▼
F-2 (Dockerfile) ← 프로덕션 전 필수
  │
  ▼
F-3 (Prod Compose) + F-4 (리버스 프록시) ← 배포 시 필요
  │
  ▼
F-5 (CI/CD) + F-6 (모니터링) + F-7 (백업) ← 운영 안정성
```

## 완료 기준
- [x] Docker Compose로 전체 서비스 일괄 실행 가능
- [x] Dockerfile 빌드 성공 (각 서비스)
- [ ] 프로덕션 환경에서 HTTPS 접근 가능
- [ ] 자동 백업 동작 확인
