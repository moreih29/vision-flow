from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.image import ImageResponse


class SnapshotCreate(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str | None = Field(default=None, max_length=2000)


class SnapshotResponse(BaseModel):
    id: int
    task_id: int
    major_version: int
    data_version: int
    label_version: int
    is_stash: bool
    name: str
    description: str | None
    image_count: int
    labeled_image_count: int
    annotation_count: int
    class_schema_hash: str | None
    image_set_hash: str | None
    annotation_hash: str | None
    label_classes_snapshot: list[dict]
    created_at: datetime

    model_config = {"from_attributes": True}


class SnapshotItemResponse(BaseModel):
    id: int
    image_id: int
    folder_path: str
    annotation_data: list[dict]
    image: ImageResponse

    model_config = {"from_attributes": True}


class SnapshotItemListResponse(BaseModel):
    items: list[SnapshotItemResponse]
    total: int
    skip: int
    limit: int


class SnapshotDiffResponse(BaseModel):
    added_images: list[int]
    removed_images: list[int]
    added_count: int
    removed_count: int
    annotation_changes: dict
    class_compatible: bool


class VersionChanges(BaseModel):
    class_changed: bool = False
    data_changed: bool = False
    label_changed: bool = False


class VersionStatusResponse(BaseModel):
    current_version: str | None
    is_dirty: bool
    changes: VersionChanges
