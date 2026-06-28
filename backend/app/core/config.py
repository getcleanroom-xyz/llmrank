from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://user:password@localhost:5432/llmrank"
    OPENROUTER_API_KEY: str = ""
    SECRET_KEY: str = "dev-secret-change-in-production"
    CORS_ORIGINS: str = "http://localhost:3000"
    RATE_LIMIT_PER_MINUTE: int = 10
    BMC_WEBHOOK_SECRET: str = ""  # Buy Me a Coffee webhook secret (deprecated)
    BMC_USERNAME: str = "llmrank"  # Buy Me a Coffee username for links
    RP_ID: str = "localhost"  # WebAuthn Relying Party ID
    RP_ORIGIN: str = "http://localhost:3000"  # WebAuthn origin URL
    SESSION_EXPIRE_HOURS: int = 720  # 30 days
    FLW_SECRET_KEY: str = ""  # Flutterwave secret key
    FLW_SECRET_HASH: str = ""  # Flutterwave webhook secret hash
    FLW_PUBLIC_KEY: str = ""  # Flutterwave public key (for frontend)
    FLW_BASE_URL: str = "https://api.flutterwave.com/v3"  # Production URL

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.CORS_ORIGINS.split(",") if o.strip()]

    class Config:
        env_file = ".env"


settings = Settings()
