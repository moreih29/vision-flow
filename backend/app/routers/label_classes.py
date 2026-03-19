from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.label_class import (
    LabelClassCreate,
    LabelClassResponse,
    LabelClassUpdate,
)
from app.services.label_class import label_class_service
from app.services.task import task_service

router = APIRouter(tags=["label_classes"])


@router.post(
    "/tasks/{task_id}/classes",
    response_model=LabelClassResponse,
    status_code=201,
)
async def create_class(
    task_id: int,
    class_in: LabelClassCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LabelClassResponse:
    """Create a new label class in a task."""
    await task_service.check_ownership(db, task_id, current_user.id)
    label_class = await label_class_service.create_class(db, task_id, class_in)
    return LabelClassResponse.model_validate(label_class)


@router.get(
    "/tasks/{task_id}/classes", response_model=list[LabelClassResponse]
)
async def list_classes(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[LabelClassResponse]:
    """List all label classes in a task."""
    await task_service.check_ownership(db, task_id, current_user.id)
    classes = await label_class_service.get_classes(db, task_id)
    return [LabelClassResponse.model_validate(c) for c in classes]


@router.put("/classes/{class_id}", response_model=LabelClassResponse)
async def update_class(
    class_id: int,
    class_in: LabelClassUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LabelClassResponse:
    """Update a label class."""
    label_class = await label_class_service.get_class(db, class_id)
    await task_service.check_ownership(db, label_class.task_id, current_user.id)
    label_class = await label_class_service.update_class(db, class_id, class_in)
    return LabelClassResponse.model_validate(label_class)


@router.delete("/classes/{class_id}", status_code=204)
async def delete_class(
    class_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a label class."""
    label_class = await label_class_service.get_class(db, class_id)
    await task_service.check_ownership(db, label_class.task_id, current_user.id)
    await label_class_service.delete_class(db, class_id)
