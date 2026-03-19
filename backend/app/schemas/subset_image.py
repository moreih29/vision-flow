from datetime import datetime

from pydantic import BaseModel

from app.schemas.image import ImageResponse


class SubsetImageAdd(BaseModel):
    image_ids: list[int]


class SubsetImageRemove(BaseModel):
    image_ids: list[int]


class SubsetImageResponse(BaseModel):
    id: int
    subset_id: int
    image_id: int
    added_at: datetime
    image: ImageResponse

    model_config = {"from_attributes": True}


class SubsetImageListResponse(BaseModel):
    images: list[SubsetImageResponse]
    total: int
