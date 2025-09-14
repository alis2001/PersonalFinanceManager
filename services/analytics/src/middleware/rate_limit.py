"""
Rate Limiting Middleware for Analytics Service
Location: services/analytics/src/middleware/rate_limit.py
"""

import time
from typing import Dict, Optional
from fastapi import Request, HTTPException, status
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

from ..config.settings import settings
from ..config.database import get_redis_client

logger = structlog.get_logger(__name__)

class RateLimitMiddleware(BaseHTTPMiddleware):
    """Redis-based rate limiting middleware"""
    
    def __init__(self, app, requests_per_window: int = None, window_seconds: int = None):
        super().__init__(app)
        self.requests_per_window = requests_per_window or settings.RATE_LIMIT_REQUESTS
        self.window_seconds = window_seconds or settings.RATE_LIMIT_WINDOW
        
    async def dispatch(self, request: Request, call_next):
        """Apply rate limiting to requests"""
        
        # Skip rate limiting for health checks and docs
        if request.url.path in ["/", "/health", "/docs", "/redoc", "/openapi.json"]:
            return await call_next(request)
        
        # Get client identifier
        client_id = self._get_client_identifier(request)
        
        # Check rate limit
        is_allowed, limit_info = await self._check_rate_limit(client_id, request.url.path)
        
        if not is_allowed:
            logger.warning(
                "Rate limit exceeded",
                client_id=client_id,
                path=request.url.path,
                current_requests=limit_info.get("current_requests"),
                limit=self.requests_per_window
            )
            
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail={
                    "error": "Rate limit exceeded",
                    "requests_per_window": self.requests_per_window,
                    "window_seconds": self.window_seconds,
                    "current_requests": limit_info.get("current_requests", 0),
                    "reset_time": limit_info.get("reset_time"),
                    "retry_after": limit_info.get("retry_after")
                }
            )
        
        # Add rate limit headers to response
        response = await call_next(request)
        
        response.headers["X-RateLimit-Limit"] = str(self.requests_per_window)
        response.headers["X-RateLimit-Remaining"] = str(
            max(0, self.requests_per_window - limit_info.get("current_requests", 0))
        )
        response.headers["X-RateLimit-Reset"] = str(limit_info.get("reset_time", 0))
        response.headers["X-RateLimit-Window"] = str(self.window_seconds)
        
        return response
    
    def _get_client_identifier(self, request: Request) -> str:
        """Generate client identifier for rate limiting"""
        # Use user_id if authenticated
        user_id = getattr(request.state, 'user_id', None)
        if user_id:
            return f"user:{user_id}"
        
        # Fallback to IP address
        client_ip = self._get_client_ip(request)
        return f"ip:{client_ip}"
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP from request"""
        # Check for forwarded headers (proxy/load balancer)
        forwarded_for = request.headers.get("X-Forwarded-For")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip
        
        # Fallback to direct client IP
        if request.client:
            return request.client.host
        
        return "unknown"
    
    async def _check_rate_limit(self, client_id: str, path: str) -> tuple[bool, Dict]:
        """Check if client has exceeded rate limit"""
        try:
            redis = await get_redis_client()
            current_time = int(time.time())
            window_start = current_time - self.window_seconds
            
            # Create Redis key for this client
            rate_limit_key = f"rate_limit:{client_id}"
            
            # Use Redis pipeline for atomic operations
            pipe = redis.pipeline()
            
            # Remove old entries outside the window
            pipe.zremrangebyscore(rate_limit_key, 0, window_start)
            
            # Count current requests in window
            pipe.zcard(rate_limit_key)
            
            # Add current request
            pipe.zadd(rate_limit_key, {f"{current_time}:{path}": current_time})
            
            # Set expiration for cleanup
            pipe.expire(rate_limit_key, self.window_seconds)
            
            results = await pipe.execute()
            current_requests = results[1]  # Count after cleanup
            
            # Calculate reset time
            reset_time = current_time + self.window_seconds
            retry_after = self.window_seconds if current_requests >= self.requests_per_window else 0
            
            limit_info = {
                "current_requests": current_requests + 1,  # Include current request
                "reset_time": reset_time,
                "retry_after": retry_after
            }
            
            # Check if limit exceeded
            is_allowed = current_requests < self.requests_per_window
            
            if not is_allowed:
                # Remove the request we just added since it's not allowed
                await redis.zrem(rate_limit_key, f"{current_time}:{path}")
            
            return is_allowed, limit_info
            
        except Exception as e:
            logger.error(f"Rate limit check error: {str(e)}", client_id=client_id)
            # Allow request on Redis errors to avoid service disruption
            return True, {"current_requests": 0, "reset_time": 0, "retry_after": 0}

class AdvancedRateLimit:
    """Advanced rate limiting with different endpoint tiers"""
    
    RATE_LIMITS = {
        "analytics": {"requests": 50, "window": 300},      # 50 requests per 5 minutes
        "forecasting": {"requests": 20, "window": 600},    # 20 requests per 10 minutes  
        "export": {"requests": 10, "window": 3600},        # 10 exports per hour
        "default": {"requests": 100, "window": 900}        # 100 requests per 15 minutes
    }
    
    @classmethod
    async def check_endpoint_limit(cls, request: Request, endpoint_type: str = "default") -> bool:
        """Check rate limit for specific endpoint type"""
        client_id = cls._get_client_id(request)
        limit_config = cls.RATE_LIMITS.get(endpoint_type, cls.RATE_LIMITS["default"])
        
        try:
            redis = await get_redis_client()
            current_time = int(time.time())
            window_start = current_time - limit_config["window"]
            
            key = f"limit:{endpoint_type}:{client_id}"
            
            # Clean old entries and count current
            pipe = redis.pipeline()
            pipe.zremrangebyscore(key, 0, window_start)
            pipe.zcard(key)
            pipe.zadd(key, {str(current_time): current_time})
            pipe.expire(key, limit_config["window"])
            
            results = await pipe.execute()
            current_count = results[1]
            
            return current_count < limit_config["requests"]
            
        except Exception as e:
            logger.error(f"Advanced rate limit error: {str(e)}")
            return True  # Allow on errors
    
    @staticmethod
    def _get_client_id(request: Request) -> str:
        """Get client identifier"""
        user_id = getattr(request.state, 'user_id', None)
        if user_id:
            return f"user:{user_id}"
        
        client_ip = request.client.host if request.client else "unknown"
        return f"ip:{client_ip}"

# Rate limiting decorators for specific endpoints
async def rate_limit_analytics(request: Request):
    """Check analytics rate limit"""
    if not await AdvancedRateLimit.check_endpoint_limit(request, "analytics"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Analytics rate limit exceeded. Try again in 5 minutes."
        )

async def rate_limit_forecasting(request: Request):
    """Check forecasting rate limit"""
    if not await AdvancedRateLimit.check_endpoint_limit(request, "forecasting"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Forecasting rate limit exceeded. Try again in 10 minutes."
        )

async def rate_limit_export(request: Request):
    """Check export rate limit"""
    if not await AdvancedRateLimit.check_endpoint_limit(request, "export"):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="Export rate limit exceeded. Try again in 1 hour."
        )

# Utility functions
async def get_rate_limit_status(client_id: str) -> Dict:
    """Get current rate limit status for a client"""
    try:
        redis = await get_redis_client()
        current_time = int(time.time())
        
        status = {}
        for limit_type, config in AdvancedRateLimit.RATE_LIMITS.items():
            key = f"limit:{limit_type}:{client_id}"
            window_start = current_time - config["window"]
            
            # Clean and count
            await redis.zremrangebyscore(key, 0, window_start)
            current_count = await redis.zcard(key)
            
            status[limit_type] = {
                "current_requests": current_count,
                "limit": config["requests"],
                "window_seconds": config["window"],
                "remaining": max(0, config["requests"] - current_count),
                "reset_time": current_time + config["window"]
            }
        
        return status
        
    except Exception as e:
        logger.error(f"Rate limit status error: {str(e)}")
        return {}

async def reset_rate_limit(client_id: str, limit_type: str = None) -> bool:
    """Reset rate limit for client (admin function)"""
    try:
        redis = await get_redis_client()
        
        if limit_type:
            key = f"limit:{limit_type}:{client_id}"
            await redis.delete(key)
        else:
            # Reset all limits for client
            pattern = f"limit:*:{client_id}"
            keys = await redis.keys(pattern)
            if keys:
                await redis.delete(*keys)
        
        logger.info(f"Rate limit reset for client: {client_id}, type: {limit_type or 'all'}")
        return True
        
    except Exception as e:
        logger.error(f"Rate limit reset error: {str(e)}")
        return False