from datetime import datetime

from pydantic import BaseModel, Field

from app.models.enums import TaskType


class ClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(min_length=4, max_length=7)  # hex color


class TaskCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    task_type: TaskType
    classes: list[ClassCreate] = Field(min_length=2)


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
