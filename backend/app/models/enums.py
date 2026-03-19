import enum


class TaskType(enum.StrEnum):
    CLASSIFICATION = "classification"
    OBJECT_DETECTION = "object_detection"
    INSTANCE_SEGMENTATION = "instance_segmentation"
    POSE_ESTIMATION = "pose_estimation"


class TaskStatus(enum.StrEnum):
    DRAFT = "draft"
    LABELING = "labeling"
    READY = "ready"
    TRAINING = "training"
    COMPLETED = "completed"


class AnnotationType(enum.StrEnum):
    CLASSIFICATION = "classification"
    BBOX = "bbox"
    POLYGON = "polygon"
    KEYPOINT = "keypoint"
