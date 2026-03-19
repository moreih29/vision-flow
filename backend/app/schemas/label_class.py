from datetime import datetime

from pydantic import BaseModel


class LabelClassCreate(BaseModel):
    name: str
    color: str


class LabelClassUpdate(BaseModel):
    name: str | None = None
    color: str | None = None


class LabelClassResponse(BaseModel):
    id: int
    name: str
    color: str
    task_id: int
    label_count: int = 0
    created_at: datetime

    model_config = {"from_attributes": True}
