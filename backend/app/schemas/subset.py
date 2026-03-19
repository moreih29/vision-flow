from datetime import datetime

from pydantic import BaseModel

from app.models.enums import TaskType


class SubsetCreate(BaseModel):
    name: str
    description: str | None = None
    task: TaskType


class SubsetUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class SubsetResponse(BaseModel):
    id: int
    name: str
    description: str | None
    task: str
    project_id: int
    created_at: datetime
    updated_at: datetime
    image_count: int = 0
    labeled_count: int = 0
    class_count: int = 0

    model_config = {"from_attributes": True}
