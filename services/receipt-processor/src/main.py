"""
Receipt Processing Service - Main FastAPI Application
Location: services/receipt-processor/src/main.py
"""

import time
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
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
    """Application lifespan events"""
    logger.info("🚀 Starting Receipt Processing Service", 
               version=settings.VERSION, 
               environment=settings.ENVIRONMENT)
    
    try:
        # Initialize database connection
        await init_db()
        logger.info("✅ Database initialized successfully")
        yield
        
    except Exception as e:
        logger.error("Failed to initialize service", error=str(e))
        raise
    finally:
        # Cleanup
        await close_db()
        logger.info("🛑 Shutting down Receipt Processing Service")

# Create FastAPI application
app = FastAPI(
    title=settings.APP_NAME,
    description="AI-powered receipt processing and expense extraction service",
    version=settings.VERSION,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    lifespan=lifespan
)

# Add authentication middleware FIRST
app.add_middleware(AuthMiddleware)

# Add CORS middleware AFTER auth
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Add API routes
app.include_router(receipt_router, prefix="/api/receipt", tags=["receipt"])

# Request timing middleware
@app.middleware("http")
async def add_process_time_header(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = time.time() - start_time
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Health check endpoint
@app.get("/health")
async def health_check():
    try:
        # Test database connection
        from .database.connection import execute_fetchrow
        await execute_fetchrow("SELECT 1 as test")
        
        return {
            "status": "healthy",
            "service": settings.APP_NAME,
            "version": settings.VERSION,
            "environment": settings.ENVIRONMENT,
            "database": "connected",
            "timestamp": time.time()
        }
    except Exception as e:
        logger.error("Health check failed", error=str(e))
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "service": settings.APP_NAME,
                "database": "disconnected",
                "error": str(e),
                "timestamp": time.time()
            }
        )

# Root endpoint
@app.get("/")
async def root():
    return {
        "service": settings.APP_NAME,
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT,
        "endpoints": {
            "health": "GET /health",
            "upload": "POST /upload",
            "status": "GET /status/{id}",
            "approve": "POST /approve/{id}"
        }
    }