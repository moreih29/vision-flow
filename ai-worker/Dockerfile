# CPU 버전 (기본)
FROM python:3.13-slim

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir . && rm -rf /root/.cache

COPY . .

RUN mkdir -p /app/data && chown -R appuser:appuser /app
USER appuser

CMD ["celery", "-A", "app.celery_app", "worker", "--loglevel=info"]

# GPU 버전: nvidia/cuda:12.4.1-runtime-ubuntu22.04 기반으로 빌드
# docker build -f Dockerfile.gpu -t vision-flow-worker-gpu .
