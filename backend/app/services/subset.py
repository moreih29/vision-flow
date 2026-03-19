from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models.image import Image
from app.models.subset import Subset
from app.models.subset_image import SubsetImage
from app.schemas.subset import SubsetCreate, SubsetUpdate
from app.services.project import project_service


class SubsetService:
    async def create_subset(
        self,
        db: AsyncSession,
        project_id: int,
        user_id: int,
        subset_in: SubsetCreate,
    ) -> Subset:
        project = await project_service.get_project(db, project_id)
        await project_service._check_ownership(project, user_id)
        subset = Subset(
            name=subset_in.name,
            description=subset_in.description,
            task=subset_in.task.value,
            project_id=project_id,
        )
        db.add(subset)
        await db.commit()
        await db.refresh(subset)
        return subset

    async def get_subsets_by_project(
        self, db: AsyncSession, project_id: int
    ) -> list[Subset]:
        result = await db.execute(
            select(Subset).where(Subset.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_subset(self, db: AsyncSession, subset_id: int) -> Subset:
        result = await db.execute(select(Subset).where(Subset.id == subset_id))
        subset = result.scalar_one_or_none()
        if subset is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subset not found",
            )
        return subset

    async def update_subset(
        self,
        db: AsyncSession,
        subset_id: int,
        user_id: int,
        subset_in: SubsetUpdate,
    ) -> Subset:
        subset = await self.get_subset(db, subset_id)
        project = await project_service.get_project(db, subset.project_id)
        await project_service._check_ownership(project, user_id)
        if subset_in.name is not None:
            subset.name = subset_in.name
        if subset_in.description is not None:
            subset.description = subset_in.description
        await db.commit()
        await db.refresh(subset)
        return subset

    async def delete_subset(
        self, db: AsyncSession, subset_id: int, user_id: int
    ) -> None:
        subset = await self.get_subset(db, subset_id)
        project = await project_service.get_project(db, subset.project_id)
        await project_service._check_ownership(project, user_id)
        await db.delete(subset)
        await db.commit()

    async def add_images(
        self, db: AsyncSession, subset_id: int, image_ids: list[int]
    ) -> list[SubsetImage]:
        # verify subset exists
        await self.get_subset(db, subset_id)
        # verify all images exist
        result = await db.execute(select(Image).where(Image.id.in_(image_ids)))
        found_images = result.scalars().all()
        found_ids = {img.id for img in found_images}
        missing = set(image_ids) - found_ids
        if missing:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Images not found: {sorted(missing)}",
            )
        # check which are already linked
        existing_result = await db.execute(
            select(SubsetImage).where(
                SubsetImage.subset_id == subset_id,
                SubsetImage.image_id.in_(image_ids),
            )
        )
        existing_ids = {si.image_id for si in existing_result.scalars().all()}
        new_ids = [iid for iid in image_ids if iid not in existing_ids]
        subset_images = [
            SubsetImage(subset_id=subset_id, image_id=iid) for iid in new_ids
        ]
        db.add_all(subset_images)
        await db.commit()
        # Re-query with eager loading to avoid MissingGreenlet on image relationship
        if new_ids:
            result = await db.execute(
                select(SubsetImage)
                .where(
                    SubsetImage.subset_id == subset_id,
                    SubsetImage.image_id.in_(new_ids),
                )
                .options(selectinload(SubsetImage.image))
            )
            return list(result.scalars().all())
        return []

    async def remove_images(
        self, db: AsyncSession, subset_id: int, image_ids: list[int]
    ) -> None:
        await self.get_subset(db, subset_id)
        result = await db.execute(
            select(SubsetImage).where(
                SubsetImage.subset_id == subset_id,
                SubsetImage.image_id.in_(image_ids),
            )
        )
        subset_images = result.scalars().all()
        for si in subset_images:
            await db.delete(si)
        await db.commit()

    async def get_images(
        self, db: AsyncSession, subset_id: int, skip: int, limit: int
    ) -> tuple[list[SubsetImage], int]:
        await self.get_subset(db, subset_id)
        count_result = await db.execute(
            select(func.count()).where(SubsetImage.subset_id == subset_id)
        )
        total = count_result.scalar_one()
        result = await db.execute(
            select(SubsetImage)
            .where(SubsetImage.subset_id == subset_id)
            .options(selectinload(SubsetImage.image))
            .offset(skip)
            .limit(limit)
        )
        subset_images = list(result.scalars().all())
        return subset_images, total

    async def get_image_count(self, db: AsyncSession, subset_id: int) -> int:
        result = await db.execute(
            select(func.count()).where(SubsetImage.subset_id == subset_id)
        )
        return result.scalar_one()

    async def get_class_count(self, db: AsyncSession, subset_id: int) -> int:
        from app.models.label_class import LabelClass

        result = await db.execute(
            select(func.count()).where(LabelClass.subset_id == subset_id)
        )
        return result.scalar_one()


subset_service = SubsetService()
