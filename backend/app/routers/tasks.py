from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.task import Task
from app.models.user import User
from app.schemas.task import TaskCreate, TaskResponse, TaskUpdate
from app.schemas.task_image import (
    TaskImageAdd,
    TaskImageListResponse,
    TaskImageRemove,
    TaskImageResponse,
)
from app.services.project import project_service
from app.services.task import task_service

router = APIRouter(tags=["tasks"])


async def _build_response(db: AsyncSession, task: Task) -> TaskResponse:
    image_count = await task_service.get_image_count(db, task.id)
    class_count = await task_service.get_class_count(db, task.id)
    response = TaskResponse.model_validate(task)
    response.image_count = image_count
    response.class_count = class_count
    return response


@router.post(
    "/projects/{project_id}/tasks",
    response_model=TaskResponse,
    status_code=201,
)
async def create_task(
    project_id: int,
    task_in: TaskCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskResponse:
    """프로젝트에 새 Task를 생성합니다."""
    task = await task_service.create_task(
        db, project_id, current_user.id, task_in
    )
    response = TaskResponse.model_validate(task)
    response.image_count = 0
    response.class_count = 0
    return response


@router.get(
    "/projects/{project_id}/tasks", response_model=list[TaskResponse]
)
async def list_tasks(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskResponse]:
    """프로젝트의 모든 Task를 조회합니다."""
    await project_service.get_project_with_ownership(
        db, project_id, current_user.id
    )
    rows = await task_service.get_tasks_by_project(db, project_id)
    result = []
    for task, image_count, class_count in rows:
        response = TaskResponse.model_validate(task)
        response.image_count = image_count
        response.class_count = class_count
        result.append(response)
    return result


@router.get("/tasks/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskResponse:
    """Task를 ID로 조회합니다."""
    task = await task_service.check_ownership(db, task_id, current_user.id)
    return await _build_response(db, task)


@router.put("/tasks/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_in: TaskUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskResponse:
    """Task를 수정합니다."""
    task = await task_service.update_task(
        db, task_id, current_user.id, task_in
    )
    return await _build_response(db, task)


@router.delete("/tasks/{task_id}", status_code=204)
async def delete_task(
    task_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Task를 삭제합니다."""
    await task_service.delete_task(db, task_id, current_user.id)


@router.post(
    "/tasks/{task_id}/images",
    response_model=list[TaskImageResponse],
    status_code=201,
)
async def add_images(
    task_id: int,
    body: TaskImageAdd,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[TaskImageResponse]:
    """Task에 이미지를 추가합니다."""
    await task_service.check_ownership(db, task_id, current_user.id)
    task_images = await task_service.add_images(
        db, task_id, body.image_ids
    )
    return [TaskImageResponse.model_validate(ti) for ti in task_images]


@router.delete("/tasks/{task_id}/images", status_code=204)
async def remove_images(
    task_id: int,
    body: TaskImageRemove,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Task에서 이미지를 제거합니다."""
    await task_service.check_ownership(db, task_id, current_user.id)
    await task_service.remove_images(db, task_id, body.image_ids)


@router.get(
    "/tasks/{task_id}/images", response_model=TaskImageListResponse
)
async def list_task_images(
    task_id: int,
    skip: int = Query(default=0, ge=0),
    limit: int = Query(default=50, ge=1, le=500),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TaskImageListResponse:
    """Task의 이미지 목록을 페이지네이션으로 조회합니다."""
    await task_service.check_ownership(db, task_id, current_user.id)
    task_images, total = await task_service.get_images(
        db, task_id, skip, limit
    )
    return TaskImageListResponse(
        images=[
            TaskImageResponse.model_validate(ti) for ti in task_images
        ],
        total=total,
        skip=skip,
        limit=limit,
    )
