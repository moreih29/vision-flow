from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.data_store import DataStore
from app.models.project import Project
from app.models.user import User
from app.schemas.project import ProjectCreate, ProjectUpdate


class ProjectService:
    async def create_project(self, db: AsyncSession, user: User, project_in: ProjectCreate) -> Project:
        project = Project(
            name=project_in.name,
            description=project_in.description,
            owner_id=user.id,
        )
        db.add(project)
        await db.commit()
        await db.refresh(project)
        return project

    async def get_projects_by_user(self, db: AsyncSession, user_id: int) -> list[tuple[Project, int]]:
        """프로젝트 목록과 data_store_count를 한 번의 쿼리로 조회."""
        stmt = (
            select(Project, func.count(DataStore.id).label("data_store_count"))
            .outerjoin(DataStore, DataStore.project_id == Project.id)
            .where(Project.owner_id == user_id)
            .group_by(Project.id)
        )
        result = await db.execute(stmt)
        return list(result.all())  # type: ignore[arg-type]

    async def get_project(self, db: AsyncSession, project_id: int) -> Project:
        result = await db.execute(select(Project).where(Project.id == project_id))
        project = result.scalar_one_or_none()
        if project is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Project not found",
            )
        return project

    async def check_ownership(self, project: Project, user_id: int) -> None:
        if project.owner_id != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Not enough permissions",
            )

    async def get_project_with_ownership(self, db: AsyncSession, project_id: int, user_id: int) -> Project:
        project = await self.get_project(db, project_id)
        await self.check_ownership(project, user_id)
        return project

    async def update_project(
        self,
        db: AsyncSession,
        project_id: int,
        user_id: int,
        project_in: ProjectUpdate,
    ) -> Project:
        project = await self.get_project_with_ownership(db, project_id, user_id)
        if project_in.name is not None:
            project.name = project_in.name
        if project_in.description is not None:
            project.description = project_in.description
        await db.commit()
        await db.refresh(project)
        return project

    async def delete_project(self, db: AsyncSession, project_id: int, user_id: int) -> None:
        project = await self.get_project_with_ownership(db, project_id, user_id)
        await db.delete(project)
        await db.commit()

    async def get_data_store_count(self, db: AsyncSession, project_id: int) -> int:
        result = await db.execute(select(func.count()).where(DataStore.project_id == project_id))
        return result.scalar_one()


project_service = ProjectService()
