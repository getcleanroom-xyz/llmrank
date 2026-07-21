import secrets as _secrets
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/llmrank"
    OPENROUTER_API_KEY: str = ""
    SECRET_KEY: str = "dev-secret-change-in-production"
    CORS_ORIGINS: str = "http://localhost:3000"
    RATE_LIMIT_PER_MINUTE: int = 10
    RP_ID: str = "localhost"  # WebAuthn Relying Party ID
    RP_ORIGIN: str = "http://localhost:3000"  # WebAuthn origin URL
    SESSION_EXPIRE_HOURS: int = 720  # 30 days
    FLW_CLIENT_ID: str = ""  # Flutterwave v4 client ID
    FLW_CLIENT_SECRET: str = ""  # Flutterwave v4 client secret
    FLW_ENCRYPTION_KEY: str = ""  # Flutterwave v4 encryption key (base64 encoded, for client-side card encryption)
    FLW_SECRET_HASH: str = ""  # Flutterwave webhook secret hash
    FLW_SANDBOX: bool = False  # Set true for sandbox mode
    RESEND_API_KEY: str = ""
    ADMIN_EMAILS: str = ""
    CAMPAIGN_FROM_EMAIL: str = "marketing@llmranked.org"
    NEW_USER_CREDITS: int = 500

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    @property
    def admin_emails_list(self) -> list[str]:
        return [e.strip() for e in self.ADMIN_EMAILS.split(",") if e.strip()]


def _create_settings() -> Settings:
    s = Settings()
    if s.SECRET_KEY == "dev-secret-change-in-production":
        import logging as _logging
        _logging.getLogger(__name__).warning(
            "SECRET_KEY is the default value — generating random key for this session. "
            "Set SECRET_KEY env var for production."
        )
        object.__setattr__(s, "SECRET_KEY", _secrets.token_hex(32))
    return s


settings = _create_settings()
