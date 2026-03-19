from datetime import datetime

from pydantic import BaseModel, Field


class LabelClassCreate(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    color: str = Field(min_length=1, max_length=30)


class LabelClassUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    color: str | None = Field(default=None, min_length=1, max_length=30)


class LabelClassResponse(BaseModel):
    id: int
    name: str
    color: str
    task_id: int
    label_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
