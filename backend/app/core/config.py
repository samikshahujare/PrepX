import os
from pathlib import Path
from typing import List, Union
from urllib.parse import quote_plus
from dotenv import load_dotenv
from pydantic import AnyHttpUrl, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
load_dotenv(_BACKEND_DIR / ".env")
load_dotenv(_BACKEND_DIR.parent / ".env")


class Settings(BaseSettings):
    # Application settings
    APP_NAME: str = "PrepX Backend API"
    APP_ENV: str = "development"
    DEBUG: bool = True
    API_V1_STR: str = "/api/v1"

    # Security settings
    SECRET_KEY: str = "default_insecure_secret_key_change_in_production"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # Database settings (PostgreSQL - port 5432)
    POSTGRES_SERVER: str = "localhost"
    POSTGRES_PORT: int = 5432
    POSTGRES_USER: str = "postgres"
    POSTGRES_PASSWORD: str = "postgres"
    POSTGRES_DB: str = "prepx_db"
    DATABASE_URL: Union[str, None] = None

    @property
    def sync_database_url(self) -> str:
        if self.DATABASE_URL:
            url = self.DATABASE_URL
            if url.startswith("postgres://"):
                url = url.replace("postgres://", "postgresql://", 1)
            return url
        encoded_password = quote_plus(self.POSTGRES_PASSWORD) if self.POSTGRES_PASSWORD else ""
        return (
            f"postgresql://{self.POSTGRES_USER}:{encoded_password}@"
            f"{self.POSTGRES_SERVER}:{self.POSTGRES_PORT}/{self.POSTGRES_DB}"
        )

    # Public URL / Host Configuration for Invitations & Deployments
    APP_PUBLIC_URL: Union[str, None] = None
    FRONTEND_URL: str = "http://localhost:3000"

    @property
    def canonical_frontend_url(self) -> str:
        """Returns the public application origin without trailing slash."""
        url = self.APP_PUBLIC_URL or self.FRONTEND_URL or "http://localhost:3000"
        return url.strip().rstrip("/")

    # CORS Configuration
    CORS_ORIGINS: Union[str, List[str]] = [
        "http://localhost:3000",
        "http://localhost:8080",
        "http://127.0.0.1:3000",
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
        origins = []
        if isinstance(v, str) and not v.startswith("["):
            origins = [i.strip().rstrip("/") for i in v.split(",") if i.strip()]
        elif isinstance(v, list):
            origins = [str(i).strip().rstrip("/") for i in v if str(i).strip()]
        elif isinstance(v, str):
            origins = [v.strip().rstrip("/")]
        else:
            raise ValueError(v)
        return origins

    # Multi-LLM Provider Configuration (Failover: Gemini -> NVIDIA -> Groq -> OpenRouter)
    LLM_PROVIDER: str = "gemini"
    GEMINI_API_KEY: Union[str, None] = None
    GEMINI_MODEL: str = "gemini-2.5-flash"
    NVIDIA_API_KEY: Union[str, None] = None
    NVIDIA_MODEL: str = "meta/llama-3.2-11b-vision-instruct"
    GROQ_API_KEY: Union[str, None] = None
    GROQ_MODEL: str = "qwen/qwen3.8-27b"
    OPENROUTER_API_KEY: Union[str, None] = None
    OPENROUTER_MODEL: str = "openrouter/free"

    # Local 2D/Canvas AI Interviewer Avatar
    AVATAR_PROVIDER: str = "local"

    model_config = SettingsConfigDict(
        env_file=(
            str(_BACKEND_DIR / ".env"),
            str(_BACKEND_DIR.parent / ".env"),
            ".env",
            "../.env",
        ),
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore",
    )


settings = Settings()
