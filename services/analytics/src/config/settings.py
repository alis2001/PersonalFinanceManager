"""
Analytics Service Configuration
Location: services/analytics/src/config/settings.py
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Application settings with environment variable support"""
    
    # Application Info
    VERSION: str = "1.0.0"
    APP_NAME: str = Field(default="Finance Analytics Service", env="APP_NAME")
    ENVIRONMENT: str = Field(default="development", env="APP_ENV")
    
    # Server Configuration
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    DEBUG: bool = Field(default=False)
    
    # Database Configuration (PostgreSQL)
    DB_HOST: str = Field(..., env="DB_HOST")
    DB_PORT: int = Field(default=5432, env="DB_PORT")
    DB_NAME: str = Field(..., env="DB_NAME")
    DB_USER: str = Field(..., env="DB_USER")
    DB_PASSWORD: str = Field(..., env="DB_PASSWORD")
    DB_POOL_SIZE: int = Field(default=20)
    DB_MAX_OVERFLOW: int = Field(default=30)
    DB_POOL_TIMEOUT: int = Field(default=30)
    
    # Redis Configuration
    REDIS_HOST: str = Field(..., env="REDIS_HOST")
    REDIS_PORT: int = Field(default=6379, env="REDIS_PORT")
    REDIS_PASSWORD: Optional[str] = Field(default=None, env="REDIS_PASSWORD")
    REDIS_DB: int = Field(default=0)
    REDIS_POOL_SIZE: int = Field(default=20)
    
    # Cache Configuration
    CACHE_TTL_DEFAULT: int = Field(default=3600)  # 1 hour
    CACHE_TTL_SHORT: int = Field(default=300)     # 5 minutes
    CACHE_TTL_LONG: int = Field(default=86400)    # 24 hours
    CACHE_PREFIX: str = Field(default="analytics")
    
    # Security & Authentication
    JWT_SECRET: str = Field(..., env="JWT_SECRET")
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_EXPIRY: str = Field(default="1h", env="JWT_EXPIRY")
    
    # Service URLs (for calling other microservices)
    AUTH_SERVICE_URL: str = Field(..., env="AUTH_SERVICE_URL")
    EXPENSE_SERVICE_URL: str = Field(..., env="EXPENSE_SERVICE_URL")
    INCOME_SERVICE_URL: str = Field(..., env="INCOME_SERVICE_URL")
    CATEGORY_SERVICE_URL: str = Field(..., env="CATEGORY_SERVICE_URL")
    
    # C++ Engine URLs
    ANALYTICS_ENGINE_URL: str = Field(..., env="ANALYTICS_ENGINE_URL")
    REPORTING_ENGINE_URL: str = Field(..., env="REPORTING_ENGINE_URL")
    ML_ENGINE_URL: str = Field(..., env="ML_ENGINE_URL")
    
    # CORS Configuration
    ALLOWED_ORIGINS: List[str] = Field(default=[
        "http://localhost:3000",  # React frontend
        "http://localhost:8080",  # Gateway
        "http://localhost:8001",  # Auth service
    ])
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100, env="RATE_LIMIT_MAX_REQUESTS")
    RATE_LIMIT_WINDOW: int = Field(default=900, env="RATE_LIMIT_WINDOW")  # 15 minutes
    
    # Logging Configuration
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    LOG_FORMAT: str = Field(default="json")
    LOG_FILE: Optional[str] = Field(default=None)
    
    # Analytics Configuration
    MAX_DATA_POINTS: int = Field(default=10000)
    DEFAULT_PERIOD: str = Field(default="monthly")
    SUPPORTED_PERIODS: List[str] = Field(default=["daily", "weekly", "monthly", "quarterly", "yearly"])
    
    # Machine Learning Configuration
    ML_MODEL_PATH: str = Field(default="/app/models")
    ML_RETRAIN_INTERVAL: int = Field(default=86400)  # 24 hours
    ML_MIN_DATA_POINTS: int = Field(default=30)
    
    # Forecasting Configuration
    FORECAST_DAYS_DEFAULT: int = Field(default=30)
    FORECAST_DAYS_MAX: int = Field(default=365)
    FORECAST_CONFIDENCE_INTERVAL: float = Field(default=0.95)
    
    # Export Configuration
    EXPORT_MAX_RECORDS: int = Field(default=100000)
    EXPORT_FORMATS: List[str] = Field(default=["csv", "xlsx", "json", "pdf"])
    EXPORT_CACHE_TTL: int = Field(default=1800)  # 30 minutes
    
    # Background Tasks
    CELERY_BROKER_URL: Optional[str] = Field(default=None, env="CELERY_BROKER_URL")
    CELERY_RESULT_BACKEND: Optional[str] = Field(default=None, env="CELERY_RESULT_BACKEND")
    
    # Performance Configuration
    ASYNC_POOL_SIZE: int = Field(default=20, env="ASYNC_POOL_SIZE")
    REQUEST_TIMEOUT: int = Field(default=30, env="REQUEST_TIMEOUT")
    
    # Data Processing
    BATCH_SIZE: int = Field(default=1000, env="BATCH_SIZE")
    MAX_CONCURRENT_REQUESTS: int = Field(default=100, env="MAX_CONCURRENT_REQUESTS")
    
    @validator("ALLOWED_ORIGINS", pre=True)
    def parse_cors_origins(cls, v):
        """Parse CORS origins from environment variables"""
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",")]
        return v
    
    @validator("SUPPORTED_PERIODS", pre=True)
    def parse_supported_periods(cls, v):
        """Parse supported periods from environment variables"""
        if isinstance(v, str):
            return [period.strip() for period in v.split(",")]
        return v
    
    @validator("EXPORT_FORMATS", pre=True)
    def parse_export_formats(cls, v):
        """Parse export formats from environment variables"""
        if isinstance(v, str):
            return [fmt.strip() for fmt in v.split(",")]
        return v
    
    @property
    def database_url(self) -> str:
        """Construct database URL from components"""
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def redis_url(self) -> str:
        """Construct Redis URL from components"""
        if self.REDIS_PASSWORD:
            return f"redis://:{self.REDIS_PASSWORD}@{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/{self.REDIS_DB}"
    
    @property
    def is_development(self) -> bool:
        """Check if running in development mode"""
        return self.ENVIRONMENT.lower() == "development"
    
    @property
    def is_production(self) -> bool:
        """Check if running in production mode"""
        return self.ENVIRONMENT.lower() == "production"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Create settings instance
settings = Settings()