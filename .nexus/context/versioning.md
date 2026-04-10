# Versioning (Git-like Snapshot System)

Vision Flow의 핵심 차별점은 Task 단위의 **Git-like 스냅샷 버전 관리**다. 라벨링 작업의 상태를 불변 스냅샷으로 동결하고, dirty 상태를 감지하며, 이전 버전으로 복원할 수 있다. 용어와 의미론은 의도적으로 Git에서 차용했다.

## 핵심 개념

- **Snapshot**: Task 한 시점의 전체 상태 스냅샷 (이미지 목록 + 폴더 구조 + 라벨 클래스 + 어노테이션). `task_snapshots` 테이블에 메타, `task_snapshot_items` 테이블에 이미지별 어노테이션 페이로드를 저장한다.
- **HEAD**: `Task.current_snapshot_id`가 현재 HEAD다. 생성 시 최신 스냅샷을 가리키고, 복원 시 그 스냅샷으로 이동한다.
- **Version**: `major.minor` 2-파트 (예: `v1.0`, `v1.3`). Task 내에서 `(major, minor)`는 unique (단, is_stash=false인 레코드에 한해).
- **Dirty**: 현재 작업 상태가 HEAD 스냅샷과 다른 상태. 이때만 새 스냅샷을 만들 수 있다.
- **Stash**: 복원 시 현재 dirty 변경분을 임시 보관하는 특수 스냅샷. Task당 1개 슬롯만 존재.

## Major/Minor 결정 규칙

새 스냅샷을 만들 때 다음 순서로 버전이 자동 결정된다:

1. **첫 스냅샷** → `v1.0`
2. **class_schema_hash가 HEAD와 다름** → major 증가, minor = 0 (breaking change. 라벨 클래스 스키마가 바뀌면 이전 어노테이션과 호환되지 않을 수 있다)
3. **class_schema는 같고 image_set_hash 또는 annotation_hash가 다름** → 같은 major 내에서 minor 증가 (라벨링 진전)
4. **세 해시 모두 동일** → `409 CONFLICT` "변경사항이 없어 새 버전을 생성할 수 없습니다"

이 로직에 따라 `v1.0 → v1.1 → v1.2 → v2.0 → v2.1` 같은 히스토리가 자연스럽게 쌓인다. major 경계는 스키마가 깨진 시점을 가시화한다.

## Dirty Detection: 3-Hash 체계

스냅샷 생성과 dirty 판별의 기반은 세 개의 SHA-256 해시다:

| 해시 | 정의 | 정규화 방식 |
|------|-----|------|
| `class_schema_hash` | 라벨 클래스 스키마 | 이름으로 정렬한 `[{name}]` 리스트를 JSON 직렬화 |
| `image_set_hash` | 이미지 구성 | `(image_id, folder_path)` 튜플을 정렬 후 JSON (폴더 이동도 감지) |
| `annotation_hash` | 어노테이션 내용 | (image_id, folder_path)로 정렬 → 각 이미지 내에서 (label_class_id, annotation_type)으로 정렬 → JSON |

정규화는 입력 순서에 무관한 결정적 해시를 보장한다. `ensure_ascii=False`와 `separators=(",",":")`는 고정 규약이니 수정 시 모든 기존 스냅샷 해시가 무효화됨에 유의.

### 빠른 Dirty 판별

`get_version_status`는 성능 최적화 경로를 가진다:
1. 먼저 image count와 class count만 조회해 비교.
2. count가 다르면 즉시 dirty로 판정하고 해시 계산을 생략.
3. count가 같을 때만 전체 데이터를 로드해 3개 해시를 재계산해 비교.

이 덕분에 "변경 없음" 확인이 저렴하다. count diff를 `image_added`/`image_removed`/`class_added` 등으로 근사 리턴도 한다.

## Stash 시맨틱

복원 전 dirty 상태를 잃지 않도록 stash를 활용한다.

- **단일 슬롯**: Task당 1개의 stash만 유지된다. 새 stash가 생성되면 기존 stash는 즉시 삭제된다 (Git의 stash 스택과 다름 — 의도된 단순화).
- **식별**: `is_stash = true` + `major=0, minor=0`. 이 조합은 unique index에서 제외된다 (`postgresql_where=text("is_stash = false")`).
- **origin tracking**: `restored_from_id`에 stash 생성 시점의 HEAD를 저장. stash pop 시 HEAD를 이리로 되돌린다.
- **자동 생성**: `restore_snapshot(skip_stash=False)`가 기본값. restore 직전에 현재가 dirty면 자동으로 stash를 만들고 진행한다. `skip_stash=True`로 호출하면 변경분을 버린다.

## Restore 의미론

복원은 현재 Task 데이터를 **완전히 삭제한 후** 스냅샷에서 재구성한다. 단순 SQL UPDATE가 아니다:

1. 선택적으로 stash 생성 (dirty & !skip_stash)
2. 기존 `TaskImage` / `LabelClass` / `TaskFolderMeta` 전체 삭제 (annotations는 cascade)
3. 스냅샷의 `label_classes_snapshot` (JSONB)에서 `LabelClass`를 새로 insert하고 **old_id → new_id 매핑 테이블** 구축
4. `task_snapshot_items`에서 `TaskImage`를 복원 (image가 DB에서 삭제되어 있으면 skip)
5. 각 item의 `annotation_data` JSON 배열에서 `Annotation`을 복원 (label_class_id는 매핑 테이블로 재연결)
6. 이미지 folder_path로부터 `TaskFolderMeta` 재계산해 insert
7. 스냅샷 자신의 3-hash를 재저장 (재생성된 실제 데이터 기준)
8. `Task.current_snapshot_id`를 복원된 스냅샷(또는 stash pop 시 원본 HEAD)으로 설정

즉, **LabelClass id가 복원 전후로 달라진다**. 이는 stash pop 이후 프론트엔드에서 id 캐시를 재로딩해야 한다는 뜻이다. 실패 시 전체 트랜잭션이 롤백되고, 앞서 별도 커밋된 stash도 보상 삭제된다.

### stash pop 특례

`restore_snapshot(snapshot_id)`의 대상이 stash일 때는:
- 복원 후 HEAD를 `snapshot.restored_from_id`(원래 HEAD)로 설정
- stash 레코드 자체는 삭제됨 (일회성)
- 반환값은 원래 HEAD 스냅샷 (또는 원본이 없다면 latest)

## 동시성: 버전 충돌 Retry

`create_snapshot`은 `(task_id, major, minor)` unique 제약에 걸릴 수 있다 (두 클라이언트가 동시에 스냅샷을 만드는 경우). 최대 **3회 retry** 루프를 돌며 매 시도마다 최신 HEAD를 재조회해 major/minor를 재계산한다. 모두 실패하면 `409 CONFLICT`. IntegrityError 처리가 핵심이니, 이 로직을 리팩터할 때 retry 의미론을 보존해야 한다.

## Diff

`diff_snapshots(a, b)`는 두 스냅샷 간 비교를 제공한다:
- `added_images` / `removed_images` (image_id 기준)
- 공통 이미지의 annotation count 변화 (`annotation_changes[image_id] = {before, after}`)
- `class_compatible` (class_schema_hash 동일 여부)

전체 어노테이션 diff가 아니라 **count 기반 요약**이다. 세부 변경 diff가 필요하면 snapshot_items의 `annotation_data` JSONB를 직접 비교해야 한다.

## Delete Snapshot & HEAD 이동

현재 HEAD인 스냅샷을 삭제하면, 가장 최근의 다른 스냅샷으로 HEAD가 자동 이동한다 (남은 스냅샷이 없으면 HEAD는 NULL). 이 동작은 cascade가 아닌 명시적 로직으로 구현되어 있으므로 HEAD 마이그레이션이 필요한 새 기능은 이 패턴을 따라야 한다.

## 마이그레이션 주의

버전 관리 스키마는 여러 마이그레이션에 걸쳐 진화했다:
- 초기 버전 구조 → 3-part로 확장 → 2-part로 리팩터 (`a7b8c9d0e1f2_refactor_version_3part_to_2part.py`)
- `label_classes_snapshot` JSONB 추가
- `restored_from_id` 자기참조 FK 추가
- `current_snapshot_id`를 Task에 추가 (이전엔 최신 스냅샷 fallback 로직만 있었음 — 현재도 하위 호환용 fallback이 `get_version_status`에 남아 있다)
- FK ondelete가 여러 번 수정됨 (snapshot_items → task_images 관계는 SET NULL)

스냅샷 스키마를 건드릴 때는 기존 해시가 재계산 대상인지, 데이터 마이그레이션이 필요한지를 반드시 먼저 판단하라.

## 관련 리소스

- 백엔드 핵심 코드: `backend/app/models/task_snapshot.py`, `backend/app/models/task_snapshot_item.py`, `backend/app/services/snapshot.py`, `backend/app/routers/snapshots.py`
- 프론트엔드 훅: `frontend/src/hooks/use-snapshots.ts`
- 프론트엔드 타입: `frontend/src/types/snapshot.ts`
- 프론트엔드 UI: `VersionPanel` 관련 컴포넌트
