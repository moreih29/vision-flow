from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class TaskSnapshotItem(Base):
    __tablename__ = "task_snapshot_items"

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    snapshot_id: Mapped[int] = mapped_column(
        ForeignKey("task_snapshots.id", ondelete="CASCADE"), nullable=False, index=True
    )
    image_id: Mapped[int | None] = mapped_column(ForeignKey("images.id", ondelete="SET NULL"), nullable=True)
    folder_path: Mapped[str] = mapped_column(String(1000), nullable=False, default="")
    annotation_data: Mapped[list] = mapped_column(JSONB, nullable=False, server_default=text("'[]'::jsonb"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (UniqueConstraint("snapshot_id", "image_id"),)

    # relationships
    snapshot: Mapped["TaskSnapshot"] = relationship(back_populates="items")
    image: Mapped["Image"] = relationship()
