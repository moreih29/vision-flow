from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/1"
    storage_base_path: str = "./data/storage"
    models_base_path: str = "./data/models"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
