from datetime import datetime

from pydantic import BaseModel


class DataStoreCreate(BaseModel):
    name: str
    description: str | None = None


class DataStoreUpdate(BaseModel):
    name: str | None = None
    description: str | None = None


class DataStoreResponse(BaseModel):
    id: int
    name: str
    description: str | None
    project_id: int
    created_at: datetime
    updated_at: datetime
    image_count: int = 0

    model_config = {"from_attributes": True}
