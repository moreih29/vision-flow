<!-- tags: architecture, data-flow, api, modules -->
# Architecture Overview

## 모듈 구조

```
frontend/    → React SPA (Vite dev server :5273)
    ↓ HTTP (Axios, /api/v1 → proxy to :8100)
backend/     → FastAPI REST API (:8100)
    ↓ AsyncPG          ↓ Redis
PostgreSQL 16 (:5433)  Redis 7 (:6379)
    ↑                   ↑ Celery broker
ai-worker/   → Celery Worker (Ultralytics YOLO)
```

## 데이터 흐름

1. **인증**: Frontend → POST /auth/login → JWT 발급 → localStorage 저장 → Axios interceptor가 Bearer 헤더 자동 첨부
2. **이미지 업로드**: Frontend → POST /images/{dataStoreId} → Backend image service (해시, 리사이즈, 썸네일) → 로컬 파일시스템 저장
3. **라벨링**: TaskImage로 이미지 참조 → Konva 캔버스에서 어노테이션 → POST /annotations → DB 저장
4. **스냅샷**: 라벨링 상태를 TaskSnapshot으로 버전 관리 (diff 기반)
5. **학습** (미구현): Backend가 Celery task 큐잉 → AI Worker가 YOLO 학습 실행

## 핵심 엔티티 관계

```
User ─┬─ owns ──→ Project ─┬─ has ──→ DataStore ──→ Image
      │                     └─ has ──→ Task ─┬─ refs ──→ TaskImage (→ Image)
      │                                      ├─ has ──→ LabelClass
      │                                      ├─ has ──→ Annotation
      │                                      └─ has ──→ TaskSnapshot ──→ TaskSnapshotItem
      └─ uploads ──→ Image
```

## API 구조

모든 엔드포인트: `/api/v1` prefix
- `/auth` — 인증 (register, login, me)
- `/projects` — 프로젝트 CRUD
- `/data-stores` — 데이터 스토어 관리
- `/tasks` — 태스크 CRUD, 이미지 관리, 폴더 연산
- `/images` — 이미지 업로드, 조회, 썸네일
- `/label-classes` — 라벨 클래스 CRUD
- `/annotations` — 어노테이션 CRUD
- `/snapshots` — 스냅샷 생성/조회