# AI Worker Architecture

## 기술 스택

- **Python 3.11+**: 런타임
- **FastAPI**: 헬스체크 및 직접 추론 요청용 HTTP 서버
- **Celery**: 비동기 작업 큐 (학습 작업 처리)
- **Redis**: Celery 브로커(작업 큐) + 결과 백엔드
- **Ultralytics**: YOLO 모델 학습/추론/내보내기
- **Pillow**: 이미지 전처리

## 현재 상태: 스캐폴드 완료, 구현 미완

모든 핵심 서비스 메서드가 `NotImplementedError`를 발생시킨다.
스키마(요청/응답)는 완전히 정의되어 있으며, 아키텍처 설계는 확정되었다.

## 디렉토리 구조

```
ai-worker/
├── app/
│   ├── main.py         # FastAPI 앱 (헬스체크만)
│   ├── config.py       # Settings (Redis URL, 스토리지 경로)
│   ├── celery_app.py   # Celery 인스턴스 (Redis broker/backend)
│   ├── tasks/
│   │   └── training.py # train_model Celery 태스크 (스텁)
│   ├── services/
│   │   └── yolo.py     # YOLOService: train, predict, export (스텁)
│   └── schemas/
│       └── training.py # 학습/추론 스키마 (완전 정의)
└── pyproject.toml
```

## 통신 패턴

```
Backend
  │
  │  Celery Task Dispatch
  │  (task_name, args, kwargs)
  ▼
Redis (Broker)
  │
  │  Message Queue
  ▼
AI Worker (Celery Consumer)
  │
  │  학습 결과
  ▼
Redis (Result Backend)
  │
  │  결과 조회
  ▼
Backend (polling 또는 callback)
```

### Redis 데이터베이스 분리
- **DB 0**: Celery 브로커 (작업 큐)
- **DB 1**: Celery 결과 백엔드

## 스키마 정의 (구현 예정)

### 지원 모델 타입
- yolo11n, yolo11s, yolo11m, yolo11l, yolo11x
- 크기순으로 nano → extra-large (속도 ↔ 정확도 트레이드오프)

### 지원 내보내기 형식
- ONNX, TorchScript, TFLite, CoreML

### 학습 메트릭 (실시간 스트리밍 예정)
- epoch, total_epochs
- box_loss, cls_loss, dfl_loss
- precision, recall
- mAP50, mAP50-95

### 학습 요청 (TrainingRequest)
- model_type, dataset_path, output_path
- epochs, batch_size, image_size
- device (auto/cpu/cuda:N)

### 추론 요청 (InferenceRequest)
- model_path, image_path
- confidence threshold, iou threshold

### 추론 결과 (DetectionBox)
- x1, y1, x2, y2 (bounding box)
- confidence, class_id, class_name

## 설계 의도

### 비동기 학습의 필요성
- Vision AI 모델 학습은 수 시간~수 일이 걸릴 수 있다.
- 브라우저 닫기, 네트워크 끊김 등에도 학습이 중단되어서는 안 된다.
- Celery를 통한 비동기 처리로 이 문제를 해결한다.

### GPU 서버 분리 가능
- AI Worker는 Backend와 독립적으로 배포할 수 있도록 설계되었다.
- GPU가 있는 별도 서버에서 AI Worker를 실행하고, Redis를 통해 통신한다.
- 이 구조는 CPU 집약적 웹 서버와 GPU 집약적 학습을 물리적으로 분리한다.

### SSE 기반 실시간 모니터링 (예정)
- 학습 중 에포크별 메트릭을 SSE로 프론트엔드에 스트리밍한다.
- REST API는 학습 히스토리 조회에 사용한다.
- SSE는 실시간, REST는 과거 기록 — 역할을 분리한다 (D004).

## 구현 시 고려사항

1. **Celery 태스크 멱등성**: 같은 태스크가 중복 실행되어도 안전해야 함
2. **학습 데이터 경로**: Backend의 스토리지와 AI Worker가 같은 파일시스템을 바라보거나, 데이터 전송 메커니즘 필요
3. **모델 버전 관리**: 학습된 모델의 버전을 체계적으로 관리 (시맨틱 버저닝 D016)
4. **에러 복구**: 학습 중 실패 시 재시도 로직, 체크포인트 복원 등
5. **리소스 제한**: GPU 메모리, 디스크 공간 등의 자원 한계 모니터링
