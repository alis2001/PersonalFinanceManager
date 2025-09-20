"""
Receipt Processing Service - Enhanced FastAPI Application
Location: services/receipt-processor/src/main.py
"""

import time
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.middleware.trustedhost import TrustedHostMiddleware
import structlog

# Setup structlog - same pattern as analytics service
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

from .config.settings import settings
from .middleware.auth import AuthMiddleware
from .api.routes.receipt import router as receipt_router
from .database.connection import init_db, close_db
logger = structlog.get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Enhanced application lifespan events"""
    logger.info("🚀 Starting Receipt Processing Service", 
               version=settings.VERSION, 
               environment=settings.ENVIRONMENT)
    
    try:
        # Log AI configuration status
        ai_status = "claude-3.5" if getattr(settings, 'ANTHROPIC_API_KEY', '') else "no-ai-key"
        logger.info("🤖 AI Configuration", status=ai_status)
        
        # Initialize database connection
        await init_db()
        logger.info("✅ Database initialized successfully")
        
        # Ensure upload directories exist (if method available)
        if hasattr(settings, 'ensure_directories'):
            settings.ensure_directories()
            logger.info("✅ Upload directories created")
        
        # Log configuration summary (with safe getattr calls)
        logger.info("📊 Service Configuration", 
                   max_file_size_mb=getattr(settings, 'MAX_FILE_SIZE_MB', 10),
                   max_transactions=getattr(settings, 'MAX_TRANSACTIONS_PER_FILE', 5),
                   ocr_languages=getattr(settings, 'OCR_LANGUAGES', ['en']),
                   ai_provider="claude-3.5" if getattr(settings, 'ANTHROPIC_API_KEY', '') else "fallback",
                   upload_dir=getattr(settings, 'UPLOAD_DIR', 'uploads'))
        
        yield
        
    except Exception as e:
        logger.error("❌ Failed to initialize service", error=str(e))
        raise
    finally:
        # Cleanup
        await close_db()
        logger.info("🛑 Shutting down Receipt Processing Service")

# Create FastAPI application with enhanced configuration
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered receipt processing and expense extraction service with OCR and Claude AI",
    version=settings.VERSION,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan,
    # Enhanced OpenAPI configuration
    openapi_tags=[
        {
            "name": "receipt",
            "description": "Receipt upload, processing, and management operations"
        },
        {
            "name": "health",
            "description": "Service health and status monitoring"
        }
    ]
)

# Security middleware
if not settings.is_development:
    app.add_middleware(
        TrustedHostMiddleware, 
        allowed_hosts=["localhost", "127.0.0.1", settings.HOST]
    )

# Add authentication middleware FIRST (as existing)
app.add_middleware(AuthMiddleware)

# Enhanced CORS middleware configuration
cors_origins = ["http://localhost:3000", "http://localhost:8080"]
if settings.is_development:
    cors_origins.append("*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["X-Process-Time"],
)

# Enhanced request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    
    # Log request start
    logger.debug("Request started", 
                method=request.method, 
                path=request.url.path,
                user_agent=request.headers.get("user-agent"))
    
    try:
        response = await call_next(request)
        process_time = (time.time() - start_time) * 1000
        
        # Add timing header
        response.headers["X-Process-Time"] = str(round(process_time, 2))
        
        # Log request completion
        logger.info("Request completed", 
                   method=request.method,
                   path=request.url.path,
                   status_code=response.status_code,
                   process_time_ms=round(process_time, 2))
        
        return response
        
    except Exception as e:
        process_time = (time.time() - start_time) * 1000
        
        # Log request error
        logger.error("Request failed", 
                    method=request.method,
                    path=request.url.path,
                    error=str(e),
                    process_time_ms=round(process_time, 2))
        
        raise

# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    """Global exception handler for unhandled errors"""
    
    # Don't handle HTTPExceptions - let FastAPI handle them
    if isinstance(exc, HTTPException):
        raise exc
    
    logger.error("Unhandled exception", 
                error=str(exc),
                error_type=type(exc).__name__,
                path=request.url.path,
                method=request.method)
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "detail": "Internal server error",
            "error_type": type(exc).__name__,
            "timestamp": time.time()
        }
    )

# File size error handler
@app.exception_handler(413)
async def file_too_large_handler(request: Request, exc):
    """Handle file too large errors"""
    max_size_mb = getattr(settings, 'MAX_FILE_SIZE_MB', 10)
    max_size_bytes = getattr(settings, 'MAX_FILE_SIZE_BYTES', 10 * 1024 * 1024)
    
    return JSONResponse(
        status_code=413,
        content={
            "detail": f"File too large. Maximum size: {max_size_mb}MB",
            "max_size_mb": max_size_mb,
            "max_size_bytes": max_size_bytes
        }
    )

# Add API routes (existing)
app.include_router(receipt_router, prefix="/api/receipt", tags=["receipt"])

# Enhanced health check endpoint
@app.get("/health", tags=["health"])
async def health_check():
    """Enhanced health check with system status"""
    try:
        # Simple database connection test
        from .database.connection import db_pool
        db_healthy = db_pool is not None
        
        health_data = {
            "status": "healthy" if db_healthy else "unhealthy",
            "service": settings.APP_NAME,
            "version": settings.VERSION,
            "timestamp": time.time(),
            "environment": settings.ENVIRONMENT,
            "database": {
                "status": "healthy" if db_healthy else "unhealthy",
                "connected": db_healthy
            },
            "configuration": {
                "max_file_size_mb": getattr(settings, 'MAX_FILE_SIZE_MB', 10),
                "max_transactions_per_file": getattr(settings, 'MAX_TRANSACTIONS_PER_FILE', 5),
                "ocr_languages": getattr(settings, 'OCR_LANGUAGES', ['en']),
                "ai_enabled": getattr(settings, 'has_ai_config', False),
                "processing_timeout": getattr(settings, 'PROCESSING_TIMEOUT_SECONDS', 120)
            }
        }
        
        status_code = 200 if db_healthy else 503
        return JSONResponse(status_code=status_code, content=health_data)
        
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "service": settings.APP_NAME,
                "error": str(e),
                "timestamp": time.time()
            }
        )

# Root endpoint with service information
@app.get("/", tags=["health"])
async def root():
    """Service information and capabilities"""
    return {
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "description": "AI-powered receipt processing service",
        "environment": settings.ENVIRONMENT,
        "capabilities": {
            "file_formats": {
                "images": getattr(settings, 'ALLOWED_IMAGE_EXTENSIONS', ['.jpg', '.png', '.pdf']),
                "documents": getattr(settings, 'ALLOWED_DOCUMENT_EXTENSIONS', ['.pdf', '.xlsx'])
            },
            "processing": {
                "ocr_languages": getattr(settings, 'OCR_LANGUAGES', ['en']),
                "max_file_size_mb": getattr(settings, 'MAX_FILE_SIZE_MB', 10),
                "max_transactions_per_file": getattr(settings, 'MAX_TRANSACTIONS_PER_FILE', 5),
                "ai_provider": "claude-3.5-sonnet" if getattr(settings, 'ANTHROPIC_API_KEY', '') else "fallback"
            },
            "features": [
                "Multi-language OCR with EasyOCR",
                "AI-powered data extraction with Claude 3.5",
                "Multi-transaction support (up to 5 per file)",
                "Automatic expense form pre-filling",
                "User approval workflow",
                "Integration with expense tracking"
            ]
        },
        "endpoints": {
            "upload": "POST /api/receipt/upload",
            "status": "GET /api/receipt/status/{job_id}",
            "approve": "POST /api/receipt/approve/{job_id}",
            "jobs": "GET /api/receipt/jobs",
            "health": "GET /health"
        },
        "timestamp": time.time()
    }

# Start message (for development)
if __name__ == "__main__":
    import uvicorn
    
    logger.info("🚀 Starting Receipt Processing Service in development mode")
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )