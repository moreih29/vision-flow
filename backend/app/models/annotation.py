from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class Annotation(Base):
    __tablename__ = "annotations"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_image_id: Mapped[int] = mapped_column(
        ForeignKey("task_images.id", ondelete="CASCADE"), nullable=False, index=True
    )
    label_class_id: Mapped[int | None] = mapped_column(ForeignKey("label_classes.id"), nullable=True)
    annotation_type: Mapped[str] = mapped_column(String(20), nullable=False)
    data: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default=text("'{}'::jsonb"))
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
    task_image: Mapped["TaskImage"] = relationship(back_populates="annotations")
    label_class: Mapped["LabelClass | None"] = relationship()
