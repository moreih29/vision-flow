from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_store import DataStore
from app.models.image import Image
from app.schemas.data_store import DataStoreCreate, DataStoreUpdate
from app.services.image import _resolve_keys_to_delete
from app.services.project import project_service
from app.storage.base import StorageBackend


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

    async def get_data_stores_by_project(self, db: AsyncSession, project_id: int) -> list[tuple[DataStore, int]]:
        stmt = (
            select(DataStore, func.count(Image.id).label("image_count"))
            .outerjoin(Image, Image.data_store_id == DataStore.id)
            .where(DataStore.project_id == project_id)
            .group_by(DataStore.id)
        )
        result = await db.execute(stmt)
        return list(result.all())  # type: ignore[arg-type]

    async def get_data_store(self, db: AsyncSession, data_store_id: int) -> DataStore:
        result = await db.execute(select(DataStore).where(DataStore.id == data_store_id))
        data_store = result.scalar_one_or_none()
        if data_store is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="DataStore not found",
            )
        return data_store

    async def check_ownership(self, db: AsyncSession, data_store: DataStore, user_id: int) -> None:
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
        self,
        db: AsyncSession,
        data_store_id: int,
        user_id: int,
        storage: StorageBackend,
    ) -> None:
        data_store = await self.get_data_store(db, data_store_id)
        await self.check_ownership(db, data_store, user_id)

        # 삭제 전 물리 파일 정리: 이 DataStore만 참조하는 storage_key 수집
        keys_result = await db.execute(select(Image.storage_key).where(Image.data_store_id == data_store_id).distinct())
        candidate_keys = list(keys_result.scalars().all())
        target_ids_result = await db.execute(select(Image.id).where(Image.data_store_id == data_store_id))
        target_ids = set(target_ids_result.scalars().all())

        keys_to_delete = await _resolve_keys_to_delete(db, candidate_keys, target_ids)

        await db.delete(data_store)
        await db.commit()

        for key in keys_to_delete:
            await storage.delete(key)

    async def get_image_count(self, db: AsyncSession, data_store_id: int) -> int:
        result = await db.execute(select(func.count()).where(Image.data_store_id == data_store_id))
        return result.scalar_one()


data_store_service = DataStoreService()
