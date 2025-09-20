"""
Enhanced Receipt Processing Service Configuration
Location: services/receipt-processor/src/config/settings.py
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Enhanced receipt processing service settings with OCR and AI capabilities"""
    
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
    
    # =====================================================
    # RECEIPT PROCESSING SPECIFIC CONFIGURATIONS
    # =====================================================
    
    # Claude AI Configuration
    ANTHROPIC_API_KEY: str = Field(default="", env="ANTHROPIC_API_KEY")
    CLAUDE_MODEL: str = Field(default="claude-3-5-sonnet-20241022")
    CLAUDE_MAX_TOKENS: int = Field(default=4000)
    CLAUDE_TEMPERATURE: float = Field(default=0.1)
    
    # Backup AI Configuration (Groq/OpenAI)
    OPENAI_API_KEY: str = Field(default="", env="OPENAI_API_KEY")
    GROQ_API_KEY: str = Field(default="", env="GROQ_API_KEY")
    BACKUP_MODEL: str = Field(default="gpt-4o-mini")
    
    # File Upload Configuration
    MAX_FILE_SIZE_MB: int = Field(default=10)  # 10MB max per file
    MAX_FILE_SIZE_BYTES: int = Field(default=10 * 1024 * 1024)
    ALLOWED_IMAGE_EXTENSIONS: List[str] = Field(default=[
        ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"
    ])
    ALLOWED_DOCUMENT_EXTENSIONS: List[str] = Field(default=[
        ".pdf", ".xlsx", ".xls", ".csv"
    ])
    
    # File Storage Configuration
    UPLOAD_DIR: str = Field(default="uploads")
    PROCESSED_DIR: str = Field(default="processed")
    FAILED_DIR: str = Field(default="failed")
    TEMP_DIR: str = Field(default="temp")
    
    # OCR Configuration
    OCR_LANGUAGES: List[str] = Field(default=["en", "ar", "fa"])  # English, Arabic, Persian
    OCR_CONFIDENCE_THRESHOLD: float = Field(default=0.6)
    IMAGE_PREPROCESSING: bool = Field(default=True)
    OCR_BATCH_SIZE: int = Field(default=1)
    
    # Processing Configuration
    MAX_TRANSACTIONS_PER_FILE: int = Field(default=5)
    PROCESSING_TIMEOUT_SECONDS: int = Field(default=120)  # 2 minutes
    AI_PROCESSING_TIMEOUT: int = Field(default=60)  # 1 minute for AI processing
    OCR_PROCESSING_TIMEOUT: int = Field(default=30)  # 30 seconds for OCR
    
    # Rate Limiting
    UPLOADS_PER_MINUTE: int = Field(default=10)
    UPLOADS_PER_HOUR: int = Field(default=100)
    PROCESSING_QUEUE_SIZE: int = Field(default=50)
    
    # Retry Configuration
    MAX_RETRY_ATTEMPTS: int = Field(default=3)
    RETRY_DELAY_SECONDS: int = Field(default=5)
    AI_FALLBACK_ENABLED: bool = Field(default=True)
    
    # Cache Configuration
    CACHE_TTL_RESULTS: int = Field(default=3600)  # 1 hour
    CACHE_TTL_FILES: int = Field(default=86400)   # 24 hours
    CACHE_PREFIX: str = Field(default="receipt")
    
    # Monitoring & Logging
    LOG_LEVEL: str = Field(default="INFO", env="LOG_LEVEL")
    ENABLE_FILE_LOGGING: bool = Field(default=True)
    LOG_RETENTION_DAYS: int = Field(default=30)
    
    # Performance Configuration
    CONCURRENT_PROCESSING_LIMIT: int = Field(default=5)
    MEMORY_LIMIT_MB: int = Field(default=512)
    
    # Validation Configuration
    REQUIRE_USER_APPROVAL: bool = Field(default=True)
    AUTO_APPROVE_HIGH_CONFIDENCE: bool = Field(default=False)
    HIGH_CONFIDENCE_THRESHOLD: float = Field(default=0.9)
    
    # Integration Configuration
    CREATE_EXPENSES_AUTOMATICALLY: bool = Field(default=False)
    SUGGEST_CATEGORIES: bool = Field(default=True)
    VALIDATE_AMOUNTS: bool = Field(default=True)
    
    # Development Configuration
    SAVE_DEBUG_IMAGES: bool = Field(default=False)
    SAVE_OCR_OUTPUT: bool = Field(default=False)
    ENABLE_TEST_MODE: bool = Field(default=False)
    
    @validator('MAX_FILE_SIZE_BYTES', always=True)
    def set_file_size_bytes(cls, v, values):
        if 'MAX_FILE_SIZE_MB' in values:
            return values['MAX_FILE_SIZE_MB'] * 1024 * 1024
        return v
    
    @validator('ALLOWED_IMAGE_EXTENSIONS', 'ALLOWED_DOCUMENT_EXTENSIONS')
    def lowercase_extensions(cls, v):
        return [ext.lower() for ext in v]
    
    @property
    def all_allowed_extensions(self) -> List[str]:
        """Get all allowed file extensions"""
        return self.ALLOWED_IMAGE_EXTENSIONS + self.ALLOWED_DOCUMENT_EXTENSIONS
    
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
    
    @property
    def has_ai_config(self) -> bool:
        """Check if AI configuration is available"""
        return bool(self.ANTHROPIC_API_KEY or self.OPENAI_API_KEY or self.GROQ_API_KEY)
    
    # Directory creation helpers
    def ensure_directories(self):
        """Ensure all required directories exist"""
        import os
        directories = [
            self.UPLOAD_DIR,
            self.PROCESSED_DIR,
            self.FAILED_DIR,
            self.TEMP_DIR,
            f"{self.UPLOAD_DIR}/images",
            f"{self.UPLOAD_DIR}/documents",
            f"{self.PROCESSED_DIR}/success",
            f"{self.PROCESSED_DIR}/pending"
        ]
        
        for directory in directories:
            os.makedirs(directory, exist_ok=True)
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Create global settings instance
settings = Settings()

# Ensure directories exist on startup
if not settings.ENABLE_TEST_MODE:
    settings.ensure_directories()