from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base
from app.models.enums import TaskStatus


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(20), nullable=False, default=TaskStatus.DRAFT, server_default="draft")
    project_id: Mapped[int] = mapped_column(ForeignKey("projects.id"), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # relationships
    project: Mapped["Project"] = relationship(back_populates="tasks")
    task_images: Mapped[list["TaskImage"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    label_classes: Mapped[list["LabelClass"]] = relationship(back_populates="task", cascade="all, delete-orphan")
    task_folder_meta: Mapped[list["TaskFolderMeta"]] = relationship(cascade="all, delete-orphan")
