<!-- tags: ai-worker, celery, yolo, training, inference -->
# AI Worker

## 상태: 인프라 구축 완료, 핵심 로직 미구현

## 구조
- `app/celery_app.py` — Celery 앱 ("vision_flow_worker"), Redis 브로커, JSON 직렬화
- `app/config.py` — 브로커 redis://localhost:6379/0, result backend redis://localhost:6379/1
- `app/tasks/training.py` — `train_model(project_id, dataset_version, model_config)` — NotImplementedError
- `app/services/yolo.py` — YOLOService (train, predict, export 모두 스텁)

## 구현 예정
- YOLO 학습: 데이터셋 준비 → Ultralytics train → 결과 저장
- 추론: 이미지 입력 → YOLO predict → 결과 반환
- 모델 내보내기: ONNX, TorchScript, TFLite, CoreML