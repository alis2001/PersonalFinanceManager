"""
FastAPI Analytics Service - With Real Analytics Routes
Location: services/analytics/src/main.py
"""

import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import structlog

from .config.database import init_db, close_db, get_db_status, get_redis_status
from .config.settings import settings
from .api.routes.analytics import router as analytics_router
from .api.routes.trends import router as trends_router
from .middleware.auth import AuthMiddleware

# Setup logging
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

logger = structlog.get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("🚀 Starting Analytics Service", 
               version=settings.VERSION, 
               environment=settings.ENVIRONMENT)
    
    try:
        await init_db()
        logger.info("✅ Database connections initialized")
    except Exception as e:
        logger.error("❌ Failed to initialize database", error=str(e))
        raise
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down Analytics Service")
    await close_db()
    logger.info("✅ Database connections closed")

# Create FastAPI app
app = FastAPI(
    title="Finance Analytics Service",
    description="Analytics service for financial data",
    version=settings.VERSION,
    docs_url="/docs" if settings.is_development else None,
    redoc_url="/redoc" if settings.is_development else None,
    openapi_url="/openapi.json" if settings.is_development else None,
    lifespan=lifespan
)

# Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.add_middleware(AuthMiddleware)


# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    logger.info(
        "📊 Analytics Request",
        method=request.method,
        path=request.url.path,
        client_ip=request.client.host if request.client else "unknown"
    )
    
    response = await call_next(request)
    
    process_time = time.time() - start_time
    logger.info(
        "📊 Analytics Response",
        method=request.method,
        path=request.url.path,
        status_code=response.status_code,
        process_time=round(process_time * 1000, 2)
    )
    
    response.headers["X-Process-Time"] = str(process_time)
    return response

# Include the REAL analytics routes
app.include_router(analytics_router, prefix="", tags=["Analytics"])
app.include_router(trends_router, prefix="/trends", tags=["Trends"])

# Health check endpoint
@app.get("/health")
async def health_check():
    """Health check endpoint"""
    db_status = await get_db_status()
    redis_status = await get_redis_status()
    
    return {
        "status": "healthy",
        "service": "Analytics Service",
        "version": settings.VERSION,
        "timestamp": time.time(),
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "redis": redis_status
    }

# Root endpoint
@app.get("/")
async def root():
    """Root endpoint with service information"""
    return {
        "service": "Finance Analytics Service",
        "version": settings.VERSION,
        "status": "running",
        "environment": settings.ENVIRONMENT,
        "endpoints": {
            "health": "GET /health",
            "analytics": {
                "overview": "GET /analytics/overview",
                "categories": "GET /analytics/categories"
            }
        }
    }

# Exception handlers
@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    logger.error(
        "Internal Server Error",
        error=str(exc),
        path=request.url.path,
        exc_info=True
    )
    return JSONResponse(
        status_code=500,
        content={
            "error": "Internal server error",
            "timestamp": time.time()
        }
    )