from datetime import datetime

from pydantic import BaseModel

from app.schemas.image import FolderInfo, ImageResponse


class TaskImageAdd(BaseModel):
    image_ids: list[int]
    folder_path: str = ""


class TaskImageRemove(BaseModel):
    image_ids: list[int]


class TaskImageResponse(BaseModel):
    id: int
    task_id: int
    image_id: int
    folder_path: str
    added_at: datetime
    image: ImageResponse

    model_config = {"from_attributes": True}


class TaskImageListResponse(BaseModel):
    images: list[TaskImageResponse]
    total: int
    skip: int
    limit: int


class TaskImageBatchMove(BaseModel):
    task_image_ids: list[int]
    target_folder: str


class TaskImageBatchRemove(BaseModel):
    task_image_ids: list[int]


class TaskFolderContentsResponse(BaseModel):
    current_path: str
    folders: list[FolderInfo]
    images: list[TaskImageResponse]
    total_images: int
