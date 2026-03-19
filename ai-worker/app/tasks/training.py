from typing import Any

from app.celery_app import celery_app


@celery_app.task(
    bind=True,
    name="app.tasks.training.train_model",
    track_started=True,
)
def train_model(
    self,
    project_id: str,
    dataset_version: str,
    model_config: dict[str, Any],
) -> dict[str, Any]:
    """Train a YOLO model for the given project and dataset version.

    Args:
        project_id: Unique identifier of the project.
        dataset_version: Version string of the dataset to train on.
        model_config: Dictionary containing training hyperparameters
            (model_type, epochs, batch_size, img_size, etc.).

    Returns:
        Dictionary with task result including model_path and final metrics.
    """
    # TODO: implement training logic using YOLOService
    raise NotImplementedError("train_model task is not yet implemented")
