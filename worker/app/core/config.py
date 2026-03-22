from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"

    DATABASE_URL: str
    SERVICE_BUS_CONNECTION_STRING: str
    AI_FOUNDRY_ENDPOINT: str = ""
    AI_FOUNDRY_API_KEY: str = ""
    GAMMA_API_KEY: str = ""
    BLOB_STORAGE_ACCOUNT: str = ""

    WORKER_POLL_INTERVAL_SECONDS: int = 2

    class Config:
        env_file = ".env"


settings = Settings()
