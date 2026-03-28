import hashlib
import json

from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.annotation import Annotation
from app.models.image import Image
from app.models.label_class import LabelClass
from app.models.task import Task
from app.models.task_folder_meta import TaskFolderMeta
from app.models.task_image import TaskImage
from app.models.task_snapshot import TaskSnapshot
from app.models.task_snapshot_item import TaskSnapshotItem
from app.schemas.snapshot import SnapshotCreate
from app.services.task import task_service


def _compute_class_schema_hash(label_classes: list) -> str | None:
    """label_classes를 이름 기준으로 정렬한 후 SHA-256 해시 계산."""
    if not label_classes:
        return None
    sorted_classes = sorted(label_classes, key=lambda lc: lc.name)
    schema = [{"name": lc.name} for lc in sorted_classes]
    raw = json.dumps(schema, ensure_ascii=False, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _compute_image_set_hash(task_images: list) -> str | None:
    """이미지 ID + folder_path 조합을 정렬 후 SHA-256 해시 계산. 폴더 이동도 감지."""
    if not task_images:
        return None
    entries = sorted((ti.image_id, ti.folder_path or "") for ti in task_images)
    raw = json.dumps(entries, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _compute_annotation_hash(task_images: list) -> str | None:
    """어노테이션 데이터를 정규화 후 SHA-256 해시 계산."""
    if not task_images:
        return None
    entries = []
    for ti in sorted(task_images, key=lambda t: (t.image_id, t.folder_path)):
        anns = sorted(
            ti.annotations,
            key=lambda a: (a.label_class_id or 0, a.annotation_type),
        )
        ann_list = [
            {
                "label_class_id": a.label_class_id,
                "annotation_type": a.annotation_type,
                "data": a.data,
            }
            for a in anns
        ]
        entries.append({"image_id": ti.image_id, "annotations": ann_list})
    raw = json.dumps(entries, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    return hashlib.sha256(raw.encode()).hexdigest()


class SnapshotService:
    async def create_snapshot(
        self,
        db: AsyncSession,
        task_id: int,
        user_id: int,
        snapshot_in: SnapshotCreate,
    ) -> TaskSnapshot:
        await task_service.check_ownership(db, task_id, user_id)

        # task_images + annotations + images를 한 번에 조회
        task_images_result = await db.execute(
            select(TaskImage)
            .where(TaskImage.task_id == task_id)
            .options(
                selectinload(TaskImage.annotations),
                selectinload(TaskImage.image),
            )
        )
        task_images = list(task_images_result.scalars().all())

        # label_classes 조회 (class_schema_hash 계산용)
        label_classes_result = await db.execute(select(LabelClass).where(LabelClass.task_id == task_id))
        label_classes = list(label_classes_result.scalars().all())

        # 통계 계산
        image_count = len(task_images)
        labeled_image_count = sum(1 for ti in task_images if ti.annotations)
        annotation_count = sum(len(ti.annotations) for ti in task_images)

        # 해시 계산
        class_schema_hash = _compute_class_schema_hash(label_classes)
        image_set_hash = _compute_image_set_hash(task_images)
        annotation_hash = _compute_annotation_hash(task_images)

        label_classes_data = [{"id": lc.id, "name": lc.name, "color": lc.color} for lc in label_classes]

        # 3레벨 버전 결정 + snapshot 생성 (UniqueViolation 발생 시 최대 3회 retry)
        snapshot = None
        for attempt in range(3):
            try:
                # retry 시 세션 상태가 초기화되므로 task와 latest를 매 시도마다 새로 조회
                task = await db.get(Task, task_id)

                # 복원 후 생성인지 판단 (current_snapshot_id가 최신이 아닌 경우)
                restored_from_id = None
                if task and task.current_snapshot_id:
                    pre_latest = await self._get_latest_snapshot(db, task_id)
                    if pre_latest and task.current_snapshot_id != pre_latest.id:
                        restored_from_id = task.current_snapshot_id

                latest = await self._get_latest_snapshot(db, task_id)
                if latest is None:
                    major, minor = 1, 0
                elif class_schema_hash != latest.class_schema_hash:
                    max_major_result = await db.execute(
                        select(func.coalesce(func.max(TaskSnapshot.major_version), 0))
                        .where(TaskSnapshot.task_id == task_id)
                        .where(TaskSnapshot.is_stash.is_(False))
                    )
                    max_major = max_major_result.scalar_one()
                    major, minor = max_major + 1, 0
                elif image_set_hash != latest.image_set_hash or annotation_hash != latest.annotation_hash:
                    max_minor_result = await db.execute(
                        select(func.coalesce(func.max(TaskSnapshot.minor_version), -1))
                        .where(TaskSnapshot.task_id == task_id)
                        .where(TaskSnapshot.major_version == latest.major_version)
                        .where(TaskSnapshot.is_stash.is_(False))
                    )
                    max_minor = max_minor_result.scalar_one()
                    major, minor = latest.major_version, max_minor + 1
                else:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="변경사항이 없어 새 버전을 생성할 수 없습니다.",
                    )

                snapshot = TaskSnapshot(
                    task_id=task_id,
                    major_version=major,
                    minor_version=minor,
                    name=snapshot_in.name,
                    description=snapshot_in.description,
                    image_count=image_count,
                    labeled_image_count=labeled_image_count,
                    annotation_count=annotation_count,
                    class_schema_hash=class_schema_hash,
                    image_set_hash=image_set_hash,
                    annotation_hash=annotation_hash,
                    label_classes_snapshot=label_classes_data,
                    restored_from_id=restored_from_id,
                )
                db.add(snapshot)
                await db.flush()  # snapshot.id 확보
                break  # 성공 시 루프 탈출
            except IntegrityError as exc:
                await db.rollback()
                if attempt == 2:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="버전 생성에 실패했습니다. 다시 시도해주세요.",
                    ) from exc
                # retry: rollback 후 세션이 초기화되므로 다음 반복에서 새로 조회

        # snapshot_items 벌크 생성
        items = []
        for ti in task_images:
            annotation_data = []
            for ann in ti.annotations:
                annotation_data.append(
                    {
                        "id": ann.id,
                        "label_class_id": ann.label_class_id,
                        "annotation_type": ann.annotation_type,
                        "data": ann.data,
                    }
                )
            items.append(
                TaskSnapshotItem(
                    snapshot_id=snapshot.id,
                    image_id=ti.image_id,
                    folder_path=ti.folder_path,
                    annotation_data=annotation_data,
                )
            )

        db.add_all(items)

        # current_snapshot_id 업데이트
        task.current_snapshot_id = snapshot.id

        await db.commit()
        await db.refresh(snapshot)
        return snapshot

    async def _get_latest_snapshot(self, db: AsyncSession, task_id: int) -> TaskSnapshot | None:
        result = await db.execute(
            select(TaskSnapshot)
            .where(TaskSnapshot.task_id == task_id, TaskSnapshot.is_stash.is_(False))
            .order_by(
                TaskSnapshot.major_version.desc(),
                TaskSnapshot.minor_version.desc(),
            )
            .limit(1)
        )
        return result.scalar_one_or_none()

    async def list_snapshots(self, db: AsyncSession, task_id: int) -> list[TaskSnapshot]:
        result = await db.execute(
            select(TaskSnapshot)
            .where(TaskSnapshot.task_id == task_id, TaskSnapshot.is_stash.is_(False))
            .order_by(TaskSnapshot.created_at.desc())
        )
        return list(result.scalars().all())

    async def get_snapshot(self, db: AsyncSession, snapshot_id: int) -> TaskSnapshot:
        result = await db.execute(select(TaskSnapshot).where(TaskSnapshot.id == snapshot_id))
        snapshot = result.scalar_one_or_none()
        if snapshot is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Snapshot not found",
            )
        return snapshot

    async def get_snapshot_items(
        self,
        db: AsyncSession,
        snapshot_id: int,
        folder_path: str | None = None,
        skip: int = 0,
        limit: int = 100,
    ) -> tuple[list[TaskSnapshotItem], int]:
        await self.get_snapshot(db, snapshot_id)

        base_query = select(TaskSnapshotItem).where(TaskSnapshotItem.snapshot_id == snapshot_id)
        count_query = select(func.count()).where(TaskSnapshotItem.snapshot_id == snapshot_id)

        if folder_path is not None:
            base_query = base_query.where(TaskSnapshotItem.folder_path == folder_path)
            count_query = count_query.where(TaskSnapshotItem.folder_path == folder_path)

        count_result = await db.execute(count_query)
        total = count_result.scalar_one()

        items_result = await db.execute(
            base_query.options(selectinload(TaskSnapshotItem.image)).offset(skip).limit(limit)
        )
        items = list(items_result.scalars().all())
        return items, total

    async def get_version_status(self, db: AsyncSession, task_id: int) -> dict:
        task = await db.get(Task, task_id)

        # current_snapshot_id가 없으면 최신 스냅샷으로 fallback (마이그레이션 누락 등 하위 호환)
        if task is None or task.current_snapshot_id is None:
            current_snapshot = await self._get_latest_snapshot(db, task_id)
        else:
            current_snapshot = await db.get(TaskSnapshot, task.current_snapshot_id)

        if current_snapshot is None:
            return {
                "current_version": None,
                "current_snapshot_id": None,
                "is_dirty": True,
                "changes": {},
                "counts": {},
            }

        snapshot_id = current_snapshot.id
        base_result = {
            "current_version": current_snapshot.version_string,
            "current_snapshot_id": snapshot_id,
        }

        # 빠른 판별: image count 불일치 시 즉시 dirty (해시 계산 생략)
        current_image_count = await db.scalar(
            select(func.count()).select_from(TaskImage).where(TaskImage.task_id == task_id)
        )
        snapshot_image_count = current_snapshot.image_count

        current_class_count = await db.scalar(
            select(func.count()).select_from(LabelClass).where(LabelClass.task_id == task_id)
        )
        snapshot_class_count = (
            len(current_snapshot.label_classes_snapshot) if current_snapshot.label_classes_snapshot else 0
        )

        image_count_differs = current_image_count != snapshot_image_count
        class_count_differs = current_class_count != snapshot_class_count

        if image_count_differs or class_count_differs:
            # 근사치 count diff (추가 쿼리 없이 count 차이로 계산)
            counts: dict = {}
            if image_count_differs:
                diff = current_image_count - snapshot_image_count
                counts["image_added"] = max(0, diff)
                counts["image_removed"] = max(0, -diff)
            if class_count_differs:
                cls_diff = current_class_count - snapshot_class_count
                counts["class_added"] = max(0, cls_diff)
                counts["class_removed"] = max(0, -cls_diff)

            return {
                **base_result,
                "is_dirty": True,
                "changes": {
                    "data_changed": image_count_differs,
                    "class_changed": class_count_differs,
                },
                "counts": counts,
            }

        # count 일치 시에만 전체 해시 비교
        # task_images + annotations 조회
        task_images_result = await db.execute(
            select(TaskImage).where(TaskImage.task_id == task_id).options(selectinload(TaskImage.annotations))
        )
        task_images = list(task_images_result.scalars().all())

        # label_classes 조회
        label_classes_result = await db.execute(select(LabelClass).where(LabelClass.task_id == task_id))
        label_classes = list(label_classes_result.scalars().all())

        # 해시 계산
        current_class_hash = _compute_class_schema_hash(label_classes)
        current_image_hash = _compute_image_set_hash(task_images)
        current_ann_hash = _compute_annotation_hash(task_images)

        class_changed = current_class_hash != current_snapshot.class_schema_hash
        data_changed = (
            current_image_hash != current_snapshot.image_set_hash
            or current_ann_hash != current_snapshot.annotation_hash
        )

        is_dirty = class_changed or data_changed

        changes: dict = {}
        counts = {}
        if is_dirty:
            changes["class_changed"] = class_changed
            changes["data_changed"] = data_changed

            if data_changed:
                counts = await self._compute_image_diff_counts(db, task_images, snapshot_id)

            if class_changed:
                snapshot_class_names = {c["name"] for c in (current_snapshot.label_classes_snapshot or [])}
                current_class_names = {lc.name for lc in label_classes}
                counts["class_added"] = len(current_class_names - snapshot_class_names)
                counts["class_removed"] = len(snapshot_class_names - current_class_names)

        return {
            **base_result,
            "is_dirty": is_dirty,
            "changes": changes,
            "counts": counts,
        }

    async def _compute_image_diff_counts(
        self,
        db: AsyncSession,
        task_images: list,
        snapshot_id: int,
    ) -> dict:
        """현재 task_images와 snapshot_items를 비교하여 added/removed/moved count를 반환."""
        # snapshot_items의 (image_id, folder_path) set 조회
        snap_items_result = await db.execute(
            select(
                TaskSnapshotItem.image_id,
                TaskSnapshotItem.folder_path,
            ).where(TaskSnapshotItem.snapshot_id == snapshot_id)
        )
        snap_pairs = {(r.image_id, r.folder_path or "") for r in snap_items_result}
        snap_image_ids = {r[0] for r in snap_pairs}

        current_pairs = {(ti.image_id, ti.folder_path or "") for ti in task_images}
        current_image_ids = {p[0] for p in current_pairs}

        image_added = len(current_image_ids - snap_image_ids)
        image_removed = len(snap_image_ids - current_image_ids)

        # moved: 같은 image_id가 양쪽에 존재하지만 (image_id, folder_path) pair가 다른 경우
        common_ids = current_image_ids & snap_image_ids
        image_moved = 0
        for img_id in common_ids:
            cur_folders = {p[1] for p in current_pairs if p[0] == img_id}
            snap_folders = {p[1] for p in snap_pairs if p[0] == img_id}
            if cur_folders != snap_folders:
                image_moved += 1

        return {
            "image_added": image_added,
            "image_removed": image_removed,
            "image_moved": image_moved,
        }

    async def delete_snapshot(
        self,
        db: AsyncSession,
        snapshot_id: int,
        user_id: int,
    ) -> None:
        snapshot = await self.get_snapshot(db, snapshot_id)
        task_id = snapshot.task_id
        await task_service.check_ownership(db, task_id, user_id)

        # 삭제 대상이 현재 HEAD인 경우, 이전 스냅샷으로 HEAD 이동
        task = await db.get(Task, task_id)
        if task and task.current_snapshot_id == snapshot_id:
            # 삭제 대상을 제외한 가장 최근 스냅샷 조회
            prev_result = await db.execute(
                select(TaskSnapshot)
                .where(
                    TaskSnapshot.task_id == task_id,
                    TaskSnapshot.is_stash.is_(False),
                    TaskSnapshot.id != snapshot_id,
                )
                .order_by(
                    TaskSnapshot.major_version.desc(),
                    TaskSnapshot.minor_version.desc(),
                )
                .limit(1)
            )
            prev_snapshot = prev_result.scalar_one_or_none()
            task.current_snapshot_id = prev_snapshot.id if prev_snapshot else None

        await db.delete(snapshot)
        await db.commit()

    async def diff_snapshots(
        self,
        db: AsyncSession,
        snapshot_id_a: int,
        snapshot_id_b: int,
    ) -> dict:
        snapshot_a = await self.get_snapshot(db, snapshot_id_a)
        snapshot_b = await self.get_snapshot(db, snapshot_id_b)

        # 각 스냅샷 아이템의 image_id와 annotation_data를 조회
        a_result = await db.execute(
            select(TaskSnapshotItem.image_id, TaskSnapshotItem.annotation_data).where(
                TaskSnapshotItem.snapshot_id == snapshot_id_a
            )
        )
        b_result = await db.execute(
            select(TaskSnapshotItem.image_id, TaskSnapshotItem.annotation_data).where(
                TaskSnapshotItem.snapshot_id == snapshot_id_b
            )
        )

        a_ann_map = {row.image_id: len(row.annotation_data) for row in a_result}
        b_ann_map = {row.image_id: len(row.annotation_data) for row in b_result}

        a_ids = set(a_ann_map.keys())
        b_ids = set(b_ann_map.keys())

        added_images = sorted(b_ids - a_ids)
        removed_images = sorted(a_ids - b_ids)

        # 공통 이미지의 annotation 수 변경 집계
        annotation_changes: dict = {}
        common_ids = a_ids & b_ids
        for image_id in common_ids:
            a_count = a_ann_map.get(image_id, 0)
            b_count = b_ann_map.get(image_id, 0)
            if a_count != b_count:
                annotation_changes[str(image_id)] = {"before": a_count, "after": b_count}

        class_compatible = snapshot_a.class_schema_hash == snapshot_b.class_schema_hash

        return {
            "added_images": added_images,
            "removed_images": removed_images,
            "added_count": len(added_images),
            "removed_count": len(removed_images),
            "annotation_changes": annotation_changes,
            "class_compatible": class_compatible,
        }

    async def create_stash(
        self,
        db: AsyncSession,
        task_id: int,
        user_id: int,
    ) -> TaskSnapshot:
        await task_service.check_ownership(db, task_id, user_id)

        # 기존 stash 삭제 (1개 슬롯)
        existing_stash = await self.get_stash(db, task_id)
        if existing_stash:
            await db.delete(existing_stash)
            await db.flush()

        # 현재 상태 조회
        task_images_result = await db.execute(
            select(TaskImage)
            .where(TaskImage.task_id == task_id)
            .options(
                selectinload(TaskImage.annotations),
                selectinload(TaskImage.image),
            )
        )
        task_images = list(task_images_result.scalars().all())

        label_classes_result = await db.execute(select(LabelClass).where(LabelClass.task_id == task_id))
        label_classes = list(label_classes_result.scalars().all())

        image_count = len(task_images)
        labeled_image_count = sum(1 for ti in task_images if ti.annotations)
        annotation_count = sum(len(ti.annotations) for ti in task_images)
        class_schema_hash = _compute_class_schema_hash(label_classes)
        image_set_hash = _compute_image_set_hash(task_images)
        annotation_hash = _compute_annotation_hash(task_images)

        label_classes_data = [{"id": lc.id, "name": lc.name, "color": lc.color} for lc in label_classes]

        task = await db.get(Task, task_id)
        original_head_id = task.current_snapshot_id if task else None

        stash = TaskSnapshot(
            task_id=task_id,
            major_version=0,
            minor_version=0,
            is_stash=True,
            name="stash",
            description=None,
            image_count=image_count,
            labeled_image_count=labeled_image_count,
            annotation_count=annotation_count,
            class_schema_hash=class_schema_hash,
            image_set_hash=image_set_hash,
            annotation_hash=annotation_hash,
            label_classes_snapshot=label_classes_data,
            restored_from_id=original_head_id,
        )
        db.add(stash)
        await db.flush()

        items = []
        for ti in task_images:
            annotation_data = []
            for ann in ti.annotations:
                annotation_data.append(
                    {
                        "id": ann.id,
                        "label_class_id": ann.label_class_id,
                        "annotation_type": ann.annotation_type,
                        "data": ann.data,
                    }
                )
            items.append(
                TaskSnapshotItem(
                    snapshot_id=stash.id,
                    image_id=ti.image_id,
                    folder_path=ti.folder_path,
                    annotation_data=annotation_data,
                )
            )

        db.add_all(items)
        await db.commit()
        await db.refresh(stash)
        return stash

    async def get_stash(self, db: AsyncSession, task_id: int) -> TaskSnapshot | None:
        result = await db.execute(
            select(TaskSnapshot).where(TaskSnapshot.task_id == task_id, TaskSnapshot.is_stash.is_(True)).limit(1)
        )
        return result.scalar_one_or_none()

    async def delete_stash(self, db: AsyncSession, task_id: int, user_id: int) -> None:
        await task_service.check_ownership(db, task_id, user_id)
        stash = await self.get_stash(db, task_id)
        if stash is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Stash not found",
            )
        await db.delete(stash)
        await db.commit()

    async def restore_snapshot(
        self,
        db: AsyncSession,
        snapshot_id: int,
        user_id: int,
        skip_stash: bool = False,
    ) -> TaskSnapshot:
        snapshot = await self.get_snapshot(db, snapshot_id)
        task_id = snapshot.task_id
        await task_service.check_ownership(db, task_id, user_id)

        # dirty 상태면 자동 stash 생성 (skip_stash=True면 건너뜀)
        stash_created_id: int | None = None
        if not skip_stash:
            version_status = await self.get_version_status(db, task_id)
            if version_status["is_dirty"]:
                stash = await self.create_stash(db, task_id, user_id)
                stash_created_id = stash.id

        try:
            # 스냅샷 아이템 조회
            items_result = await db.execute(select(TaskSnapshotItem).where(TaskSnapshotItem.snapshot_id == snapshot_id))
            snapshot_items = list(items_result.scalars().all())

            # 기존 데이터 삭제 (annotations → task_images → label_classes → folder_meta)
            await db.execute(delete(TaskImage).where(TaskImage.task_id == task_id))
            await db.execute(delete(LabelClass).where(LabelClass.task_id == task_id))
            await db.execute(delete(TaskFolderMeta).where(TaskFolderMeta.task_id == task_id))
            await db.flush()

            # LabelClass 복원 + old_id → new_id 매핑
            class_id_map: dict[int, int] = {}
            new_label_classes: list[LabelClass] = []
            for cls_data in snapshot.label_classes_snapshot:
                new_class = LabelClass(
                    task_id=task_id,
                    name=cls_data["name"],
                    color=cls_data["color"],
                )
                db.add(new_class)
                await db.flush()
                class_id_map[cls_data["id"]] = new_class.id
                new_label_classes.append(new_class)

            # 스냅샷에서 TaskImage 복원
            new_task_images = []
            for item in snapshot_items:
                # image_id가 NULL이거나 이미지가 삭제된 경우 건너뜀
                if item.image_id is None:
                    continue
                img_result = await db.execute(select(Image).where(Image.id == item.image_id))
                if img_result.scalar_one_or_none() is None:
                    continue
                new_task_images.append(
                    TaskImage(
                        task_id=task_id,
                        image_id=item.image_id,
                        folder_path=item.folder_path,
                    )
                )

            db.add_all(new_task_images)
            await db.flush()

            # task_image_id 매핑 ((image_id, folder_path) → 새 TaskImage)
            ti_map: dict[tuple[int, str], TaskImage] = {(ti.image_id, ti.folder_path): ti for ti in new_task_images}

            # Annotation 복원 (class_id_map으로 label_class_id 변환)
            new_annotations = []
            for item in snapshot_items:
                ti = ti_map.get((item.image_id, item.folder_path))
                if ti is None:
                    continue
                for ann_data in item.annotation_data:
                    old_class_id = ann_data.get("label_class_id")
                    new_class_id = class_id_map.get(old_class_id) if old_class_id else None
                    new_annotations.append(
                        Annotation(
                            task_image_id=ti.id,
                            label_class_id=new_class_id,
                            annotation_type=ann_data.get("annotation_type", ""),
                            data=ann_data.get("data", {}),
                        )
                    )

            if new_annotations:
                db.add_all(new_annotations)

            # TaskFolderMeta 재생성 (복원된 이미지의 folder_path 기반)
            folder_paths: set[str] = set()
            for ti in new_task_images:
                if ti.folder_path:
                    parts = ti.folder_path.strip("/").split("/")
                    for i in range(len(parts)):
                        folder_paths.add("/".join(parts[: i + 1]) + "/")
            for fp in folder_paths:
                db.add(TaskFolderMeta(task_id=task_id, path=fp))

            # current_snapshot_id 업데이트
            task = await db.get(Task, task_id)
            if snapshot.is_stash:
                # stash pop: 원래 HEAD로 복귀
                task.current_snapshot_id = snapshot.restored_from_id
            else:
                task.current_snapshot_id = snapshot.id

            # 복원 후 해시 재저장 — 재생성된 데이터 기준으로 해시 재계산
            # annotations relationship 로드를 위해 DB에서 다시 조회
            await db.flush()
            refreshed_images_result = await db.execute(
                select(TaskImage).where(TaskImage.task_id == task_id).options(selectinload(TaskImage.annotations))
            )
            refreshed_images = list(refreshed_images_result.scalars().all())
            snapshot.class_schema_hash = _compute_class_schema_hash(new_label_classes)
            snapshot.image_set_hash = _compute_image_set_hash(refreshed_images)
            snapshot.annotation_hash = _compute_annotation_hash(refreshed_images)

            if snapshot.is_stash:
                original_head_id = snapshot.restored_from_id
                await db.delete(snapshot)
                await db.commit()
                if original_head_id:
                    return await self.get_snapshot(db, original_head_id)
                latest = await self._get_latest_snapshot(db, task_id)
                return latest
            else:
                await db.commit()
                return snapshot
        except Exception:
            # 복원 실패 시 rollback 후 앞서 별도 커밋된 stash를 보상 삭제
            await db.rollback()
            if stash_created_id is not None:
                try:
                    stash_to_delete = await db.get(TaskSnapshot, stash_created_id)
                    if stash_to_delete is not None:
                        await db.delete(stash_to_delete)
                        await db.commit()
                except Exception:
                    pass
            raise


snapshot_service = SnapshotService()
