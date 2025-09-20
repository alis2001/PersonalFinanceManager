"""
Receipt Processing Service Configuration - Matching Existing Architecture
Location: services/receipt-processor/src/config/settings.py
"""

import os
from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Receipt processing service settings - matches existing service patterns"""
    
    # Application Info
    VERSION: str = "1.0.0"
    APP_NAME: str = "Receipt Processing Service"
    ENVIRONMENT: str = Field(default="development", env="APP_ENV")
    
    # Server Configuration
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8008)
    DEBUG: bool = Field(default=False)
    
    # Database Configuration (PostgreSQL) - EXACT SAME AS OTHER SERVICES
    DB_HOST: str = Field(default="postgres", env="DB_HOST")
    DB_PORT: int = Field(default=5432, env="DB_PORT")
    DB_NAME: str = Field(default="finance_tracker", env="DB_NAME")
    DB_USER: str = Field(default="finance_user", env="DB_USER")
    DB_PASSWORD: str = Field(default="finance_password", env="DB_PASSWORD")
    
    # Redis Configuration - EXACT SAME AS OTHER SERVICES
    REDIS_HOST: str = Field(default="redis", env="REDIS_HOST")
    REDIS_PORT: int = Field(default=6379, env="REDIS_PORT")
    
    # Security & Authentication - EXACT SAME AS OTHER SERVICES
    JWT_SECRET: str = Field(default="your-secret-key-here", env="JWT_SECRET")
    JWT_ALGORITHM: str = Field(default="HS256")
    JWT_EXPIRY: str = Field(default="1h", env="JWT_EXPIRY")
    
    # Service URLs - MATCHING EXISTING PATTERN
    AUTH_SERVICE_URL: str = Field(default="http://auth:3000", env="AUTH_SERVICE_URL")
    EXPENSE_SERVICE_URL: str = Field(default="http://expense:3000", env="EXPENSE_SERVICE_URL")
    CATEGORY_SERVICE_URL: str = Field(default="http://category:3000", env="CATEGORY_SERVICE_URL")
    
    # File Upload Configuration
    MAX_FILE_SIZE: int = Field(default=10 * 1024 * 1024)  # 10MB
    ALLOWED_EXTENSIONS: List[str] = Field(default=[
        ".jpg", ".jpeg", ".png",  # Images
        ".pdf",                   # PDF documents
        ".txt",                   # Text files
        ".xlsx", ".xls",          # Excel files
        ".csv"                    # CSV files
    ])
    UPLOAD_DIR: str = Field(default="uploads")
    
    # Transaction Processing Configuration
    MAX_TRANSACTIONS_PER_FILE: int = Field(default=5)
    MIN_TRANSACTION_AMOUNT: float = Field(default=0.01)  # Minimum amount to consider
    
    # File Type Processing Limits
    MAX_PDF_PAGES: int = Field(default=10)  # Maximum PDF pages to process
    MAX_EXCEL_ROWS: int = Field(default=1000)  # Maximum Excel rows to scan
    MAX_TEXT_LENGTH: int = Field(default=50000)  # Maximum text file length
    
    # OCR Configuration
    OCR_LANGUAGES: List[str] = Field(default=["en", "fa", "ar"])  # English, Persian, Arabic
    OCR_GPU: bool = Field(default=False)
    
    # AI Processing Configuration
    ANTHROPIC_API_KEY: str = Field(default="", env="ANTHROPIC_API_KEY")
    GROQ_API_KEY: str = Field(default="", env="GROQ_API_KEY")
    AI_TIMEOUT: int = Field(default=30)
    
    # Processing Configuration
    PROCESSING_TIMEOUT: int = Field(default=120)  # 2 minutes
    RETRY_ATTEMPTS: int = Field(default=3)
    REQUEST_TIMEOUT: int = Field(default=60)
    
    # Cache Configuration - MATCHING ANALYTICS SERVICE
    CACHE_TTL_DEFAULT: int = Field(default=3600)  # 1 hour
    CACHE_TTL_SHORT: int = Field(default=300)     # 5 minutes
    CACHE_TTL_LONG: int = Field(default=86400)    # 24 hours
    CACHE_PREFIX: str = Field(default="receipt")
    
    # CORS Configuration - MATCHING EXISTING PATTERN
    ALLOWED_ORIGINS: List[str] = Field(default=[
        "http://localhost:3000",  # React frontend
        "http://localhost:8080",  # Gateway
        "*"  # Allow all for development
    ])
    
    # Rate Limiting - MATCHING EXISTING PATTERN
    RATE_LIMIT_REQUESTS: int = Field(default=100)
    RATE_LIMIT_WINDOW: int = Field(default=900)  # 15 minutes
    
    # Logging Configuration - EXACT SAME AS OTHER SERVICES
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    
    @property
    def database_url(self) -> str:
        """Construct database URL - same pattern as analytics service"""
        return f"postgresql+asyncpg://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"
    
    @property
    def redis_url(self) -> str:
        """Construct Redis URL - same pattern as analytics service"""
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