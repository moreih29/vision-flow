from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_store import DataStore
from app.models.image import Image
from app.schemas.data_store import DataStoreCreate, DataStoreUpdate
from app.services.project import project_service


class DataStoreService:
    async def create_data_store(
        self,
        db: AsyncSession,
        project_id: int,
        user_id: int,
        data_store_in: DataStoreCreate,
    ) -> DataStore:
        # verify project exists and user owns it
        project = await project_service.get_project(db, project_id)
        await project_service.check_ownership(project, user_id)
        data_store = DataStore(
            name=data_store_in.name,
            description=data_store_in.description,
            project_id=project_id,
        )
        db.add(data_store)
        await db.commit()
        await db.refresh(data_store)
        return data_store

    async def get_data_stores_by_project(
        self, db: AsyncSession, project_id: int
    ) -> list[DataStore]:
        result = await db.execute(
            select(DataStore).where(DataStore.project_id == project_id)
        )
        return list(result.scalars().all())

    async def get_data_store(self, db: AsyncSession, data_store_id: int) -> DataStore:
        result = await db.execute(select(DataStore).where(DataStore.id == data_store_id))
        data_store = result.scalar_one_or_none()
        if data_store is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="DataStore not found",
            )
        return data_store

    async def check_ownership(
        self, db: AsyncSession, data_store: DataStore, user_id: int
    ) -> None:
        project = await project_service.get_project(db, data_store.project_id)
        await project_service.check_ownership(project, user_id)

    async def update_data_store(
        self,
        db: AsyncSession,
        data_store_id: int,
        user_id: int,
        data_store_in: DataStoreUpdate,
    ) -> DataStore:
        data_store = await self.get_data_store(db, data_store_id)
        await self.check_ownership(db, data_store, user_id)
        if data_store_in.name is not None:
            data_store.name = data_store_in.name
        if data_store_in.description is not None:
            data_store.description = data_store_in.description
        await db.commit()
        await db.refresh(data_store)
        return data_store

    async def delete_data_store(
        self, db: AsyncSession, data_store_id: int, user_id: int
    ) -> None:
        data_store = await self.get_data_store(db, data_store_id)
        await self.check_ownership(db, data_store, user_id)
        await db.delete(data_store)
        await db.commit()

    async def get_image_count(self, db: AsyncSession, data_store_id: int) -> int:
        result = await db.execute(
            select(func.count()).where(Image.data_store_id == data_store_id)
        )
        return result.scalar_one()


data_store_service = DataStoreService()
