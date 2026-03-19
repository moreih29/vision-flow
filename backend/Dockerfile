FROM python:3.13-slim

RUN groupadd -r appuser && useradd -r -g appuser appuser

WORKDIR /app

COPY pyproject.toml ./
RUN pip install --no-cache-dir . && rm -rf /root/.cache

COPY . .

RUN chown -R appuser:appuser /app
USER appuser

EXPOSE 8002
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"]
