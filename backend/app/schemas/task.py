from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import TaskType


class TaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    task_type: TaskType


class TaskUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


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
