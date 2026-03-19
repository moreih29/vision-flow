# Development Environment

## 필수 도구

- **Node.js 18+**: Frontend 빌드
- **Python 3.11+**: Backend 및 AI Worker 실행
- **Docker & Docker Compose**: 인프라 서비스 실행
- **Git**: 버전 관리

## 인프라 서비스 (Docker Compose)

`docker/docker-compose.dev.yml`으로 개발용 인프라 실행:

```bash
cd docker
docker compose -f docker-compose.dev.yml up -d
```

### PostgreSQL 16
- **포트**: 5433 (기본 5432 충돌 방지)
- **데이터베이스**: vision_flow
- **인증**: 환경변수로 설정 (POSTGRES_USER, POSTGRES_PASSWORD)
- **볼륨**: `postgres_data` (영구)
- **헬스체크**: `pg_isready`

### Redis 7
- **포트**: 6379 (기본)
- **볼륨**: `redis_data` (영구)
- **헬스체크**: `redis-cli ping`
- **용도**: Celery 브로커 + 결과 백엔드, 향후 캐시

## 애플리케이션 실행 (호스트에서 직접)

### Backend

```bash
cd backend
# 가상환경 설정
python -m venv .venv
source .venv/bin/activate

# 의존성 설치
pip install -e ".[dev]"

# 환경변수 설정
cp .env.example .env  # 필요 시 편집

# DB 마이그레이션
alembic upgrade head

# 서버 실행
uvicorn app.main:app --host 0.0.0.0 --port 8002 --reload
```

### Frontend

```bash
cd frontend
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev
# → http://localhost:5174
```

### AI Worker (필요 시)

```bash
cd ai-worker
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Celery Worker 실행
celery -A app.celery_app worker --loglevel=info

# FastAPI 서버 (추론 API, 별도)
uvicorn app.main:app --host 0.0.0.0 --port 8003 --reload
```

## Vite 프록시 설정

Frontend 개발 서버가 API 요청을 Backend로 프록시:

```typescript
// vite.config.ts
server: {
  proxy: {
    '/api': {
      target: 'http://localhost:8002',
      changeOrigin: true
    }
  }
}
```

- Frontend에서 `/api/v1/*` 요청 → `localhost:8002/api/v1/*`로 전달
- CORS 문제 없이 개발 가능

## 환경변수 (.env)

### Backend (.env)
```
DATABASE_URL=postgresql+asyncpg://user:pass@localhost:5433/vision_flow
REDIS_URL=redis://localhost:6379/0
JWT_SECRET_KEY=<secret>
JWT_ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_DAYS=7
STORAGE_TYPE=local
STORAGE_BASE_PATH=./data/storage
```

## .gitignore 주요 항목

- `.omc/` - 오케스트레이션 상태
- `__pycache__/`, `*.pyc` - Python 캐시
- `node_modules/` - Node 패키지
- `.env` - 환경변수 (비밀 포함)
- `*.jpg`, `*.png`, `*.jpeg` (frontend/src/assets 제외) - 업로드 이미지
- `*.pt`, `*.onnx`, `*.tflite` - 모델 가중치
- `data/` - 스토리지 데이터
