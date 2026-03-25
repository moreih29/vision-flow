<!-- tags: ai-worker, celery, yolo, training, ml -->
<!-- tags: ai-worker, celery, yolo, training, inference -->

# AI Worker

## 역할

비동기 ML 작업 처리. Backend가 Celery task를 발행하면 Worker가 실행.

## 기술 스택

- **Celery**: 분산 태스크 큐 (Redis broker/backend)
- **Ultralytics**: YOLO 모델 학습/추론
- **FastAPI**: 상태 조회 API (독립 엔드포인트)

## 디렉토리

```
ai-worker/app/
├── celery_app.py      # Celery 인스턴스 설정
├── config.py          # pydantic-settings 환경 설정
├── main.py            # FastAPI 상태 API
├── tasks/
│   └── training.py    # 학습 태스크 (TODO: 구현 중)
├── services/
│   └── yolo.py        # YOLO 래퍼 서비스
└── schemas/           # 요청/응답 스키마
```

## 현재 상태

- `train_model` 태스크: 인터페이스만 정의됨, 구현 미완 (`NotImplementedError`)
- Celery 설정: JSON 직렬화, UTC, task_track_started 활성
- 태스크 자동 발견: `app.tasks` 패키지
