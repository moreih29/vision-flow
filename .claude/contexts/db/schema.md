# Database Schema

## DBMS

PostgreSQL 16 (비동기 드라이버: asyncpg)

## Entity-Relationship Diagram

```
┌─────────┐     1:N     ┌──────────┐     1:N     ┌──────────┐
│  users  │────────────▶│ projects │────────────▶│ datasets │
└─────────┘             └──────────┘             └──────────┘
                              │                       │
                              │ 1:N                   │ 1:N
                              ▼                       ▼
                        ┌──────────┐            ┌──────────┐
                        │ subsets  │            │  images  │
                        └──────────┘            └──────────┘
                              │                    ▲    │
                              │ 1:N          M:N   │    │ 1:N (implicit)
                              ▼                    │    ▼
                     ┌──────────────┐    ┌───────────────┐
                     │label_classes │    │ subset_images  │
                     └──────────────┘    └───────────────┘
                                               │
                                          ┌────────────┐
                        Dataset 1:N ────▶│ folder_meta │
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

### datasets
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 데이터셋 ID |
| name | VARCHAR | NOT NULL | 데이터셋 이름 |
| description | TEXT | NULLABLE | 설명 |
| project_id | UUID | FK → projects.id | 소속 프로젝트 |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |
| updated_at | TIMESTAMP | NOT NULL | 수정 시간 |

- Dataset은 프로젝트의 "Data Pool" 역할을 한다.
- 원본 이미지를 보관하는 저장소이며, 버전 관리 없이 자유롭게 추가/삭제 가능.

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
| dataset_id | UUID | FK → datasets.id | 소속 데이터셋 |
| uploaded_by | UUID | FK → users.id | 업로더 |
| created_at | TIMESTAMP | NOT NULL | 업로드 시간 |

- `storage_key`는 UNIQUE가 아님: 해시 기반 중복 제거로 여러 레코드가 같은 물리 파일을 참조할 수 있음.
- `file_hash` 인덱싱으로 빠른 중복 검사 가능.
- `folder_path` 인덱싱으로 빠른 폴더 탐색 가능.

### subsets
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | Subset ID |
| name | VARCHAR | NOT NULL | Subset 이름 |
| description | TEXT | NULLABLE | 설명 |
| task | ENUM(TaskType) | NOT NULL | 작업 유형 |
| project_id | UUID | FK → projects.id | 소속 프로젝트 |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |
| updated_at | TIMESTAMP | NOT NULL | 수정 시간 |

- **TaskType ENUM**: classification, object_detection, instance_segmentation, pose_estimation
- Subset 생성 시 task type을 지정하며, 이후 변경 불가 (D013).
- Task type이 라벨 포맷을 결정한다.

### subset_images (M:N 조인 테이블)
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 레코드 ID |
| subset_id | UUID | FK → subsets.id | Subset |
| image_id | UUID | FK → images.id | 이미지 |
| added_at | TIMESTAMP | NOT NULL | 추가 시간 |

- UNIQUE(subset_id, image_id): 같은 이미지를 같은 Subset에 두 번 추가 불가.
- Subset 삭제 시 cascade delete.

### label_classes
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 클래스 ID |
| name | VARCHAR | NOT NULL | 클래스 이름 |
| color | VARCHAR | NOT NULL | HEX 색상 코드 (#RRGGBB) |
| subset_id | UUID | FK → subsets.id | 소속 Subset |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |

- UNIQUE(subset_id, name): 같은 Subset 내에서 클래스 이름 중복 불가.
- Subset 삭제 시 cascade delete.

### folder_meta
| 컬럼 | 타입 | 제약조건 | 설명 |
|------|------|---------|------|
| id | UUID | PK | 레코드 ID |
| dataset_id | UUID | FK → datasets.id | 소속 데이터셋 |
| path | VARCHAR | NOT NULL | 폴더 경로 |
| created_at | TIMESTAMP | NOT NULL | 생성 시간 |

- UNIQUE(dataset_id, path): 같은 데이터셋 내 동일 경로 중복 불가.
- 빈 폴더를 명시적으로 추적하기 위한 테이블 (이미지가 없는 폴더도 존재할 수 있음).

## Cascade 삭제 규칙

| 부모 삭제 시 | 자식 cascade 삭제 |
|-------------|------------------|
| User 삭제 | Project 삭제 |
| Project 삭제 | Dataset + Subset 삭제 |
| Dataset 삭제 | Image + FolderMeta 삭제 |
| Subset 삭제 | SubsetImage + LabelClass 삭제 |

## 인덱스 전략

- `images.file_hash`: 업로드 시 중복 검사 (해시 비교)
- `images.folder_path`: 폴더별 이미지 조회
- `images.dataset_id`: 데이터셋별 이미지 조회 (FK 인덱스)
- `subset_images(subset_id, image_id)`: 멤버십 확인 및 중복 방지
- `label_classes(subset_id, name)`: 이름 중복 방지
