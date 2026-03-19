from datetime import datetime

from pydantic import BaseModel

from app.schemas.image import ImageResponse


class TaskImageAdd(BaseModel):
    image_ids: list[int]


class TaskImageRemove(BaseModel):
    image_ids: list[int]


class TaskImageResponse(BaseModel):
    id: int
    task_id: int
    image_id: int
    added_at: datetime
    image: ImageResponse

    model_config = {"from_attributes": True}


class TaskImageListResponse(BaseModel):
    images: list[TaskImageResponse]
    total: int
    skip: int
    limit: int
