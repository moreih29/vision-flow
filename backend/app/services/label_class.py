from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.annotation import Annotation
from app.models.label_class import LabelClass
from app.schemas.label_class import LabelClassCreate, LabelClassUpdate


class LabelClassService:
    async def create_class(
        self,
        db: AsyncSession,
        task_id: int,
        class_in: LabelClassCreate,
    ) -> LabelClass:
        label_class = LabelClass(
            name=class_in.name,
            color=class_in.color,
            task_id=task_id,
        )
        db.add(label_class)
        await db.commit()
        await db.refresh(label_class)
        return label_class

    async def get_classes(self, db: AsyncSession, task_id: int) -> list[LabelClass]:
        result = await db.execute(select(LabelClass).where(LabelClass.task_id == task_id))
        return list(result.scalars().all())

    async def get_classes_with_counts(self, db: AsyncSession, task_id: int) -> list[tuple[LabelClass, int]]:
        """label_count(annotation 수)와 함께 label class 목록 조회."""
        stmt = (
            select(LabelClass, func.count(Annotation.id).label("label_count"))
            .outerjoin(Annotation, Annotation.label_class_id == LabelClass.id)
            .where(LabelClass.task_id == task_id)
            .group_by(LabelClass.id)
        )
        result = await db.execute(stmt)
        return list(result.all())

    async def get_class(self, db: AsyncSession, class_id: int) -> LabelClass:
        result = await db.execute(select(LabelClass).where(LabelClass.id == class_id))
        label_class = result.scalar_one_or_none()
        if label_class is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Label class not found",
            )
        return label_class

    async def update_class(
        self,
        db: AsyncSession,
        class_id: int,
        class_in: LabelClassUpdate,
    ) -> LabelClass:
        label_class = await self.get_class(db, class_id)
        if class_in.name is not None:
            label_class.name = class_in.name
        if class_in.color is not None:
            label_class.color = class_in.color
        await db.commit()
        await db.refresh(label_class)
        return label_class

    async def delete_class(self, db: AsyncSession, class_id: int) -> None:
        label_class = await self.get_class(db, class_id)
        await db.delete(label_class)
        await db.commit()


label_class_service = LabelClassService()
