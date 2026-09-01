from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# backend/app_service/core/config.py -> backend/.env
_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"

# Local SQLite fallback for development when PostgreSQL is unavailable.
_DEFAULT_SQLITE_DB = Path(__file__).resolve().parent.parent / "scam_detection.db"


class Settings(BaseSettings):
    """Single source of truth for all runtime configuration.

    Values are read from environment variables first, falling back to a
    local `.env` file. See `.env.example` for the full list of supported
    keys and their meaning.
    """

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # App
    APP_NAME: str = "Scam Detection Application Service"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_PREFIX: str = "/api/v1"

    # Security / JWT
    SECRET_KEY: str = Field(
        default="scamguard_development_secret_key_minimum_32_chars_123456789",
        min_length=32,
    )
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 15
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database
    # Local development can use sqlite if PostgreSQL is unavailable.
    DATABASE_URL: str = f"sqlite:///{_DEFAULT_SQLITE_DB}"

    # Internal service-to-service URL for calling ml_service
    ML_SERVICE_URL: str = "http://localhost:8002"

    # CORS
    #
    # Deliberately a plain str, NOT List[str]. pydantic-settings treats
    # List[...] as a "complex" type and attempts to json.loads() any
    # value read from a .env file or environment variable for such
    # fields BEFORE any Pydantic field_validator runs. A value like
    # "http://localhost:3000" is not valid JSON, so that json.loads()
    # call raises pydantic_settings.SettingsError and crashes the
    # application on startup -- every time, for every developer who
    # follows .env.example, regardless of any other configuration.
    # Storing this as a str (a "simple" type, never JSON-decoded) and
    # parsing it ourselves via the property below avoids the bug
    # entirely.
    CORS_ORIGINS: str = "http://localhost:3000,https://frontend-psi-ebon-83.vercel.app"

    # Rate limiting
    RATE_LIMIT_DEFAULT: str = "100/minute"
    RATE_LIMIT_AUTH: str = "10/minute"

    # ---- Logging ----
    LOG_LEVEL: str = "INFO"

    # ---- OCR ----
    TESSERACT_CMD: str | None = None

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.CORS_ORIGINS.split(",") if origin.strip()]

    @property
    def get_sqlalchemy_database_url(self) -> str:
        if self.DATABASE_URL.startswith("postgres://"):
            return self.DATABASE_URL.replace("postgres://", "postgresql://", 1)
        return self.DATABASE_URL


@lru_cache
def get_settings() -> Settings:
    """Cached settings accessor. Settings are read once per process."""
    return Settings()
