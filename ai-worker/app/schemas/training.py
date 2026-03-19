from enum import Enum
from typing import Any

from pydantic import BaseModel, Field


class ModelType(str, Enum):
    yolo11n = "yolo11n"
    yolo11s = "yolo11s"
    yolo11m = "yolo11m"
    yolo11l = "yolo11l"
    yolo11x = "yolo11x"


class ExportFormat(str, Enum):
    onnx = "onnx"
    torchscript = "torchscript"
    tflite = "tflite"
    coreml = "coreml"


class TaskStatus(str, Enum):
    pending = "PENDING"
    started = "STARTED"
    progress = "PROGRESS"
    success = "SUCCESS"
    failure = "FAILURE"
    revoked = "REVOKED"


class TrainingRequest(BaseModel):
    project_id: str
    dataset_version: str
    model_type: ModelType = ModelType.yolo11n
    epochs: int = Field(default=100, ge=1, le=1000)
    batch_size: int = Field(default=16, ge=1)
    img_size: int = Field(default=640, ge=32)
    learning_rate: float = Field(default=0.01, gt=0.0)
    patience: int = Field(default=50, ge=1)
    device: str = Field(default="cpu", description="Training device: cpu, 0, 0,1, etc.")
    pretrained: bool = True
    extra_config: dict[str, Any] = Field(default_factory=dict)


class TrainingMetrics(BaseModel):
    epoch: int | None = None
    total_epochs: int | None = None
    box_loss: float | None = None
    cls_loss: float | None = None
    dfl_loss: float | None = None
    precision: float | None = None
    recall: float | None = None
    map50: float | None = None
    map50_95: float | None = None


class TrainingStatus(BaseModel):
    task_id: str
    status: TaskStatus
    progress: float = Field(default=0.0, ge=0.0, le=100.0)
    metrics: TrainingMetrics | None = None
    model_path: str | None = None
    error: str | None = None


class InferenceRequest(BaseModel):
    model_path: str
    confidence: float = Field(default=0.25, ge=0.0, le=1.0)
    iou_threshold: float = Field(default=0.45, ge=0.0, le=1.0)
    img_size: int = Field(default=640, ge=32)
    device: str = Field(default="cpu")


class DetectionBox(BaseModel):
    x1: float
    y1: float
    x2: float
    y2: float
    confidence: float
    class_id: int
    class_name: str


class InferenceResponse(BaseModel):
    task_id: str | None = None
    model_path: str
    detections: list[DetectionBox] = Field(default_factory=list)
    inference_time_ms: float | None = None
    image_width: int | None = None
    image_height: int | None = None
