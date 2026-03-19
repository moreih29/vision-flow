from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_store import DataStore
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    async def create_project(
        self, db: AsyncSession, user: User, project_in: ProjectCreate
    ) -> Project:
        project = Project(
            name=project_in.name,
            description=project_in.description,
            owner_id=user.id,
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        return project

    async def get_projects_by_user(
        self, db: AsyncSession, user_id: int
    ) -> list[Project]:
        result = await db.execute(select(Project).where(Project.owner_id == user_id))
        return list(result.scalars().all())

    async def get_project(self, db: AsyncSession, project_id: int) -> Project:
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
        return project

    async def _check_ownership(self, project: Project, user_id: int) -> None:
        if project.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )

    async def update_project(
        self,
        db: AsyncSession,
        project_id: int,
        user_id: int,
        project_in: ProjectUpdate,
    ) -> Project:
        project = await self.get_project(db, project_id)
        await self._check_ownership(project, user_id)
        if project_in.name is not None:
            project.name = project_in.name
        if project_in.description is not None:
            project.description = project_in.description
        await db.commit()
        await db.refresh(project)
        return project

    async def delete_project(
        self, db: AsyncSession, project_id: int, user_id: int
    ) -> None:
        project = await self.get_project(db, project_id)
        await self._check_ownership(project, user_id)
        await db.delete(project)
        await db.commit()

    async def get_data_store_count(self, db: AsyncSession, project_id: int) -> int:
        result = await db.execute(
            select(func.count()).where(DataStore.project_id == project_id)
        )
        return result.scalar_one()


project_service = ProjectService()
