import enum


class TaskType(str, enum.Enum):
    CLASSIFICATION = "classification"
    OBJECT_DETECTION = "object_detection"
    INSTANCE_SEGMENTATION = "instance_segmentation"
    POSE_ESTIMATION = "pose_estimation"


class TaskStatus(str, enum.Enum):
    DRAFT = "draft"
    LABELING = "labeling"
    READY = "ready"
    TRAINING = "training"
    COMPLETED = "completed"
