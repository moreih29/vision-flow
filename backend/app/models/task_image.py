from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskImage(Base):
    __tablename__ = "task_images"
    __table_args__ = (UniqueConstraint("task_id", "image_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id"), nullable=False)
    image_id: Mapped[int] = mapped_column(ForeignKey("images.id"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # relationships
    task: Mapped["Task"] = relationship(back_populates="task_images")
    image: Mapped["Image"] = relationship()
    annotations: Mapped[list["Annotation"]] = relationship(back_populates="task_image", cascade="all, delete-orphan")
