from fastapi import HTTPException, status
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.annotation import Annotation
from app.models.task_image import TaskImage
from app.schemas.annotation import AnnotationCreate, AnnotationUpdate


class AnnotationService:
    async def get_task_image(self, db: AsyncSession, task_id: int, image_id: int) -> TaskImage:
        """task_id + image_id 조합으로 TaskImage 조회, 없으면 404."""
        result = await db.execute(
            select(TaskImage).where(
                TaskImage.task_id == task_id,
                TaskImage.image_id == image_id,
            )
        )
        task_image = result.scalar_one_or_none()
        if task_image is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task image not found",
            )
        return task_image

    async def get_annotations(self, db: AsyncSession, task_image_id: int) -> list[Annotation]:
        """이미지별 전체 어노테이션 조회."""
        result = await db.execute(select(Annotation).where(Annotation.task_image_id == task_image_id))
        return list(result.scalars().all())

    async def get_annotation(self, db: AsyncSession, annotation_id: int) -> Annotation:
        """단일 어노테이션 조회, 없으면 404."""
        result = await db.execute(select(Annotation).where(Annotation.id == annotation_id))
        annotation = result.scalar_one_or_none()
        if annotation is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Annotation not found",
            )
        return annotation

    async def create_annotation(
        self,
        db: AsyncSession,
        task_image_id: int,
        annotation_in: AnnotationCreate,
    ) -> Annotation:
        """단일 어노테이션 생성."""
        annotation = Annotation(
            task_image_id=task_image_id,
            label_class_id=annotation_in.label_class_id,
            annotation_type=annotation_in.annotation_type,
            data=annotation_in.data,
        )
        db.add(annotation)
        await db.commit()
        await db.refresh(annotation)
        return annotation

    async def update_annotation(
        self,
        db: AsyncSession,
        annotation_id: int,
        annotation_in: AnnotationUpdate,
    ) -> Annotation:
        """어노테이션 수정."""
        annotation = await self.get_annotation(db, annotation_id)
        if annotation_in.label_class_id is not None:
            annotation.label_class_id = annotation_in.label_class_id
        if annotation_in.data is not None:
            annotation.data = annotation_in.data
        await db.commit()
        await db.refresh(annotation)
        return annotation

    async def delete_annotation(self, db: AsyncSession, annotation_id: int) -> None:
        """어노테이션 삭제."""
        annotation = await self.get_annotation(db, annotation_id)
        await db.delete(annotation)
        await db.commit()

    async def bulk_save(
        self,
        db: AsyncSession,
        task_image_id: int,
        annotations: list[AnnotationCreate],
    ) -> list[Annotation]:
        """기존 전체 삭제 후 새로 삽입 (전체 교체)."""
        await db.execute(delete(Annotation).where(Annotation.task_image_id == task_image_id))
        new_annotations = [
            Annotation(
                task_image_id=task_image_id,
                label_class_id=a.label_class_id,
                annotation_type=a.annotation_type,
                data=a.data,
            )
            for a in annotations
        ]
        db.add_all(new_annotations)
        await db.commit()
        for ann in new_annotations:
            await db.refresh(ann)
        return new_annotations


annotation_service = AnnotationService()
