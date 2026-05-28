from pydantic_settings import BaseSettings
from typing import Optional


class Settings(BaseSettings):
    # Database
    database_url: str
    database_url_sync: str

    # Auth
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 1440  # 24 hours

    # Anthropic
    anthropic_api_key: str

    # Confidence score
    chat_confidence_floor: int = 60

    # File storage
    upload_dir: str = "/app/uploads"
    max_upload_size_mb: int = 100

    class Config:
        env_file = ".env"
        case_sensitive = False


settings = Settings()
