from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.dataset import Dataset
from app.models.image import Image
from app.schemas.dataset import DatasetCreate, DatasetUpdate
from app.services.project import project_service


class DatasetService:
    async def create_dataset(
        self,
        db: AsyncSession,
        project_id: int,
        user_id: int,
        dataset_in: DatasetCreate,
    ) -> Dataset:
        # verify project exists and user owns it
        project = await project_service.get_project(db, project_id)
        await project_service._check_ownership(project, user_id)
        dataset = Dataset(
            name=dataset_in.name,
            description=dataset_in.description,
            project_id=project_id,
        )
        db.add(dataset)
        await db.commit()
        await db.refresh(dataset)
        return dataset

    async def get_datasets_by_project(
        self, db: AsyncSession, project_id: int
    ) -> list[Dataset]:
        result = await db.execute(
            select(Dataset).where(Dataset.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_dataset(self, db: AsyncSession, dataset_id: int) -> Dataset:
        result = await db.execute(select(Dataset).where(Dataset.id == dataset_id))
        dataset = result.scalar_one_or_none()
        if dataset is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Dataset not found",
            )
        return dataset

    async def _check_ownership(
        self, db: AsyncSession, dataset: Dataset, user_id: int
    ) -> None:
        project = await project_service.get_project(db, dataset.project_id)
        await project_service._check_ownership(project, user_id)

    async def update_dataset(
        self,
        db: AsyncSession,
        dataset_id: int,
        user_id: int,
        dataset_in: DatasetUpdate,
    ) -> Dataset:
        dataset = await self.get_dataset(db, dataset_id)
        await self._check_ownership(db, dataset, user_id)
        if dataset_in.name is not None:
            dataset.name = dataset_in.name
        if dataset_in.description is not None:
            dataset.description = dataset_in.description
        await db.commit()
        await db.refresh(dataset)
        return dataset

    async def delete_dataset(
        self, db: AsyncSession, dataset_id: int, user_id: int
    ) -> None:
        dataset = await self.get_dataset(db, dataset_id)
        await self._check_ownership(db, dataset, user_id)
        await db.delete(dataset)
        await db.commit()

    async def get_image_count(self, db: AsyncSession, dataset_id: int) -> int:
        result = await db.execute(
            select(func.count()).where(Image.dataset_id == dataset_id)
        )
        return result.scalar_one()


dataset_service = DatasetService()
