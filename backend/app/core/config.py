from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str
    JWT_SECRET_KEY: str
    JWT_ACCESS_TOKEN_EXPIRES_MINUTES: int = 60
    CORS_ALLOWED_ORIGINS: str = "http://localhost:5173"

    BLOB_STORAGE_ACCOUNT: str = ""
    BLOB_STORAGE_CONNECTION_STRING: str = ""  # REF-33a: full Azure Blob connection string
    BLOB_STORAGE_CONTAINER_RESUMES: str = "resumes"
    BLOB_STORAGE_CONTAINER_EXPORTS: str = "exports"
    BLOB_STORAGE_CONTAINER_AI_OUTPUTS: str = "ai-outputs"

    SERVICE_BUS_CONNECTION_STRING: str = ""
    AI_FOUNDRY_ENDPOINT: str = ""
    AI_FOUNDRY_API_KEY: str = ""
    GAMMA_API_KEY: str = ""
    APPLICATION_INSIGHTS_CONNECTION_STRING: str = ""

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
