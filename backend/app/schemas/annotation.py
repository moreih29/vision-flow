from datetime import datetime

from pydantic import BaseModel, Field


class AnnotationCreate(BaseModel):
    label_class_id: int | None = None
    annotation_type: str = Field(min_length=1, max_length=20)
    data: dict = Field(default_factory=dict)


class AnnotationUpdate(BaseModel):
    label_class_id: int | None = None
    data: dict | None = None


class AnnotationResponse(BaseModel):
    id: int
    task_image_id: int
    label_class_id: int | None
    annotation_type: str
    data: dict
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class BulkSaveRequest(BaseModel):
    annotations: list[AnnotationCreate]


class BulkSaveResponse(BaseModel):
    annotations: list[AnnotationResponse]
