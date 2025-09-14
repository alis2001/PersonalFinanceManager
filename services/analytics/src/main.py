"""
FastAPI Analytics Service - Main Application
Location: services/analytics/src/main.py
"""

import os
import time
import asyncio
from contextlib import asynccontextmanager
from typing import Dict, Any

from fastapi import FastAPI, Request, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
import structlog
import uvicorn

from .config.database import init_db, close_db, get_db_status, get_redis_status
from .config.settings import settings
from .api.routes import analytics, health, forecasting, trends
from .middleware.auth import AuthMiddleware
from .middleware.rate_limit import RateLimitMiddleware
from .utils.logger import setup_logging

# Setup structured logging
setup_logging()
logger = structlog.get_logger(__name__)

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("🚀 Starting Analytics Service", version=settings.VERSION, environment=settings.ENVIRONMENT)
    
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
    description="Advanced analytics and machine learning service for financial data",
    version=settings.VERSION,
    docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
    redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
    openapi_url="/openapi.json" if settings.ENVIRONMENT == "development" else None,
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

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(AuthMiddleware)
app.add_middleware(RateLimitMiddleware)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    
    # Log request
    logger.info(
        "📊 Analytics Request",
        method=request.method,
        path=request.url.path,
        client_ip=request.client.host if request.client else "unknown"
    )
    
    response = await call_next(request)
    
    # Log response
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

# Exception handlers
@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    logger.error(
        "HTTP Exception",
        status_code=exc.status_code,
        detail=exc.detail,
        path=request.url.path
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": exc.detail,
            "status_code": exc.status_code,
            "timestamp": time.time()
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    logger.error(
        "Validation Error",
        errors=exc.errors(),
        path=request.url.path
    )
    return JSONResponse(
        status_code=422,
        content={
            "error": "Validation failed",
            "details": exc.errors(),
            "timestamp": time.time()
        }
    )

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

# Include routers
app.include_router(health.router, tags=["Health"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(trends.router, prefix="/trends", tags=["Trends"])
app.include_router(forecasting.router, prefix="/forecasting", tags=["Forecasting"])

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
                "categories": "GET /analytics/categories",
                "budget": "GET /analytics/budget",
                "insights": "GET /analytics/insights"
            },
            "trends": {
                "spending": "GET /trends/spending", 
                "category": "GET /trends/category/{category_id}",
                "comparative": "GET /trends/comparative"
            },
            "forecasting": {
                "expenses": "GET /forecasting/expenses",
                "budget": "GET /forecasting/budget",
                "cashflow": "GET /forecasting/cashflow"
            }
        },
        "features": {
            "real_time_analytics": True,
            "machine_learning": True,
            "time_series_forecasting": True,
            "statistical_analysis": True,
            "data_export": True,
            "caching": True
        },
        "documentation": "/docs" if settings.ENVIRONMENT == "development" else None
    }

# Health check endpoint (matches your existing pattern)
@app.get("/health")
async def health_check():
    """Comprehensive health check endpoint"""
    try:
        # Check database connections
        db_status = await get_db_status()
        redis_status = await get_redis_status()
        
        # Overall health determination
        is_healthy = db_status["status"] == "connected" and redis_status["status"] == "connected"
        status_code = 200 if is_healthy else 503
        
        health_data = {
            "status": "healthy" if is_healthy else "unhealthy",
            "service": "Analytics Service",
            "version": settings.VERSION,
            "timestamp": time.time(),
            "environment": settings.ENVIRONMENT,
            "database": db_status,
            "redis": redis_status,
            "system": {
                "python_version": f"{os.sys.version_info.major}.{os.sys.version_info.minor}.{os.sys.version_info.micro}",
                "fastapi_version": "0.104.1",
                "uptime_seconds": getattr(app.state, 'start_time', time.time()) - time.time() if hasattr(app.state, 'start_time') else 0
            }
        }
        
        if not is_healthy:
            logger.warning("Health check failed", **health_data)
        
        return JSONResponse(
            status_code=status_code,
            content=health_data
        )
        
    except Exception as e:
        logger.error("Health check exception", error=str(e))
        return JSONResponse(
            status_code=503,
            content={
                "status": "unhealthy",
                "service": "Analytics Service",
                "error": str(e),
                "timestamp": time.time()
            }
        )

# Startup event to track uptime
@app.on_event("startup")
async def startup_event():
    app.state.start_time = time.time()
    logger.info("📊 Analytics Service started successfully")

# Graceful shutdown
@app.on_event("shutdown") 
async def shutdown_event():
    logger.info("📊 Analytics Service shutdown complete")

# Development server runner
if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        log_level=settings.LOG_LEVEL.lower(),
        workers=1 if settings.ENVIRONMENT == "development" else 4
    )