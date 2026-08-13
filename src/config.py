from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    ADMIN_LOGIN: str
    ADMIN_PASSWORD: str
    SECRET_KEY: str
    DB_HOST: str
    DB_PORT: int
    MARIADB_USER: str
    MARIADB_PASSWORD: str
    MARIADB_DATABASE: str
    REDIS_HOST: str

    # Optional long-lived secret for the owner-only content API. When set, it can
    # be sent as the "X-Owner-Key" header to authorize write endpoints from
    # cURL/Postman without the login -> JWT dance. Leave empty to disable that
    # path entirely (admin JWT is then the only way in).
    OWNER_API_KEY: str | None = None

    @property
    def database_url(self): return (
        f"mysql+aiomysql://{self.MARIADB_USER}:{self.MARIADB_PASSWORD}" f"@{self.DB_HOST}:{self.DB_PORT}/{self.MARIADB_DATABASE}")

    class Config:
        env_file = ".env"


settings = Settings()
DATABASE_URL = settings.database_url