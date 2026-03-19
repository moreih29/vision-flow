# Phase E: AI Worker Migration

## 목표
기존 AI Worker 스캐폴딩을 마이그레이션하고, 미구현 기능의 구현 계획을 수립한다.

## 현재 상태 (기존 레포)
- Celery 앱 + Redis 설정: 완료
- 학습 태스크 (`train_model`): 스텁 (NotImplementedError)
- YOLO 서비스 (`train`, `predict`, `export`): 스텁 (NotImplementedError)
- 스키마 (Training/Inference): 완전 정의

## 작업 항목

### E-1. 기반 마이그레이션
- [x] Celery 앱 설정 (Redis broker/backend)
- [x] FastAPI 헬스체크 엔드포인트
- [x] 설정 시스템 (config.py)
- [x] 스키마 마이그레이션 (TrainingRequest, TrainingMetrics, InferenceRequest 등)
- [ ] **개선**: 설정 검증 강화 (pydantic-settings)
- [ ] **개선**: 구조화된 로깅 (Backend와 동일한 패턴)

### E-2. 데이터 준비 파이프라인 (신규)
- [ ] Subset → YOLO 데이터셋 변환기
  - 이미지 파일 복사/심볼릭 링크
  - 라벨 파일 생성 (YOLO 형식)
  - data.yaml 생성 (클래스 목록, 경로)
- [ ] Train/Val 분할 로직
- [ ] 데이터 검증 (라벨-이미지 매칭 확인)

### E-3. 학습 파이프라인 구현
- [ ] `train_model` Celery 태스크 구현
  - Ultralytics YOLO API 호출
  - 콜백으로 에포크별 메트릭 수집
  - 메트릭을 Redis에 저장 (SSE용)
  - 학습 완료 시 결과 저장
- [ ] 학습 중단/취소 메커니즘
- [ ] 체크포인트 기반 학습 재개
- [ ] GPU 디바이스 자동 감지

### E-4. 추론 파이프라인 구현
- [ ] 단일 이미지 추론 API
- [ ] 배치 추론 API
- [ ] 추론 결과 포맷 (DetectionBox 등)
- [ ] 모델 로딩 캐싱 (메모리에 유지)

### E-5. 모델 관리
- [ ] 모델 저장/조회 API
- [ ] 모델 버전 관리 (시맨틱 버저닝)
- [ ] 모델 내보내기 (ONNX, TorchScript, TFLite, CoreML)
- [ ] 모델 메타데이터 (학습 설정, 성능 메트릭)

### E-6. Backend 연동
- [ ] Backend → AI Worker 학습 요청 API
- [ ] Backend ← AI Worker 학습 상태 조회 API
- [ ] SSE 엔드포인트 (실시간 학습 메트릭 스트리밍)
- [ ] 학습 히스토리 REST API

## 구현 우선순위

```
E-1 (기반) → E-2 (데이터 준비) → E-3 (학습) → E-4 (추론)
                                                    │
                                               E-5 (모델 관리)
                                                    │
                                               E-6 (Backend 연동)
```

- E-1, E-2는 라벨링 기능(Phase 3) 없이도 더미 데이터로 테스트 가능
- E-3은 Phase 3(라벨링) 완료 후 실제 데이터로 검증
- E-4, E-5는 E-3 이후 순차 진행

## 완료 기준
- [ ] Celery Worker가 정상 시작
- [ ] 더미 데이터로 YOLO 학습 성공
- [ ] 학습 메트릭 Redis 저장 확인
- [ ] 추론 API 응답 확인
- [ ] 모델 내보내기 성공
