"""
Simplified Database Configuration for Analytics Service
Location: services/analytics/src/config/database.py
"""

import asyncio
import time
import json
from typing import List, Dict, Any, Optional, Union
from contextlib import asynccontextmanager

import asyncpg
import redis
import structlog
from decimal import Decimal

from .settings import settings

logger = structlog.get_logger(__name__)

# Global connection pools
db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[redis.Redis] = None

async def init_db():
    """Initialize database connections and pools"""
    global db_pool, redis_client
    
    try:
        # Initialize PostgreSQL connection pool
        logger.info("Initializing PostgreSQL connection pool...")
        db_pool = await asyncpg.create_pool(
            host=settings.DB_HOST,
            port=settings.DB_PORT,
            database=settings.DB_NAME,
            user=settings.DB_USER,
            password=settings.DB_PASSWORD,
            min_size=5,
            max_size=10,
            command_timeout=30,
            server_settings={
                'jit': 'off'
            }
        )
        
        # Test PostgreSQL connection
        async with db_pool.acquire() as conn:
            await conn.execute('SELECT 1')
            logger.info("PostgreSQL connection pool initialized successfully")
        
        # Initialize Redis connection (simplified)
        logger.info("Initializing Redis connection...")
        redis_client = redis.Redis(
            host=settings.REDIS_HOST,
            port=settings.REDIS_PORT,
            db=0,
            decode_responses=True,
            socket_timeout=5
        )
        
        # Test Redis connection
        redis_client.ping()
        logger.info("Redis connection initialized successfully")
        
    except Exception as e:
        logger.error("Failed to initialize database connections", error=str(e))
        raise

async def close_db():
    """Close database connections"""
    global db_pool, redis_client
    
    try:
        if db_pool:
            await db_pool.close()
            logger.info("PostgreSQL connection pool closed")
            
        if redis_client:
            redis_client.close()
            logger.info("Redis connection closed")
            
    except Exception as e:
        logger.error("Error closing database connections", error=str(e))

# Database query helpers
async def execute_query(query: str, *args) -> List[Dict]:
    """Execute a query and return results"""
    try:
        async with db_pool.acquire() as conn:
            result = await conn.fetch(query, *args)
            return [dict(record) for record in result]
    except Exception as e:
        logger.error("Database query failed", query=query, error=str(e))
        raise

async def execute_fetchrow(query: str, *args) -> Optional[Dict]:
    """Execute a query and return single row"""
    try:
        async with db_pool.acquire() as conn:
            result = await conn.fetchrow(query, *args)
            return dict(result) if result else None
    except Exception as e:
        logger.error("Database fetchrow failed", query=query, error=str(e))
        raise

async def execute_scalar(query: str, *args) -> Any:
    """Execute a query and return single value"""
    try:
        async with db_pool.acquire() as conn:
            return await conn.fetchval(query, *args)
    except Exception as e:
        logger.error("Database scalar query failed", query=query, error=str(e))
        raise

# Simplified cache operations
async def cache_get(key: str) -> Optional[str]:
    """Get value from cache"""
    try:
        if redis_client:
            return redis_client.get(f"analytics:{key}")
        return None
    except Exception as e:
        logger.warning("Cache get failed", key=key, error=str(e))
        return None

async def cache_set(key: str, value: str, ttl: int = 3600) -> bool:
    """Set value in cache"""
    try:
        if redis_client:
            return redis_client.setex(f"analytics:{key}", ttl, value)
        return False
    except Exception as e:
        logger.warning("Cache set failed", key=key, error=str(e))
        return False

async def cache_exists(key: str) -> bool:
    """Check if key exists in cache"""
    try:
        if redis_client:
            return redis_client.exists(f"analytics:{key}") > 0
        return False
    except Exception as e:
        logger.warning("Cache exists check failed", key=key, error=str(e))
        return False

# Health check functions
async def get_db_status() -> Dict[str, Any]:
    """Get database connection status"""
    try:
        start_time = time.time()
        async with db_pool.acquire() as conn:
            await conn.execute('SELECT 1')
        response_time = (time.time() - start_time) * 1000
        
        return {
            "status": "healthy",
            "response_time_ms": round(response_time, 2),
            "pool_size": len(db_pool._queue._queue) if db_pool else 0,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e)
        }

async def get_redis_status() -> Dict[str, Any]:
    """Get Redis connection status"""
    try:
        start_time = time.time()
        if redis_client:
            redis_client.ping()
        response_time = (time.time() - start_time) * 1000
        
        return {
            "status": "healthy",
            "response_time_ms": round(response_time, 2),
        }
    except Exception as e:
        return {
            "status": "unhealthy", 
            "error": str(e)
        }