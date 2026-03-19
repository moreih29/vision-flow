# Database Schema

## DBMS

PostgreSQL 16 (비동기 드라이버: asyncpg)

## Entity-Relationship Diagram

```
┌─────────┐     1:N     ┌──────────┐     1:N     ┌─────────────┐
│  users  │────────────▶│ projects │────────────▶│ data_stores │
└─────────┘             └──────────┘             └─────────────┘
                              │                       │
                              │ 1:N                   │ 1:N
                              ▼                       ▼
                        ┌──────────┐            ┌──────────┐
                        │  tasks   │            │  images  │
                        └──────────┘            └──────────┘
                              │                    ▲    │
                              │ 1:N          M:N   │    │ 1:N (implicit)
                              ▼                    │    ▼
                     ┌──────────────┐    ┌───────────────┐
                     │label_classes │    │  task_images   │
                     └──────────────┘    └───────────────┘
                                               │
                                     DataStore 1:N
                                          ┌────────────┐
                                          │ folder_meta │
                                          └────────────┘
```

## 테이블 정의

### users
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 사용자 ID |
| email | VARCHAR | UNIQUE, NOT NULL | 로그인 이메일 |
| name | VARCHAR | NOT NULL | 표시 이름 |
| hashed_password | VARCHAR | NOT NULL | bcrypt 해시 |
| is_admin | BOOLEAN | DEFAULT false | 관리자 여부 |
| is_active | BOOLEAN | DEFAULT true | 활성 여부 |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |
| updated_at | TIMESTAMP | NOT NULL | 수정 시간 |

### projects
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 프로젝트 ID |
| name | VARCHAR | NOT NULL | 프로젝트 이름 |
| description | TEXT | NULLABLE | 설명 |
| owner_id | UUID | FK → users.id | 소유자 |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |
| updated_at | TIMESTAMP | NOT NULL | 수정 시간 |

### data_stores
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | DataStore ID |
| name | VARCHAR | NOT NULL | DataStore 이름 |
| description | TEXT | NULLABLE | 설명 |
| project_id | UUID | FK → projects.id | 소속 프로젝트 |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |
| updated_at | TIMESTAMP | NOT NULL | 수정 시간 |

- DataStore는 프로젝트의 원본 데이터 저장소 역할을 한다.
- 원본 이미지를 보관하며, 버전 관리 없이 자유롭게 추가/삭제 가능.

### images
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 이미지 ID |
| original_filename | VARCHAR | NOT NULL | 원본 파일명 |
| storage_key | VARCHAR | NOT NULL | 스토리지 경로 (해시 기반) |
| file_hash | VARCHAR | INDEXED | SHA-256 해시 (중복 감지) |
| file_size | INTEGER | NOT NULL | 파일 크기 (bytes) |
| width | INTEGER | NULLABLE | 이미지 너비 |
| height | INTEGER | NULLABLE | 이미지 높이 |
| mime_type | VARCHAR | NOT NULL | MIME 타입 |
| folder_path | VARCHAR | INDEXED, DEFAULT '' | 폴더 경로 |
| data_store_id | UUID | FK → data_stores.id | 소속 DataStore |
| uploaded_by | UUID | FK → users.id | 업로더 |
| created_at | TIMESTAMP | NOT NULL | 업로드 시간 |

- `storage_key`는 UNIQUE가 아님: 해시 기반 중복 제거로 여러 레코드가 같은 물리 파일을 참조할 수 있음.
- `file_hash` 인덱싱으로 빠른 중복 검사 가능.
- `folder_path` 인덱싱으로 빠른 폴더 탐색 가능.

### tasks
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | Task ID |
| name | VARCHAR | NOT NULL | Task 이름 |
| description | TEXT | NULLABLE | 설명 |
| task_type | VARCHAR(50) | NOT NULL | 작업 유형 (TaskType enum) |
| status | VARCHAR(20) | NOT NULL, DEFAULT 'draft' | 상태 (TaskStatus enum) |
| project_id | UUID | FK → projects.id | 소속 프로젝트 |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |
| updated_at | TIMESTAMP | NOT NULL | 수정 시간 |

- **TaskType**: classification, object_detection, instance_segmentation, pose_estimation
- **TaskStatus**: draft, labeling, ready, training, completed
- Task 생성 시 task_type을 지정하며, 이후 변경 불가 (D013).
- status는 워크플로 단계를 추적한다 (draft → labeling → ready → training → completed).

### task_images (M:N 조인 테이블)
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 레코드 ID |
| task_id | UUID | FK → tasks.id | Task |
| image_id | UUID | FK → images.id | 이미지 |
| added_at | TIMESTAMP | NOT NULL | 추가 시간 |

- UNIQUE(task_id, image_id): 같은 이미지를 같은 Task에 두 번 추가 불가.
- Task 삭제 시 cascade delete.

### label_classes
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 클래스 ID |
| name | VARCHAR | NOT NULL | 클래스 이름 |
| color | VARCHAR | NOT NULL | HEX 색상 코드 (#RRGGBB) |
| task_id | UUID | FK → tasks.id | 소속 Task |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |

- UNIQUE(task_id, name): 같은 Task 내에서 클래스 이름 중복 불가.
- Task 삭제 시 cascade delete.

### folder_meta
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 레코드 ID |
| data_store_id | UUID | FK → data_stores.id | 소속 DataStore |
| path | VARCHAR | NOT NULL | 폴더 경로 |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |

- UNIQUE(data_store_id, path): 같은 DataStore 내 동일 경로 중복 불가.
- 빈 폴더를 명시적으로 추적하기 위한 테이블 (이미지가 없는 폴더도 존재할 수 있음).

## Cascade 삭제 규칙

| 부모 삭제 시 | 자식 cascade 삭제 |
|-------------|------------------|
| User 삭제 | Project 삭제 |
| Project 삭제 | DataStore + Task 삭제 |
| DataStore 삭제 | Image + FolderMeta 삭제 |
| Task 삭제 | TaskImage + LabelClass 삭제 |

## 인덱스 전략

- `images.file_hash`: 업로드 시 중복 검사 (해시 비교)
- `images.folder_path`: 폴더별 이미지 조회
- `images.data_store_id`: DataStore별 이미지 조회 (FK 인덱스)
- `task_images(task_id, image_id)`: 멤버십 확인 및 중복 방지
- `label_classes(task_id, name)`: 이름 중복 방지
