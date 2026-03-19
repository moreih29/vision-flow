from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.data_store import DataStoreCreate, DataStoreResponse, DataStoreUpdate
from app.services.data_store import data_store_service

router = APIRouter(tags=["data-stores"])


@router.post(
    "/projects/{project_id}/data-stores",
    response_model=DataStoreResponse,
    status_code=201,
)
async def create_data_store(
    project_id: int,
    data_store_in: DataStoreCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DataStoreResponse:
    """프로젝트에 새 DataStore를 생성합니다."""
    data_store = await data_store_service.create_data_store(
        db, project_id, current_user.id, data_store_in
    )
    image_count = await data_store_service.get_image_count(db, data_store.id)
    response = DataStoreResponse.model_validate(data_store)
    response.image_count = image_count
    return response


@router.get(
    "/projects/{project_id}/data-stores", response_model=list[DataStoreResponse]
)
async def list_data_stores(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DataStoreResponse]:
    """프로젝트의 모든 DataStore를 조회합니다."""
    data_stores = await data_store_service.get_data_stores_by_project(db, project_id)
    result = []
    for data_store in data_stores:
        image_count = await data_store_service.get_image_count(db, data_store.id)
        response = DataStoreResponse.model_validate(data_store)
        response.image_count = image_count
        result.append(response)
    return result


@router.get("/data-stores/{data_store_id}", response_model=DataStoreResponse)
async def get_data_store(
    data_store_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DataStoreResponse:
    """DataStore를 ID로 조회합니다."""
    data_store = await data_store_service.get_data_store(db, data_store_id)
    image_count = await data_store_service.get_image_count(db, data_store.id)
    response = DataStoreResponse.model_validate(data_store)
    response.image_count = image_count
    return response


@router.put("/data-stores/{data_store_id}", response_model=DataStoreResponse)
async def update_data_store(
    data_store_id: int,
    data_store_in: DataStoreUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DataStoreResponse:
    """DataStore를 수정합니다."""
    data_store = await data_store_service.update_data_store(
        db, data_store_id, current_user.id, data_store_in
    )
    image_count = await data_store_service.get_image_count(db, data_store.id)
    response = DataStoreResponse.model_validate(data_store)
    response.image_count = image_count
    return response


@router.delete("/data-stores/{data_store_id}", status_code=204)
async def delete_data_store(
    data_store_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """DataStore를 삭제합니다."""
    await data_store_service.delete_data_store(db, data_store_id, current_user.id)
