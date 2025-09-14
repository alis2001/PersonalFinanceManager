"""
Health Check Routes for Analytics Service
Location: services/analytics/src/api/routes/health.py
"""

import time
import psutil
import asyncio
from fastapi import APIRouter, HTTPException, status
from fastapi.responses import JSONResponse
import structlog

from ...config.database import get_db_status, get_redis_status
from ...config.settings import settings
from ...models.schemas import HealthResponse
from ...utils.logger import analytics_logger, performance_logger

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.get("/health", response_model=HealthResponse, tags=["Health"])
async def health_check():
    """
    Comprehensive health check endpoint
    
    Returns detailed health status including:
    - Database connectivity
    - Redis connectivity  
    - System resources
    - Service status
    """
    start_time = time.time()
    
    try:
        # Concurrent health checks for better performance
        db_task = asyncio.create_task(get_db_status())
        redis_task = asyncio.create_task(get_redis_status())
        system_task = asyncio.create_task(get_system_health())
        
        # Wait for all checks to complete
        db_status, redis_status, system_health = await asyncio.gather(
            db_task, redis_task, system_task
        )
        
        # Determine overall health status
        is_healthy = (
            db_status.get("status") == "connected" and 
            redis_status.get("status") == "connected" and
            system_health.get("status") == "healthy"
        )
        
        processing_time = (time.time() - start_time) * 1000
        
        health_data = HealthResponse(
            status="healthy" if is_healthy else "unhealthy",
            version=settings.VERSION,
            timestamp=time.time(),
            environment=settings.ENVIRONMENT,
            database=db_status,
            redis=redis_status,
            system=system_health
        )
        
        # Log health check result
        if is_healthy:
            analytics_logger.logger.info(
                "Health check completed",
                status="healthy",
                processing_time_ms=round(processing_time, 2)
            )
        else:
            analytics_logger.logger.warning(
                "Health check failed",
                status="unhealthy",
                db_status=db_status.get("status"),
                redis_status=redis_status.get("status"),
                system_status=system_health.get("status"),
                processing_time_ms=round(processing_time, 2)
            )
        
        # Return appropriate HTTP status
        status_code = status.HTTP_200_OK if is_healthy else status.HTTP_503_SERVICE_UNAVAILABLE
        
        return JSONResponse(
            status_code=status_code,
            content=health_data.dict()
        )
        
    except Exception as e:
        processing_time = (time.time() - start_time) * 1000
        
        logger.error(
            "Health check exception",
            error=str(e),
            processing_time_ms=round(processing_time, 2),
            exc_info=True
        )
        
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "unhealthy",
                "service": "Analytics Service",
                "error": str(e),
                "timestamp": time.time(),
                "version": settings.VERSION,
                "environment": settings.ENVIRONMENT
            }
        )

@router.get("/health/detailed", tags=["Health"])
async def detailed_health_check():
    """
    Detailed health check with extended metrics
    
    Includes additional information for monitoring and debugging:
    - Dependency versions
    - Resource usage
    - Performance metrics
    - Service configuration
    """
    start_time = time.time()
    
    try:
        # Get basic health info
        basic_health = await health_check()
        basic_data = basic_health.body.decode() if hasattr(basic_health, 'body') else '{}'
        
        # Get extended metrics
        extended_metrics = await get_extended_metrics()
        
        # Combine results
        response_data = {
            **eval(basic_data) if basic_data != '{}' else {},
            "extended_metrics": extended_metrics,
            "dependencies": get_dependency_info(),
            "configuration": get_safe_config_info(),
            "performance": await get_performance_metrics()
        }
        
        processing_time = (time.time() - start_time) * 1000
        response_data["processing_time_ms"] = round(processing_time, 2)
        
        return JSONResponse(
            status_code=status.HTTP_200_OK,
            content=response_data
        )
        
    except Exception as e:
        logger.error(f"Detailed health check failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Detailed health check failed: {str(e)}"
        )

@router.get("/health/ready", tags=["Health"])
async def readiness_check():
    """
    Kubernetes readiness probe endpoint
    
    Returns 200 if service is ready to accept traffic,
    503 if not ready (dependencies unavailable)
    """
    try:
        # Quick checks for essential dependencies
        db_status = await get_db_status()
        redis_status = await get_redis_status()
        
        is_ready = (
            db_status.get("status") == "connected" and
            redis_status.get("status") == "connected"
        )
        
        if is_ready:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={"status": "ready", "timestamp": time.time()}
            )
        else:
            return JSONResponse(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                content={
                    "status": "not_ready",
                    "timestamp": time.time(),
                    "issues": {
                        "database": db_status.get("status") != "connected",
                        "redis": redis_status.get("status") != "connected"
                    }
                }
            )
            
    except Exception as e:
        logger.error(f"Readiness check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            content={
                "status": "not_ready",
                "error": str(e),
                "timestamp": time.time()
            }
        )

@router.get("/health/live", tags=["Health"])
async def liveness_check():
    """
    Kubernetes liveness probe endpoint
    
    Returns 200 if service is alive and running,
    500 if service should be restarted
    """
    try:
        # Basic liveness indicators
        system_status = await get_system_health()
        
        # Check if system resources are critically low
        memory_usage = system_status.get("memory_usage_percent", 0)
        cpu_usage = system_status.get("cpu_usage_percent", 0)
        
        # Consider service dead if resources are critically exhausted
        is_alive = memory_usage < 95 and cpu_usage < 98
        
        if is_alive:
            return JSONResponse(
                status_code=status.HTTP_200_OK,
                content={
                    "status": "alive",
                    "timestamp": time.time(),
                    "uptime_seconds": time.time() - (getattr(settings, '_start_time', time.time()))
                }
            )
        else:
            performance_logger.logger.critical(
                "Service liveness check failed",
                memory_usage=memory_usage,
                cpu_usage=cpu_usage
            )
            
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={
                    "status": "dead",
                    "timestamp": time.time(),
                    "reason": "Critical resource exhaustion"
                }
            )
            
    except Exception as e:
        logger.error(f"Liveness check failed: {str(e)}")
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "dead",
                "error": str(e),
                "timestamp": time.time()
            }
        )

# Utility functions
async def get_system_health() -> dict:
    """Get system health metrics"""
    try:
        # CPU usage
        cpu_percent = psutil.cpu_percent(interval=0.1)
        
        # Memory usage
        memory = psutil.virtual_memory()
        memory_usage = memory.percent
        
        # Disk usage
        disk = psutil.disk_usage('/')
        disk_usage = disk.percent
        
        # Process info
        process = psutil.Process()
        process_memory = process.memory_info().rss / 1024 / 1024  # MB
        
        status = "healthy"
        if memory_usage > 90 or cpu_percent > 95 or disk_usage > 95:
            status = "warning"
        if memory_usage > 95 or cpu_percent > 98 or disk_usage > 98:
            status = "critical"
        
        return {
            "status": status,
            "cpu_usage_percent": round(cpu_percent, 2),
            "memory_usage_percent": round(memory_usage, 2),
            "disk_usage_percent": round(disk_usage, 2),
            "process_memory_mb": round(process_memory, 2),
            "available_memory_mb": round((memory.available / 1024 / 1024), 2),
            "cpu_count": psutil.cpu_count()
        }
        
    except Exception as e:
        logger.error(f"System health check error: {str(e)}")
        return {
            "status": "error",
            "error": str(e)
        }

async def get_extended_metrics() -> dict:
    """Get extended service metrics"""
    try:
        # Network connections
        connections = len(psutil.net_connections())
        
        # Load average (Unix systems)
        try:
            load_avg = psutil.getloadavg()
        except (AttributeError, OSError):
            load_avg = [0, 0, 0]  # Windows fallback
        
        return {
            "network_connections": connections,
            "load_average_1m": round(load_avg[0], 2),
            "load_average_5m": round(load_avg[1], 2),
            "load_average_15m": round(load_avg[2], 2),
            "boot_time": psutil.boot_time()
        }
        
    except Exception as e:
        logger.error(f"Extended metrics error: {str(e)}")
        return {"error": str(e)}

def get_dependency_info() -> dict:
    """Get information about key dependencies"""
    try:
        import pandas
        import numpy
        import plotly
        import fastapi
        
        return {
            "python_version": f"{__import__('sys').version_info.major}.{__import__('sys').version_info.minor}.{__import__('sys').version_info.micro}",
            "fastapi": fastapi.__version__,
            "pandas": pandas.__version__,
            "numpy": numpy.__version__,
            "plotly": plotly.__version__
        }
    except Exception as e:
        return {"error": f"Could not get dependency info: {str(e)}"}

def get_safe_config_info() -> dict:
    """Get safe configuration information (no secrets)"""
    return {
        "environment": settings.ENVIRONMENT,
        "version": settings.VERSION,
        "debug": settings.DEBUG,
        "host": settings.HOST,
        "port": settings.PORT,
        "db_pool_size": settings.DB_POOL_SIZE,
        "cache_ttl_default": settings.CACHE_TTL_DEFAULT,
        "rate_limit_requests": settings.RATE_LIMIT_REQUESTS,
        "supported_periods": settings.SUPPORTED_PERIODS,
        "export_formats": settings.EXPORT_FORMATS
    }

async def get_performance_metrics() -> dict:
    """Get basic performance metrics"""
    try:
        start_time = time.time()
        
        # Simple database query performance test
        from ...config.database import execute_scalar
        await execute_scalar("SELECT 1")
        db_response_time = (time.time() - start_time) * 1000
        
        # Simple cache performance test
        start_time = time.time()
        from ...config.database import cache_exists
        await cache_exists("health_test")
        cache_response_time = (time.time() - start_time) * 1000
        
        return {
            "db_response_time_ms": round(db_response_time, 2),
            "cache_response_time_ms": round(cache_response_time, 2)
        }
        
    except Exception as e:
        return {
            "error": f"Performance metrics unavailable: {str(e)}"
        }