# Training Pipeline

## 현재 상태: 스키마 정의 완료, 구현 미시작

Celery 태스크와 YOLO 서비스가 스캐폴딩되어 있으나,
실제 학습/추론 로직은 `NotImplementedError`를 발생시킨다.
요청/응답 스키마는 완전히 정의되어 있다.

## 학습 아키텍처

### 비동기 처리 (Celery)
```
사용자: "학습 시작" 버튼
  │
  ▼
Backend: Celery 태스크 디스패치
  │  (task_name: train_model)
  │  (args: model_type, dataset_path, config)
  ▼
Redis (Broker): 메시지 큐
  │
  ▼
AI Worker (Celery Consumer): 학습 실행
  │  └── Ultralytics YOLO
  │  └── 에포크별 메트릭 기록
  ▼
Redis (Result Backend): 학습 결과 저장
  │
  ▼
Backend: 결과 조회 → 사용자에게 전달
```

### 실시간 모니터링 (SSE) — D004
- **SSE (Server-Sent Events)**: 학습 중 에포크별 메트릭 실시간 스트리밍
- **REST API**: 학습 히스토리 조회 (완료된 학습 기록)
- 역할 분리: SSE는 실시간, REST는 과거 기록

## 지원 모델

### YOLO v11 시리즈
| 모델 | 파라미터 수 | 용도 |
|------|------------|------|
| yolo11n (nano) | ~1.7M | 경량, 모바일/엣지 |
| yolo11s (small) | ~7.2M | 균형잡힌 속도/정확도 |
| yolo11m (medium) | ~20M | 중간 규모 |
| yolo11l (large) | ~43M | 높은 정확도 |
| yolo11x (extra-large) | ~56M | 최고 정확도 |

### 지원 Task Type (YOLO 통합)
- Classification: `yolo11{n,s,m,l,x}-cls`
- Object Detection: `yolo11{n,s,m,l,x}`
- Instance Segmentation: `yolo11{n,s,m,l,x}-seg`
- Pose Estimation: `yolo11{n,s,m,l,x}-pose`

## 학습 설정 (TrainingRequest)

| 파라미터 | 타입 | 기본값 | 설명 |
|---------|------|--------|------|
| model_type | ModelType | 필수 | YOLO 모델 크기 |
| dataset_path | str | 필수 | 학습 데이터 경로 |
| output_path | str | 필수 | 모델 출력 경로 |
| epochs | int | 100 | 학습 에포크 수 |
| batch_size | int | 16 | 배치 크기 |
| image_size | int | 640 | 입력 이미지 크기 |
| device | str | "auto" | 학습 디바이스 (auto/cpu/cuda:N) |

## 학습 메트릭 (TrainingMetrics)

| 메트릭 | 설명 |
|--------|------|
| epoch | 현재 에포크 |
| total_epochs | 전체 에포크 수 |
| box_loss | 바운딩 박스 손실 |
| cls_loss | 분류 손실 |
| dfl_loss | Distribution Focal Loss |
| precision | 정밀도 |
| recall | 재현율 |
| mAP50 | IoU 0.5에서의 mAP |
| mAP50-95 | IoU 0.5~0.95 평균 mAP |

## 모델 내보내기

### 지원 형식
| 형식 | 용도 |
|------|------|
| ONNX | 크로스 플랫폼 추론 |
| TorchScript | PyTorch 기반 배포 |
| TFLite | 모바일/엣지 디바이스 |
| CoreML | Apple 디바이스 |

## 모델 버전 관리 (D016)

시맨틱 버저닝 `vX.Y.Z`:
- **X (Major)**: 클래스 구성 변경 (클래스 추가/제거)
- **Y (Minor)**: 학습 데이터 변경 (이미지 추가/제거)
- **Z (Patch)**: 하이퍼파라미터 변경 (에포크, 배치 크기 등)

예시:
- v1.0.0 → v1.1.0: 학습 이미지 추가
- v1.1.0 → v1.1.1: 에포크 수 변경하여 재학습
- v1.1.1 → v2.0.0: 새 클래스 추가

## 구현 시 고려사항

1. **데이터 준비**: Subset의 이미지 + 라벨을 YOLO 형식으로 변환하는 파이프라인 필요
2. **학습 중단/재개**: Celery 태스크 취소 + 체크포인트 기반 재개
3. **GPU 메모리 관리**: OOM 에러 방지를 위한 배치 크기 자동 조정
4. **학습 로그**: 구조화된 로그로 디버깅 용이성 확보
5. **결과 시각화**: 학습 곡선, 혼동 행렬, 예측 샘플 등
