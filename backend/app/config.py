from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+asyncpg://postgres:postgres@localhost:5433/vision_flow"
    redis_url: str = "redis://localhost:6379/0"
    jwt_secret_key: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_days: int = 7
    storage_type: str = "local"
    storage_base_path: str = "./data/storage"

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
