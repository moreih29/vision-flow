from datetime import datetime

from pydantic import BaseModel


class ProjectCreate(BaseModel):
    name: str
    description: str | None = None


class ProjectUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class ProjectResponse(BaseModel):
    id: int
    name: str
    description: str | None
    owner_id: int
    created_at: datetime
    updated_at: datetime
    data_store_count: int = 0

    model_config = {"from_attributes": True}
