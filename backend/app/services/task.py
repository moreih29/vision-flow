from fastapi import HTTPException, status
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.image import Image
from app.models.label_class import LabelClass
from app.models.task import Task
from app.models.task_image import TaskImage
from app.schemas.task import TaskCreate, TaskUpdate
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

    async def get_tasks_by_project(self, db: AsyncSession, project_id: int) -> list[tuple[Task, int, int]]:
        """태스크 목록과 image_count, class_count를 한 번의 쿼리로 조회."""
        stmt = (
            select(
                Task,
                func.count(func.distinct(TaskImage.id)).label("image_count"),
                func.count(func.distinct(LabelClass.id)).label("class_count"),
            )
            .outerjoin(TaskImage, TaskImage.task_id == Task.id)
            .outerjoin(LabelClass, LabelClass.task_id == Task.id)
            .where(Task.project_id == project_id)
            .group_by(Task.id)
        )
        result = await db.execute(stmt)
        return list(result.all())  # type: ignore[arg-type]

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

    async def add_images(self, db: AsyncSession, task_id: int, image_ids: list[int]) -> list[TaskImage]:
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
        existing_result = await db.execute(
            select(TaskImage).where(
                TaskImage.task_id == task_id,
                TaskImage.image_id.in_(image_ids),
            )
        )
        existing_ids = {ti.image_id for ti in existing_result.scalars().all()}
        new_ids = [iid for iid in image_ids if iid not in existing_ids]
        task_images = [TaskImage(task_id=task_id, image_id=iid) for iid in new_ids]
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


task_service = TaskService()
