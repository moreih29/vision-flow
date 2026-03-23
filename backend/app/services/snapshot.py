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
    """이미지 ID 집합을 정렬 후 SHA-256 해시 계산."""
    if not task_images:
        return None
    image_ids = sorted(ti.image_id for ti in task_images)
    raw = json.dumps(image_ids, separators=(",", ":"))
    return hashlib.sha256(raw.encode()).hexdigest()


def _compute_annotation_hash(task_images: list) -> str | None:
    """어노테이션 데이터를 정규화 후 SHA-256 해시 계산."""
    if not task_images:
        return None
    entries = []
    for ti in sorted(task_images, key=lambda t: t.image_id):
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
                latest = await self._get_latest_snapshot(db, task_id)
                if latest is None:
                    major, data, label = 1, 0, 0
                elif class_schema_hash != latest.class_schema_hash:
                    max_major_result = await db.execute(
                        select(func.coalesce(func.max(TaskSnapshot.major_version), 0))
                        .where(TaskSnapshot.task_id == task_id)
                        .where(TaskSnapshot.is_stash.is_(False))
                    )
                    max_major = max_major_result.scalar_one()
                    major, data, label = max_major + 1, 0, 0
                elif image_set_hash != latest.image_set_hash:
                    max_data_result = await db.execute(
                        select(func.coalesce(func.max(TaskSnapshot.data_version), -1))
                        .where(TaskSnapshot.task_id == task_id)
                        .where(TaskSnapshot.major_version == latest.major_version)
                        .where(TaskSnapshot.is_stash.is_(False))
                    )
                    max_data = max_data_result.scalar_one()
                    major, data, label = latest.major_version, max_data + 1, 0
                elif annotation_hash != latest.annotation_hash:
                    max_label_result = await db.execute(
                        select(func.coalesce(func.max(TaskSnapshot.label_version), -1))
                        .where(TaskSnapshot.task_id == task_id)
                        .where(TaskSnapshot.major_version == latest.major_version)
                        .where(TaskSnapshot.data_version == latest.data_version)
                        .where(TaskSnapshot.is_stash.is_(False))
                    )
                    max_label = max_label_result.scalar_one()
                    major, data, label = latest.major_version, latest.data_version, max_label + 1
                else:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="변경사항이 없어 새 버전을 생성할 수 없습니다.",
                    )

                snapshot = TaskSnapshot(
                    task_id=task_id,
                    major_version=major,
                    data_version=data,
                    label_version=label,
                    name=snapshot_in.name,
                    description=snapshot_in.description,
                    image_count=image_count,
                    labeled_image_count=labeled_image_count,
                    annotation_count=annotation_count,
                    class_schema_hash=class_schema_hash,
                    image_set_hash=image_set_hash,
                    annotation_hash=annotation_hash,
                    label_classes_snapshot=label_classes_data,
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
                # retry: 다음 반복에서 latest를 다시 조회하여 새 버전 번호 계산

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
        await db.commit()
        await db.refresh(snapshot)
        return snapshot

    async def _get_latest_snapshot(self, db: AsyncSession, task_id: int) -> TaskSnapshot | None:
        result = await db.execute(
            select(TaskSnapshot)
            .where(TaskSnapshot.task_id == task_id, TaskSnapshot.is_stash.is_(False))
            .order_by(
                TaskSnapshot.major_version.desc(),
                TaskSnapshot.data_version.desc(),
                TaskSnapshot.label_version.desc(),
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
        latest = await self._get_latest_snapshot(db, task_id)

        if latest is None:
            return {"current_version": None, "is_dirty": True, "changes": {}}

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

        class_changed = current_class_hash != latest.class_schema_hash
        data_changed = current_image_hash != latest.image_set_hash
        label_changed = current_ann_hash != latest.annotation_hash

        is_dirty = class_changed or data_changed or label_changed

        changes: dict = {}
        if is_dirty:
            changes["class_changed"] = class_changed
            changes["data_changed"] = data_changed
            changes["label_changed"] = label_changed

        return {
            "current_version": latest.version_string,
            "is_dirty": is_dirty,
            "changes": changes,
        }

    async def delete_snapshot(
        self,
        db: AsyncSession,
        snapshot_id: int,
        user_id: int,
    ) -> None:
        snapshot = await self.get_snapshot(db, snapshot_id)
        await task_service.check_ownership(db, snapshot.task_id, user_id)
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

        stash = TaskSnapshot(
            task_id=task_id,
            major_version=0,
            data_version=0,
            label_version=0,
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
    ) -> TaskSnapshot:
        snapshot = await self.get_snapshot(db, snapshot_id)
        task_id = snapshot.task_id
        await task_service.check_ownership(db, task_id, user_id)

        # dirty 상태면 자동 stash 생성
        version_status = await self.get_version_status(db, task_id)
        if version_status["is_dirty"]:
            await self.create_stash(db, task_id, user_id)

        # 스냅샷 아이템 조회
        items_result = await db.execute(select(TaskSnapshotItem).where(TaskSnapshotItem.snapshot_id == snapshot_id))
        snapshot_items = list(items_result.scalars().all())

        # 기존 데이터 삭제 (annotations → task_images → label_classes)
        await db.execute(delete(TaskImage).where(TaskImage.task_id == task_id))
        await db.execute(delete(LabelClass).where(LabelClass.task_id == task_id))
        await db.flush()

        # LabelClass 복원 + old_id → new_id 매핑
        class_id_map: dict[int, int] = {}
        for cls_data in snapshot.label_classes_snapshot:
            new_class = LabelClass(
                task_id=task_id,
                name=cls_data["name"],
                color=cls_data["color"],
            )
            db.add(new_class)
            await db.flush()
            class_id_map[cls_data["id"]] = new_class.id

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

        # task_image_id 매핑 (image_id → 새 TaskImage)
        ti_map: dict[int, TaskImage] = {ti.image_id: ti for ti in new_task_images}

        # Annotation 복원 (class_id_map으로 label_class_id 변환)
        new_annotations = []
        for item in snapshot_items:
            ti = ti_map.get(item.image_id)
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

        await db.commit()
        return snapshot


snapshot_service = SnapshotService()
