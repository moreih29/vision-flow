# Deployment Strategy

## 현재 상태

프로덕션 배포 인프라는 아직 구축되지 않았다.
개발 환경에서는 Docker Compose로 PostgreSQL/Redis만 실행하고,
애플리케이션은 호스트에서 직접 실행한다.

## 목표 배포 아키텍처 (로드맵 Phase 5)

```
                    ┌─────────────┐
                    │   Reverse   │
                    │   Proxy     │
                    │  (Nginx/    │
                    │   Caddy)    │
                    └──────┬──────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
        ┌─────▼─────┐ ┌───▼───┐ ┌─────▼─────┐
        │ Frontend  │ │Backend│ │ AI Worker │
        │ (Static)  │ │(API)  │ │ (GPU)     │
        └───────────┘ └───┬───┘ └─────┬─────┘
                           │            │
                     ┌─────▼─────┐     │
                     │PostgreSQL │     │
                     └───────────┘     │
                     ┌─────────────┐   │
                     │   Redis     │◀──┘
                     └─────────────┘
```

## 배포 전략 설계 원칙

### 1. 서비스 분리 배포
- Frontend: 정적 파일 빌드 후 CDN/Nginx에서 서빙
- Backend: 컨테이너화하여 API 서버로 배포
- AI Worker: GPU가 있는 서버에 별도 배포 (Celery Worker)
- 인프라(DB, Redis): 관리형 서비스 또는 자체 호스팅

### 2. AI Worker의 GPU 서버 분리 (D001)
- 학습/추론은 GPU가 필수이므로 별도 서버에서 실행
- CPU 서버(Backend)와 GPU 서버(AI Worker)의 물리적 분리
- Redis를 통한 비동기 통신으로 서버 간 결합도 최소화
- MinIO 대신 로컬 스토리지를 사용하는 이유: GPU와 CPU 경쟁 방지

### 3. 단계적 배포
- **1단계 (현재)**: 단일 머신, Docker Compose
- **2단계**: Docker 멀티 컨테이너 (Dockerfile 작성 필요)
- **3단계**: GPU 서버 분리, 스토리지 공유 방안 결정
- **4단계**: SaaS 배포 (멀티 테넌트, 스케일링)

## 필요한 작업 (미완)

### Dockerfile 작성
- `frontend/Dockerfile`: Vite 빌드 → Nginx 서빙
- `backend/Dockerfile`: uvicorn 실행
- `ai-worker/Dockerfile`: Celery Worker + GPU 지원 (CUDA)

### docker-compose.prod.yml
- 프로덕션용 Compose 파일
- 환경변수 분리 (.env.prod)
- 네트워크 격리
- 헬스체크 강화
- 볼륨 백업 전략

### 리버스 프록시
- Nginx 또는 Caddy
- SSL/TLS 인증서 (Let's Encrypt)
- API 라우팅 (/api → Backend, / → Frontend)
- 정적 파일 캐싱

### 모니터링
- 로그 수집 (구조화된 로깅)
- 메트릭 수집 (Prometheus + Grafana 고려)
- 알림 설정 (학습 완료/실패, 서버 다운 등)

### 백업
- PostgreSQL 정기 백업
- 이미지 스토리지 백업
- 학습된 모델 백업

## 고려사항

### 스토리지 공유
- Backend와 AI Worker가 같은 파일 시스템을 바라봐야 함
- 단일 머신: 동일 볼륨 마운트
- 분리 서버: NFS, S3, 또는 데이터 전송 메커니즘 필요
- 향후 `S3Storage` 구현으로 해결 가능

### 환경 분리
- 개발(dev), 스테이징(staging), 프로덕션(prod) 환경 분리
- 환경별 설정 파일 (.env.dev, .env.staging, .env.prod)
- 데이터베이스 인스턴스 분리
