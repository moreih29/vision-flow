from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.subset import SubsetCreate, SubsetResponse, SubsetUpdate
from app.schemas.subset_image import (
    SubsetImageAdd,
    SubsetImageListResponse,
    SubsetImageRemove,
    SubsetImageResponse,
)
from app.services.subset import subset_service

router = APIRouter(tags=["subsets"])


@router.post(
    "/projects/{project_id}/subsets",
    response_model=SubsetResponse,
    status_code=201,
)
async def create_subset(
    project_id: int,
    subset_in: SubsetCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubsetResponse:
    """Create a new subset in a project."""
    subset = await subset_service.create_subset(
        db, project_id, current_user.id, subset_in
    )
    image_count = await subset_service.get_image_count(db, subset.id)
    class_count = await subset_service.get_class_count(db, subset.id)
    response = SubsetResponse.model_validate(subset)
    response.image_count = image_count
    response.class_count = class_count
    return response


@router.get(
    "/projects/{project_id}/subsets", response_model=list[SubsetResponse]
)
async def list_subsets(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SubsetResponse]:
    """List all subsets in a project."""
    subsets = await subset_service.get_subsets_by_project(db, project_id)
    result = []
    for subset in subsets:
        image_count = await subset_service.get_image_count(db, subset.id)
        class_count = await subset_service.get_class_count(db, subset.id)
        response = SubsetResponse.model_validate(subset)
        response.image_count = image_count
        response.class_count = class_count
        result.append(response)
    return result


@router.get("/subsets/{subset_id}", response_model=SubsetResponse)
async def get_subset(
    subset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubsetResponse:
    """Get a subset by ID."""
    subset = await subset_service.get_subset(db, subset_id)
    image_count = await subset_service.get_image_count(db, subset.id)
    class_count = await subset_service.get_class_count(db, subset.id)
    response = SubsetResponse.model_validate(subset)
    response.image_count = image_count
    response.class_count = class_count
    return response


@router.put("/subsets/{subset_id}", response_model=SubsetResponse)
async def update_subset(
    subset_id: int,
    subset_in: SubsetUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubsetResponse:
    """Update a subset."""
    subset = await subset_service.update_subset(
        db, subset_id, current_user.id, subset_in
    )
    image_count = await subset_service.get_image_count(db, subset.id)
    class_count = await subset_service.get_class_count(db, subset.id)
    response = SubsetResponse.model_validate(subset)
    response.image_count = image_count
    response.class_count = class_count
    return response


@router.delete("/subsets/{subset_id}", status_code=204)
async def delete_subset(
    subset_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a subset."""
    await subset_service.delete_subset(db, subset_id, current_user.id)


@router.post(
    "/subsets/{subset_id}/images",
    response_model=list[SubsetImageResponse],
    status_code=201,
)
async def add_images(
    subset_id: int,
    body: SubsetImageAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[SubsetImageResponse]:
    """Add images to a subset."""
    subset_images = await subset_service.add_images(
        db, subset_id, body.image_ids
    )
    return [SubsetImageResponse.model_validate(si) for si in subset_images]


@router.delete("/subsets/{subset_id}/images", status_code=204)
async def remove_images(
    subset_id: int,
    body: SubsetImageRemove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Remove images from a subset."""
    await subset_service.remove_images(db, subset_id, body.image_ids)


@router.get(
    "/subsets/{subset_id}/images", response_model=SubsetImageListResponse
)
async def list_subset_images(
    subset_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> SubsetImageListResponse:
    """List images in a subset with pagination."""
    subset_images, total = await subset_service.get_images(
        db, subset_id, skip, limit
    )
    return SubsetImageListResponse(
        images=[
            SubsetImageResponse.model_validate(si) for si in subset_images
        ],
        total=total,
    )
