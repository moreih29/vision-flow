from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.task_image import TaskImage
from app.models.user import User
from app.schemas.annotation import (
    AnnotationCreate,
    AnnotationResponse,
    AnnotationUpdate,
    BulkSaveRequest,
    BulkSaveResponse,
)
from app.services.annotation import annotation_service
from app.services.task import task_service

router = APIRouter(tags=["annotations"])


@router.get(
    "/tasks/{task_id}/images/{image_id}/labels",
    response_model=list[AnnotationResponse],
)
async def list_annotations(
    task_id: int,
    image_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[AnnotationResponse]:
    """이미지별 어노테이션 목록을 조회합니다."""
    await task_service.check_ownership(db, task_id, current_user.id)
    task_image = await annotation_service.get_task_image(db, task_id, image_id)
    annotations = await annotation_service.get_annotations(db, task_image.id)
    return [AnnotationResponse.model_validate(a) for a in annotations]


@router.post(
    "/tasks/{task_id}/images/{image_id}/labels",
    response_model=AnnotationResponse,
    status_code=201,
)
async def create_annotation(
    task_id: int,
    image_id: int,
    annotation_in: AnnotationCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnnotationResponse:
    """이미지에 어노테이션을 생성합니다."""
    await task_service.check_ownership(db, task_id, current_user.id)
    task_image = await annotation_service.get_task_image(db, task_id, image_id)
    annotation = await annotation_service.create_annotation(db, task_image.id, annotation_in)
    return AnnotationResponse.model_validate(annotation)


@router.put(
    "/tasks/{task_id}/images/{image_id}/labels",
    response_model=BulkSaveResponse,
)
async def bulk_save_annotations(
    task_id: int,
    image_id: int,
    body: BulkSaveRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> BulkSaveResponse:
    """이미지의 어노테이션을 전체 교체합니다 (Bulk 저장)."""
    await task_service.check_ownership(db, task_id, current_user.id)
    task_image = await annotation_service.get_task_image(db, task_id, image_id)
    annotations = await annotation_service.bulk_save(db, task_image.id, body.annotations)
    return BulkSaveResponse(annotations=[AnnotationResponse.model_validate(a) for a in annotations])


@router.put("/labels/{label_id}", response_model=AnnotationResponse)
async def update_annotation(
    label_id: int,
    annotation_in: AnnotationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> AnnotationResponse:
    """어노테이션을 수정합니다."""
    annotation = await annotation_service.get_annotation(db, label_id)
    ti_result = await db.execute(select(TaskImage).where(TaskImage.id == annotation.task_image_id))
    task_image = ti_result.scalar_one_or_none()
    if task_image is not None:
        await task_service.check_ownership(db, task_image.task_id, current_user.id)
    annotation = await annotation_service.update_annotation(db, label_id, annotation_in)
    return AnnotationResponse.model_validate(annotation)


@router.delete("/labels/{label_id}", status_code=204)
async def delete_annotation(
    label_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """어노테이션을 삭제합니다."""
    annotation = await annotation_service.get_annotation(db, label_id)
    ti_result = await db.execute(select(TaskImage).where(TaskImage.id == annotation.task_image_id))
    task_image = ti_result.scalar_one_or_none()
    if task_image is not None:
        await task_service.check_ownership(db, task_image.task_id, current_user.id)
    await annotation_service.delete_annotation(db, label_id)
