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
    minor_version: Mapped[int] = mapped_column(Integer, nullable=False)
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
    restored_from_id: Mapped[int | None] = mapped_column(
        Integer, ForeignKey("task_snapshots.id", ondelete="SET NULL"), nullable=True
    )
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
            "minor_version",
            unique=True,
            postgresql_where=text("is_stash = false"),
        ),
    )

    @property
    def version_string(self) -> str:
        return f"v{self.major_version}.{self.minor_version}"

    # relationships
    task: Mapped["Task"] = relationship(back_populates="snapshots", foreign_keys=[task_id])
    items: Mapped[list["TaskSnapshotItem"]] = relationship(back_populates="snapshot", cascade="all, delete-orphan")
