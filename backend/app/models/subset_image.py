from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


class SubsetImage(Base):
    __tablename__ = "subset_images"
    __table_args__ = (UniqueConstraint("subset_id", "image_id"),)

    id: Mapped[int] = mapped_column(primary_key=True, index=True)
    subset_id: Mapped[int] = mapped_column(ForeignKey("subsets.id"), nullable=False)
    image_id: Mapped[int] = mapped_column(ForeignKey("images.id"), nullable=False)
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # relationships
    subset: Mapped["Subset"] = relationship(back_populates="subset_images")
    image: Mapped["Image"] = relationship()
