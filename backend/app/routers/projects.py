from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.dependencies import get_current_user, get_db
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectResponse, ProjectUpdate
from app.services.project import project_service

router = APIRouter(prefix="/projects", tags=["projects"])


@router.post("", response_model=ProjectResponse, status_code=201)
async def create_project(
    project_in: ProjectCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    """Create a new project."""
    project = await project_service.create_project(db, current_user, project_in)
    dataset_count = await project_service.get_dataset_count(db, project.id)
    response = ProjectResponse.model_validate(project)
    response.dataset_count = dataset_count
    return response


@router.get("", response_model=list[ProjectResponse])
async def list_projects(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> list[ProjectResponse]:
    """List all projects owned by the current user."""
    projects = await project_service.get_projects_by_user(db, current_user.id)
    result = []
    for project in projects:
        dataset_count = await project_service.get_dataset_count(db, project.id)
        response = ProjectResponse.model_validate(project)
        response.dataset_count = dataset_count
        result.append(response)
    return result


@router.get("/{project_id}", response_model=ProjectResponse)
async def get_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    """Get a project by ID."""
    project = await project_service.get_project(db, project_id)
    dataset_count = await project_service.get_dataset_count(db, project.id)
    response = ProjectResponse.model_validate(project)
    response.dataset_count = dataset_count
    return response


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: int,
    project_in: ProjectUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> ProjectResponse:
    """Update a project."""
    project = await project_service.update_project(
        db, project_id, current_user.id, project_in
    )
    dataset_count = await project_service.get_dataset_count(db, project.id)
    response = ProjectResponse.model_validate(project)
    response.dataset_count = dataset_count
    return response


@router.delete("/{project_id}", status_code=204)
async def delete_project(
    project_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Delete a project."""
    await project_service.delete_project(db, project_id, current_user.id)
