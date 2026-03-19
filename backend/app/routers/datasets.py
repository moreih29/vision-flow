from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.dataset import DatasetCreate, DatasetResponse, DatasetUpdate
from app.services.dataset import dataset_service

router = APIRouter(tags=["datasets"])


@router.post(
    "/projects/{project_id}/datasets",
    response_model=DatasetResponse,
    status_code=201,
)
async def create_dataset(
    project_id: int,
    dataset_in: DatasetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DatasetResponse:
    """Create a new dataset in a project."""
    dataset = await dataset_service.create_dataset(
        db, project_id, current_user.id, dataset_in
    )
    image_count = await dataset_service.get_image_count(db, dataset.id)
    response = DatasetResponse.model_validate(dataset)
    response.image_count = image_count
    return response


@router.get(
    "/projects/{project_id}/datasets", response_model=list[DatasetResponse]
)
async def list_datasets(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[DatasetResponse]:
    """List all datasets in a project."""
    datasets = await dataset_service.get_datasets_by_project(db, project_id)
    result = []
    for dataset in datasets:
        image_count = await dataset_service.get_image_count(db, dataset.id)
        response = DatasetResponse.model_validate(dataset)
        response.image_count = image_count
        result.append(response)
    return result


@router.get("/datasets/{dataset_id}", response_model=DatasetResponse)
async def get_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DatasetResponse:
    """Get a dataset by ID."""
    dataset = await dataset_service.get_dataset(db, dataset_id)
    image_count = await dataset_service.get_image_count(db, dataset.id)
    response = DatasetResponse.model_validate(dataset)
    response.image_count = image_count
    return response


@router.put("/datasets/{dataset_id}", response_model=DatasetResponse)
async def update_dataset(
    dataset_id: int,
    dataset_in: DatasetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> DatasetResponse:
    """Update a dataset."""
    dataset = await dataset_service.update_dataset(
        db, dataset_id, current_user.id, dataset_in
    )
    image_count = await dataset_service.get_image_count(db, dataset.id)
    response = DatasetResponse.model_validate(dataset)
    response.image_count = image_count
    return response


@router.delete("/datasets/{dataset_id}", status_code=204)
async def delete_dataset(
    dataset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a dataset."""
    await dataset_service.delete_dataset(db, dataset_id, current_user.id)
