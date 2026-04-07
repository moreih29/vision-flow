<!-- tags: tech-stack, dependencies, versions -->
# Tech Stack & Dependencies

## Frontend
| 기술 | 버전 | 용도 |
|------|------|------|
| React | 19.2.4 | UI 프레임워크 |
| React Router | 7.13.1 | 라우팅 |
| TypeScript | 5.9.3 | 타입 시스템 |
| Vite | 8.0.0 | 빌드/번들러 (dev :5273) |
| Tailwind CSS | 4.2.2 | 스타일링 |
| shadcn/ui + Base UI | - | 컴포넌트 라이브러리 |
| Zustand | 5.0.12 | 클라이언트 상태 관리 |
| TanStack React Query | 5.91.2 | 서버 상태 관리 |
| Axios | 1.13.6 | HTTP 클라이언트 |
| Konva + react-konva | 10.2.3 | 캔버스 기반 라벨링 |
| React Hook Form + Zod | 7.71.2 / 4.3.6 | 폼 + 검증 |
| Sonner | 2.0.7 | 토스트 알림 |
| Lucide React | 0.577.0 | 아이콘 |

## Backend
| 기술 | 버전 | 용도 |
|------|------|------|
| FastAPI | 0.115.0 | REST API 프레임워크 |
| SQLAlchemy | 2.0.0 | ORM (async) |
| AsyncPG | 0.30.0 | PostgreSQL async 드라이버 |
| Alembic | 1.14.0 | DB 마이그레이션 |
| Pydantic | 2.12.5 | 스키마 검증 |
| python-jose + bcrypt | 3.3.0 / 4.2.0 | JWT 인증 |
| Pillow | 11.0.0 | 이미지 처리 |
| Ruff | 0.9.0 | 린터 |

## AI Worker
| 기술 | 버전 | 용도 |
|------|------|------|
| Celery | 5.4.0 | 비동기 태스크 큐 |
| Ultralytics | 8.3.0 | YOLO 모델 학습/추론 |

## Infrastructure
| 기술 | 버전 | 용도 |
|------|------|------|
| PostgreSQL | 16 | 메인 DB (port 5433) |
| Redis | 7 | 캐싱 + Celery 브로커 (port 6379) |
| Docker Compose | - | 개발 인프라 |