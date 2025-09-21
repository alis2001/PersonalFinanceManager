"""
Enhanced Receipt Processing Service Configuration - Multi-Transaction Support
Location: services/receipt-processor/src/config/settings.py
"""

import os
from typing import List, Optional
from pydantic_settings import BaseSettings
from pydantic import Field, validator


class Settings(BaseSettings):
    """Enhanced receipt processing service settings with multi-transaction support"""
    
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
    
    # File Upload Configuration - Enhanced with specific limits per type
    MAX_FILE_SIZE_MB: int = Field(default=10)  # 10MB max per file
    MAX_FILE_SIZE_BYTES: int = Field(default=10 * 1024 * 1024)
    
    # Specific file type limits for database storage
    MAX_IMAGE_SIZE_MB: int = Field(default=8)    # Images: 8MB
    MAX_PDF_SIZE_MB: int = Field(default=12)     # PDFs: 12MB  
    MAX_EXCEL_SIZE_MB: int = Field(default=5)    # Excel: 5MB
    MAX_CSV_SIZE_MB: int = Field(default=3)      # CSV: 3MB
    
    ALLOWED_IMAGE_EXTENSIONS: List[str] = Field(default=[
        ".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"
    ])
    ALLOWED_DOCUMENT_EXTENSIONS: List[str] = Field(default=[
        ".pdf", ".xlsx", ".xls", ".csv", ".txt"
    ])
    
    # Database Storage Configuration - Enhanced for organized storage
    ENABLE_FILE_ORGANIZATION: bool = Field(default=True)  # Organize by user/date metadata
    STORAGE_RETENTION_DAYS: int = Field(default=90)      # Keep files for 90 days
    COMPRESS_STORED_FILES: bool = Field(default=False)   # Enable compression for large files
    
    # File content validation
    VALIDATE_FILE_INTEGRITY: bool = Field(default=True)  # Verify checksums
    STORE_FILE_METADATA: bool = Field(default=True)      # Store additional metadata
    
    # OCR Configuration
    OCR_LANGUAGES: List[str] = Field(default=["en", "ar", "fa"])  # English, Arabic, Persian
    OCR_CONFIDENCE_THRESHOLD: float = Field(default=0.6)
    IMAGE_PREPROCESSING: bool = Field(default=True)
    OCR_BATCH_SIZE: int = Field(default=1)
    
    # Multi-Transaction Processing Configuration - ENHANCED
    MAX_TRANSACTIONS_PER_FILE: int = Field(default=5)
    PROCESSING_TIMEOUT_SECONDS: int = Field(default=120)  # 2 minutes total
    AI_PROCESSING_TIMEOUT: int = Field(default=60)       # 1 minute for AI processing
    OCR_PROCESSING_TIMEOUT: int = Field(default=30)      # 30 seconds for OCR
    
    # File type specific limits for content
    MAX_PDF_PAGES: int = Field(default=10)               # Max 10 pages per PDF
    MAX_EXCEL_ROWS: int = Field(default=500)             # Max 500 rows per Excel
    MAX_CSV_ROWS: int = Field(default=1000)              # Max 1000 rows per CSV
    MAX_TEXT_LENGTH: int = Field(default=50000)          # Max 50k characters for text files
    
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
    
    # Multi-Transaction Workflow Configuration
    REQUIRE_USER_APPROVAL: bool = Field(default=True)
    AUTO_APPROVE_HIGH_CONFIDENCE: bool = Field(default=False)
    HIGH_CONFIDENCE_THRESHOLD: float = Field(default=0.9)
    ENABLE_SEQUENTIAL_APPROVAL: bool = Field(default=True)  # Show transactions one by one
    
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
    
    # Enhanced properties for better code compatibility
    @property
    def ALLOWED_EXTENSIONS(self) -> List[str]:
        """Backward compatibility property"""
        return self.all_allowed_extensions
    
    @property
    def MAX_FILE_SIZE(self) -> int:
        """Backward compatibility property"""
        return self.MAX_FILE_SIZE_BYTES
    
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
    
    def get_file_size_limit(self, file_extension: str) -> int:
        """Get file size limit in bytes for specific file type"""
        file_ext = file_extension.lower()
        
        if file_ext in self.ALLOWED_IMAGE_EXTENSIONS:
            return self.MAX_IMAGE_SIZE_MB * 1024 * 1024
        elif file_ext == '.pdf':
            return self.MAX_PDF_SIZE_MB * 1024 * 1024
        elif file_ext in ['.xlsx', '.xls']:
            return self.MAX_EXCEL_SIZE_MB * 1024 * 1024
        elif file_ext in ['.csv', '.txt']:
            return self.MAX_CSV_SIZE_MB * 1024 * 1024
        else:
            return self.MAX_FILE_SIZE_BYTES
    
    def get_storage_metadata(self, user_id: str, file_type: str, filename: str) -> Dict[str, str]:
        """Generate metadata for database storage organization"""
        from datetime import datetime
        now = datetime.now()
        
        return {
            "user_id": user_id,
            "upload_date": now.strftime("%Y-%m-%d"),
            "upload_month": now.strftime("%Y-%m"),
            "file_category": self._categorize_file_type(file_type),
            "original_filename": filename,
            "storage_method": "database_bytea"
        }
    
    def _categorize_file_type(self, file_extension: str) -> str:
        """Categorize file type for organization"""
        file_ext = file_extension.lower()
        
        if file_ext in self.ALLOWED_IMAGE_EXTENSIONS:
            return "image"
        elif file_ext == '.pdf':
            return "pdf"
        elif file_ext in ['.xlsx', '.xls']:
            return "spreadsheet"
        elif file_ext == '.csv':
            return "data"
        elif file_ext == '.txt':
            return "text"
        else:
            return "document"
    
    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


# Create global settings instance
settings = Settings()