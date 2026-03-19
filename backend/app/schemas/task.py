from datetime import datetime

from pydantic import BaseModel

from app.models.enums import TaskType


class TaskCreate(BaseModel):
    name: str
    description: str | None = None
    task_type: TaskType


class TaskUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class TaskResponse(BaseModel):
    id: int
    name: str
    description: str | None
    task_type: str
    status: str
    project_id: int
    created_at: datetime
    updated_at: datetime
    image_count: int = 0
    labeled_count: int = 0
    class_count: int = 0

    model_config = {"from_attributes": True}
