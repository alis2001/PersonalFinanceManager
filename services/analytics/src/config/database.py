"""
Database Configuration for Analytics Service
Location: services/analytics/src/config/database.py
"""

import asyncio
import time
import json
from typing import List, Dict, Any, Optional, Union
from contextlib import asynccontextmanager

import asyncpg
import aioredis
import structlog
from decimal import Decimal

from .settings import settings

logger = structlog.get_logger(__name__)

# Global connection pools
db_pool: Optional[asyncpg.Pool] = None
redis_client: Optional[aioredis.Redis] = None

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
            max_size=settings.DB_POOL_SIZE,
            command_timeout=settings.DB_POOL_TIMEOUT,
            server_settings={
                'jit': 'off'
            }
        )
        
        # Test PostgreSQL connection
        async with db_pool.acquire() as conn:
            await conn.execute('SELECT 1')
            logger.info("PostgreSQL connection pool initialized successfully")
        
        # Initialize Redis connection
        logger.info("Initializing Redis connection...")
        redis_client = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
            max_connections=settings.REDIS_POOL_SIZE
        )
        
        # Test Redis connection
        await redis_client.ping()
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
            await redis_client.close()
            logger.info("Redis connection closed")
            
    except Exception as e:
        logger.error("Error closing database connections", error=str(e))

@asynccontextmanager
async def get_db_connection():
    """Get database connection from pool"""
    if not db_pool:
        raise RuntimeError("Database pool not initialized")
    
    async with db_pool.acquire() as connection:
        yield connection

async def get_redis_client() -> aioredis.Redis:
    """Get Redis client"""
    if not redis_client:
        raise RuntimeError("Redis client not initialized")
    return redis_client

# Database query functions
async def execute_query(query: str, *args) -> List[Dict[str, Any]]:
    """Execute query and return all results"""
    async with get_db_connection() as conn:
        start_time = time.time()
        try:
            rows = await conn.fetch(query, *args)
            duration_ms = (time.time() - start_time) * 1000
            
            logger.debug("Query executed", 
                        query_preview=query[:100] + "..." if len(query) > 100 else query,
                        duration_ms=round(duration_ms, 2),
                        row_count=len(rows))
            
            # Convert asyncpg.Record to dict
            return [dict(row) for row in rows]
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error("Query failed", 
                        query_preview=query[:100] + "..." if len(query) > 100 else query,
                        duration_ms=round(duration_ms, 2),
                        error=str(e))
            raise

async def execute_fetchrow(query: str, *args) -> Optional[Dict[str, Any]]:
    """Execute query and return single row"""
    async with get_db_connection() as conn:
        start_time = time.time()
        try:
            row = await conn.fetchrow(query, *args)
            duration_ms = (time.time() - start_time) * 1000
            
            logger.debug("Query executed (single row)", 
                        query_preview=query[:100] + "..." if len(query) > 100 else query,
                        duration_ms=round(duration_ms, 2),
                        found=row is not None)
            
            return dict(row) if row else None
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error("Query failed (single row)", 
                        query_preview=query[:100] + "..." if len(query) > 100 else query,
                        duration_ms=round(duration_ms, 2),
                        error=str(e))
            raise

async def execute_scalar(query: str, *args) -> Any:
    """Execute query and return single value"""
    async with get_db_connection() as conn:
        start_time = time.time()
        try:
            result = await conn.fetchval(query, *args)
            duration_ms = (time.time() - start_time) * 1000
            
            logger.debug("Query executed (scalar)", 
                        query_preview=query[:100] + "..." if len(query) > 100 else query,
                        duration_ms=round(duration_ms, 2))
            
            return result
            
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error("Query failed (scalar)", 
                        query_preview=query[:100] + "..." if len(query) > 100 else query,
                        duration_ms=round(duration_ms, 2),
                        error=str(e))
            raise

# Cache functions
async def cache_get(key: str) -> Optional[str]:
    """Get value from cache"""
    try:
        redis = await get_redis_client()
        full_key = f"{settings.CACHE_PREFIX}:{key}"
        result = await redis.get(full_key)
        
        logger.debug("Cache get", key=full_key, hit=result is not None)
        return result
        
    except Exception as e:
        logger.error("Cache get failed", key=key, error=str(e))
        return None

async def cache_set(key: str, value: str, ttl: int = None) -> bool:
    """Set value in cache"""
    try:
        redis = await get_redis_client()
        full_key = f"{settings.CACHE_PREFIX}:{key}"
        ttl = ttl or settings.CACHE_TTL_DEFAULT
        
        await redis.setex(full_key, ttl, value)
        
        logger.debug("Cache set", key=full_key, ttl=ttl)
        return True
        
    except Exception as e:
        logger.error("Cache set failed", key=key, error=str(e))
        return False

async def cache_delete(key: str) -> bool:
    """Delete key from cache"""
    try:
        redis = await get_redis_client()
        full_key = f"{settings.CACHE_PREFIX}:{key}"
        
        result = await redis.delete(full_key)
        
        logger.debug("Cache delete", key=full_key, deleted=result > 0)
        return result > 0
        
    except Exception as e:
        logger.error("Cache delete failed", key=key, error=str(e))
        return False

async def cache_exists(key: str) -> bool:
    """Check if key exists in cache"""
    try:
        redis = await get_redis_client()
        full_key = f"{settings.CACHE_PREFIX}:{key}"
        
        result = await redis.exists(full_key)
        return result > 0
        
    except Exception as e:
        logger.error("Cache exists check failed", key=key, error=str(e))
        return False

# Health check functions
async def get_db_status() -> Dict[str, Any]:
    """Get database connection status"""
    try:
        start_time = time.time()
        await execute_scalar("SELECT 1")
        response_time = (time.time() - start_time) * 1000
        
        return {
            "status": "connected",
            "response_time_ms": round(response_time, 2),
            "pool_size": settings.DB_POOL_SIZE,
            "active_connections": db_pool.get_size() if db_pool else 0
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "response_time_ms": None
        }

async def get_redis_status() -> Dict[str, Any]:
    """Get Redis connection status"""
    try:
        redis = await get_redis_client()
        start_time = time.time()
        await redis.ping()
        response_time = (time.time() - start_time) * 1000
        
        info = await redis.info()
        
        return {
            "status": "connected",
            "response_time_ms": round(response_time, 2),
            "connected_clients": info.get("connected_clients", 0),
            "used_memory": info.get("used_memory_human", "unknown")
        }
        
    except Exception as e:
        return {
            "status": "error",
            "error": str(e),
            "response_time_ms": None
        }

# Utility functions for data conversion
def decimal_to_float(obj):
    """Convert Decimal objects to float for JSON serialization"""
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

def serialize_for_cache(data: Any) -> str:
    """Serialize data for cache storage"""
    return json.dumps(data, default=decimal_to_float, ensure_ascii=False)

def deserialize_from_cache(data: str) -> Any:
    """Deserialize data from cache"""
    return json.loads(data)