from datetime import datetime

from pydantic import BaseModel


class ImageResponse(BaseModel):
    id: int
    original_filename: str
    storage_key: str
    file_hash: str
    file_size: int
    width: int | None
    height: int | None
    mime_type: str
    folder_path: str
    dataset_id: int
    uploaded_by: int
    created_at: datetime

    model_config = {"from_attributes": True}


class ImageListResponse(BaseModel):
    images: list[ImageResponse]
    total: int


class FolderInfo(BaseModel):
    path: str
    name: str
    image_count: int
    subfolder_count: int


class FolderContentsResponse(BaseModel):
    current_path: str
    folders: list[FolderInfo]
    images: list[ImageResponse]
    total_images: int


class FolderUpdateRequest(BaseModel):
    old_path: str
    new_path: str


class FolderCreateRequest(BaseModel):
    path: str


class BatchDeleteRequest(BaseModel):
    image_ids: list[int]


class BatchMoveRequest(BaseModel):
    image_ids: list[int]
    target_folder: str


class BatchFolderDeleteRequest(BaseModel):
    paths: list[str]


class BatchFolderMoveRequest(BaseModel):
    paths: list[str]
    target_folder: str
