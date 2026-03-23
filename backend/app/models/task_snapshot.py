from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, Integer, String, Text, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskSnapshot(Base):
    __tablename__ = "task_snapshots"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    task_id: Mapped[int] = mapped_column(ForeignKey("tasks.id", ondelete="CASCADE"), nullable=False)
    major_version: Mapped[int] = mapped_column(Integer, nullable=False)
    data_version: Mapped[int] = mapped_column(Integer, nullable=False)
    label_version: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    is_stash: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    image_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    labeled_image_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    annotation_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    class_schema_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    image_set_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    annotation_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    label_classes_snapshot: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index(
            "ix_task_snapshots_version_unique",
            "task_id",
            "major_version",
            "data_version",
            "label_version",
            unique=True,
            postgresql_where=text("is_stash = false"),
        ),
    )

    @property
    def version_string(self) -> str:
        return f"v{self.major_version}.{self.data_version}.{self.label_version}"

    # relationships
    task: Mapped["Task"] = relationship(back_populates="snapshots")
    items: Mapped[list["TaskSnapshotItem"]] = relationship(back_populates="snapshot", cascade="all, delete-orphan")
