"""
Simplified Analytics Service Configuration
Location: services/analytics/src/config/settings.py
"""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Simplified application settings with environment variable support"""
    
    # Application Info
    VERSION: str = "1.0.0"
    APP_NAME: str = "Finance Analytics Service"
    ENVIRONMENT: str = Field(default="development", env="APP_ENV")
    
    # Server Configuration
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    DEBUG: bool = Field(default=False)
    
    # Database Configuration (PostgreSQL)
    DB_HOST: str = Field(default="postgres", env="DB_HOST")
    DB_PORT: int = Field(default=5432, env="DB_PORT")
    DB_NAME: str = Field(default="finance_tracker", env="DB_NAME")
    DB_USER: str = Field(default="finance_user", env="DB_USER")
    DB_PASSWORD: str = Field(default="finance_password", env="DB_PASSWORD")
    
    # Redis Configuration
    REDIS_HOST: str = Field(default="redis", env="REDIS_HOST")
    REDIS_PORT: int = Field(default=6379, env="REDIS_PORT")
    
    # Cache Configuration
    CACHE_TTL_DEFAULT: int = Field(default=3600)  # 1 hour
    CACHE_TTL_SHORT: int = Field(default=300)     # 5 minutes
    CACHE_TTL_LONG: int = Field(default=86400)    # 24 hours
    CACHE_PREFIX: str = Field(default="analytics")
    
    # Security & Authentication
    JWT_SECRET: str = Field(default="your-secret-key-here", env="JWT_SECRET")
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_EXPIRY: str = Field(default="1h", env="JWT_EXPIRY")
    
    # CORS Configuration (simplified)
    ALLOWED_ORIGINS: List[str] = Field(default=[
        "http://localhost:3000",  # React frontend
        "http://localhost:8080",  # Gateway
        "*"  # Allow all for development
    ])
    
    # Rate Limiting
    RATE_LIMIT_REQUESTS: int = Field(default=100)
    RATE_LIMIT_WINDOW: int = Field(default=900)  # 15 minutes
    
    # Logging Configuration
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    
    # Analytics Configuration
    MAX_DATA_POINTS: int = Field(default=10000)
    DEFAULT_PERIOD: str = Field(default="monthly")
    
    # Simple properties
    @property
    def database_url(self) -> str:
        """Construct database URL from components"""
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def redis_url(self) -> str:
        """Construct Redis URL from components"""
        return f"redis://{self.REDIS_HOST}:{self.REDIS_PORT}/0"
    
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