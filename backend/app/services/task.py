from fastapi import HTTPException, status
from sqlalchemy import delete, func, select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.annotation import Annotation
from app.models.image import Image
from app.models.label_class import LabelClass
from app.models.task import Task
from app.models.task_folder_meta import TaskFolderMeta
from app.models.task_image import TaskImage
from app.schemas.image import FolderInfo
from app.schemas.task import TaskCreate, TaskUpdate
from app.schemas.task_image import TaskFolderContentsResponse, TaskImageResponse
from app.services.image import _escape_like, _normalize_folder_path
from app.services.project import project_service


class TaskService:
    async def create_task(
        self,
        db: AsyncSession,
        project_id: int,
        user_id: int,
        task_in: TaskCreate,
    ) -> Task:
        await project_service.get_project_with_ownership(db, project_id, user_id)
        task = Task(
            name=task_in.name,
            description=task_in.description,
            task_type=task_in.task_type.value,
            project_id=project_id,
        )
        db.add(task)
        await db.commit()
        await db.refresh(task)
        return task

    async def get_tasks_by_project(self, db: AsyncSession, project_id: int) -> list[tuple[Task, int, int, int]]:
        """태스크 목록과 image_count, class_count, labeled_count를 한 번의 쿼리로 조회."""
        labeled_subq = (
            select(func.count(func.distinct(TaskImage.id)))
            .join(Annotation, Annotation.task_image_id == TaskImage.id)
            .where(TaskImage.task_id == Task.id)
            .scalar_subquery()
        )
        stmt = (
            select(
                Task,
                func.count(func.distinct(TaskImage.id)).label("image_count"),
                func.count(func.distinct(LabelClass.id)).label("class_count"),
                labeled_subq.label("labeled_count"),
            )
            .outerjoin(TaskImage, TaskImage.task_id == Task.id)
            .outerjoin(LabelClass, LabelClass.task_id == Task.id)
            .where(Task.project_id == project_id)
            .group_by(Task.id)
        )
        result = await db.execute(stmt)
        return list(result.all())  # type: ignore[arg-type]

    async def get_labeled_count(self, db: AsyncSession, task_id: int) -> int:
        """annotations가 1개 이상 존재하는 task_image 수."""
        result = await db.execute(
            select(func.count(func.distinct(TaskImage.id)))
            .join(Annotation, Annotation.task_image_id == TaskImage.id)
            .where(TaskImage.task_id == task_id)
        )
        return result.scalar_one()

    async def get_task(self, db: AsyncSession, task_id: int) -> Task:
        result = await db.execute(select(Task).where(Task.id == task_id))
        task = result.scalar_one_or_none()
        if task is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found",
            )
        return task

    async def check_ownership(self, db: AsyncSession, task_id: int, user_id: int) -> Task:
        """태스크 조회 + 프로젝트 소유권 검증. 태스크를 반환."""
        task = await self.get_task(db, task_id)
        project = await project_service.get_project(db, task.project_id)
        await project_service.check_ownership(project, user_id)
        return task

    async def update_task(
        self,
        db: AsyncSession,
        task_id: int,
        user_id: int,
        task_in: TaskUpdate,
    ) -> Task:
        task = await self.check_ownership(db, task_id, user_id)
        if task_in.name is not None:
            task.name = task_in.name
        if task_in.description is not None:
            task.description = task_in.description
        await db.commit()
        await db.refresh(task)
        return task

    async def delete_task(self, db: AsyncSession, task_id: int, user_id: int) -> None:
        task = await self.check_ownership(db, task_id, user_id)
        await db.delete(task)
        await db.commit()

    async def add_images(
        self,
        db: AsyncSession,
        task_id: int,
        image_ids: list[int],
        folder_path: str = "",
    ) -> list[TaskImage]:
        await self.get_task(db, task_id)
        result = await db.execute(select(Image).where(Image.id.in_(image_ids)))
        found_images = result.scalars().all()
        found_ids = {img.id for img in found_images}
        missing = set(image_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Images not found: {sorted(missing)}",
            )
        normalized_folder_path = _normalize_folder_path(folder_path)
        existing_result = await db.execute(
            select(TaskImage).where(
                TaskImage.task_id == task_id,
                TaskImage.image_id.in_(image_ids),
            )
        )
        existing_ids = {ti.image_id for ti in existing_result.scalars().all()}
        new_ids = [iid for iid in image_ids if iid not in existing_ids]
        task_images = [TaskImage(task_id=task_id, image_id=iid, folder_path=normalized_folder_path) for iid in new_ids]
        db.add_all(task_images)
        await db.commit()
        if new_ids:
            result = await db.execute(
                select(TaskImage)
                .where(
                    TaskImage.task_id == task_id,
                    TaskImage.image_id.in_(new_ids),
                )
                .options(selectinload(TaskImage.image))
            )
            return list(result.scalars().all())  # type: ignore[arg-type]
        return []

    async def remove_images(self, db: AsyncSession, task_id: int, image_ids: list[int]) -> None:
        await self.get_task(db, task_id)
        await db.execute(
            delete(TaskImage).where(
                TaskImage.task_id == task_id,
                TaskImage.image_id.in_(image_ids),
            )
        )
        await db.commit()

    async def get_images(self, db: AsyncSession, task_id: int, skip: int, limit: int) -> tuple[list[TaskImage], int]:
        await self.get_task(db, task_id)
        count_result = await db.execute(select(func.count()).where(TaskImage.task_id == task_id))
        total = count_result.scalar_one()
        result = await db.execute(
            select(TaskImage)
            .where(TaskImage.task_id == task_id)
            .options(selectinload(TaskImage.image))
            .offset(skip)
            .limit(limit)
        )
        task_images = list(result.scalars().all())
        return task_images, total

    async def get_image_count(self, db: AsyncSession, task_id: int) -> int:
        result = await db.execute(select(func.count()).where(TaskImage.task_id == task_id))
        return result.scalar_one()

    async def get_class_count(self, db: AsyncSession, task_id: int) -> int:
        result = await db.execute(select(func.count()).where(LabelClass.task_id == task_id))
        return result.scalar_one()

    # --- 폴더 메서드 ---

    async def get_folder_contents(
        self,
        db: AsyncSession,
        task_id: int,
        path: str = "",
        skip: int = 0,
        limit: int = 100,
    ) -> TaskFolderContentsResponse:
        normalized_path = _normalize_folder_path(path)

        # 현재 경로 이하의 모든 folder_path 수집
        folder_paths_result = await db.execute(
            select(TaskImage.folder_path)
            .where(TaskImage.task_id == task_id)
            .where(TaskImage.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
            .distinct()
        )
        all_folder_paths: list[str] = list(folder_paths_result.scalars().all())

        # 직계 자식 폴더만 추출
        direct_child_folders: set[str] = set()
        for fp in all_folder_paths:
            if fp == normalized_path:
                continue
            relative = fp[len(normalized_path) :]
            parts = relative.split("/")
            if parts[0]:
                child_path = normalized_path + parts[0] + "/"
                direct_child_folders.add(child_path)

        # TaskFolderMeta에서 명시적으로 생성된 빈 폴더 포함
        explicit_result = await db.execute(
            select(TaskFolderMeta.path)
            .where(TaskFolderMeta.task_id == task_id)
            .where(TaskFolderMeta.path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
            .where(TaskFolderMeta.path != normalized_path)
        )
        for explicit_path in explicit_result.scalars():
            relative = explicit_path[len(normalized_path) :]
            parts = relative.split("/")
            if parts[0]:
                child_path = normalized_path + parts[0] + "/"
                direct_child_folders.add(child_path)

        # folder_path별 이미지 수 배치 조회
        counts_result = await db.execute(
            select(TaskImage.folder_path, func.count().label("cnt"))
            .where(TaskImage.task_id == task_id)
            .where(TaskImage.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
            .group_by(TaskImage.folder_path)
        )
        path_image_counts: dict[str, int] = {row.folder_path: row.cnt for row in counts_result}

        # 각 직계 자식 폴더의 FolderInfo 생성
        folders: list[FolderInfo] = []
        for folder_path in sorted(direct_child_folders):
            image_count = sum(cnt for fp, cnt in path_image_counts.items() if fp.startswith(folder_path))
            sub_children: set[str] = set()
            for fp in all_folder_paths:
                if fp == folder_path or not fp.startswith(folder_path):
                    continue
                relative = fp[len(folder_path) :]
                parts = relative.split("/")
                if parts[0]:
                    sub_children.add(parts[0])
            subfolder_count = len(sub_children)
            name = folder_path.rstrip("/").split("/")[-1]
            folders.append(
                FolderInfo(
                    path=folder_path,
                    name=name,
                    image_count=image_count,
                    subfolder_count=subfolder_count,
                )
            )

        # 현재 경로의 이미지 (정확히 일치하는 folder_path)
        total_images_result = await db.execute(
            select(func.count()).where(TaskImage.task_id == task_id).where(TaskImage.folder_path == normalized_path)
        )
        total_images = total_images_result.scalar_one()

        images_result = await db.execute(
            select(TaskImage)
            .where(TaskImage.task_id == task_id)
            .where(TaskImage.folder_path == normalized_path)
            .options(selectinload(TaskImage.image))
            .offset(skip)
            .limit(limit)
        )
        images = [TaskImageResponse.model_validate(ti) for ti in images_result.scalars().all()]

        return TaskFolderContentsResponse(
            current_path=normalized_path,
            folders=folders,
            images=images,
            total_images=total_images,
        )

    async def create_folder(
        self,
        db: AsyncSession,
        task_id: int,
        folder_path: str,
    ) -> str:
        normalized = _normalize_folder_path(folder_path)
        if not normalized:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot create root folder",
            )
        existing = await db.execute(
            select(TaskFolderMeta).where(TaskFolderMeta.task_id == task_id).where(TaskFolderMeta.path == normalized)
        )
        if existing.scalar_one_or_none():
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="Folder already exists",
            )
        meta = TaskFolderMeta(task_id=task_id, path=normalized)
        db.add(meta)
        await db.commit()
        return normalized

    async def delete_folder(
        self,
        db: AsyncSession,
        task_id: int,
        folder_path: str,
    ) -> int:
        """폴더 삭제: TaskImage 레코드 제거 (물리 파일 삭제 없음). 제거된 이미지 수 반환."""
        normalized_path = _normalize_folder_path(folder_path)

        # 명시적 폴더 메타 삭제
        await db.execute(
            delete(TaskFolderMeta)
            .where(TaskFolderMeta.task_id == task_id)
            .where(TaskFolderMeta.path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
        )

        # 해당 폴더 및 하위 폴더의 TaskImage 레코드 삭제
        result = await db.execute(
            delete(TaskImage)
            .where(TaskImage.task_id == task_id)
            .where(TaskImage.folder_path.like(f"{_escape_like(normalized_path)}%", escape="\\"))
        )
        await db.commit()
        return result.rowcount  # type: ignore[attr-defined, no-any-return]

    async def update_folder_path(
        self,
        db: AsyncSession,
        task_id: int,
        old_path: str,
        new_path: str,
    ) -> int:
        """폴더 이름 변경 또는 이동. 업데이트된 TaskImage 수 반환."""
        normalized_old = _normalize_folder_path(old_path)
        normalized_new = _normalize_folder_path(new_path)

        if normalized_old == normalized_new:
            return 0

        if not normalized_old:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot rename root folder",
            )

        if normalized_new.startswith(normalized_old):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move a folder into itself",
            )

        old_prefix_len = len(normalized_old)
        result = await db.execute(
            update(TaskImage)
            .where(TaskImage.task_id == task_id)
            .where(TaskImage.folder_path.like(f"{_escape_like(normalized_old)}%", escape="\\"))
            .values(
                folder_path=func.concat(
                    normalized_new,
                    func.substr(TaskImage.folder_path, old_prefix_len + 1),
                )
            )
        )
        await db.execute(
            update(TaskFolderMeta)
            .where(TaskFolderMeta.task_id == task_id)
            .where(TaskFolderMeta.path.like(f"{_escape_like(normalized_old)}%", escape="\\"))
            .values(
                path=func.concat(
                    normalized_new,
                    func.substr(TaskFolderMeta.path, old_prefix_len + 1),
                )
            )
        )
        await db.commit()
        return result.rowcount  # type: ignore[attr-defined, no-any-return]

    async def get_all_folder_paths(
        self,
        db: AsyncSession,
        task_id: int,
    ) -> list[str]:
        """태스크의 모든 폴더 경로 반환 (중간 부모 포함)."""
        result = await db.execute(
            select(TaskImage.folder_path)
            .where(TaskImage.task_id == task_id)
            .where(TaskImage.folder_path != "")
            .distinct()
        )
        raw_paths: list[str] = list(result.scalars().all())

        explicit_result = await db.execute(
            select(TaskFolderMeta.path).where(TaskFolderMeta.task_id == task_id).where(TaskFolderMeta.path != "")
        )
        raw_paths.extend(explicit_result.scalars().all())

        all_folders: set[str] = set()
        for p in raw_paths:
            parts = p.rstrip("/").split("/")
            for i in range(len(parts)):
                all_folders.add("/".join(parts[: i + 1]) + "/")

        return sorted(all_folders)

    async def batch_move_images(
        self,
        db: AsyncSession,
        task_image_ids: list[int],
        target_folder: str,
    ) -> int:
        if not task_image_ids:
            return 0
        normalized = _normalize_folder_path(target_folder)
        result = await db.execute(
            update(TaskImage).where(TaskImage.id.in_(task_image_ids)).values(folder_path=normalized)
        )
        await db.commit()
        return result.rowcount  # type: ignore[attr-defined, no-any-return]

    async def batch_remove_images(
        self,
        db: AsyncSession,
        task_id: int,
        task_image_ids: list[int],
    ) -> int:
        if not task_image_ids:
            return 0
        result = await db.execute(
            delete(TaskImage).where(TaskImage.task_id == task_id).where(TaskImage.id.in_(task_image_ids))
        )
        await db.commit()
        return result.rowcount  # type: ignore[attr-defined, no-any-return]


task_service = TaskService()
