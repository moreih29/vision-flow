from datetime import datetime

from pydantic import BaseModel, Field


class DataStoreCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class DataStoreUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class DataStoreResponse(BaseModel):
    id: int
    name: str
    description: str | None
    project_id: int
    created_at: datetime
    updated_at: datetime
    image_count: int = 0

    model_config = {"from_attributes": True}
