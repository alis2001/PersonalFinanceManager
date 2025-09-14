"""
Rate Limiting Middleware for Analytics Service
Location: services/analytics/src/middleware/rate_limit.py
"""

import time
import json
from typing import Dict, Optional, Tuple
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

from ..config.settings import settings
from ..config.database import get_redis_client
from ..utils.logger import security_logger

logger = structlog.get_logger(__name__)


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Rate limiting middleware using Redis for distributed rate limiting"""
    
    # Endpoints with custom rate limits (requests per window)
    CUSTOM_LIMITS = {
        "/analytics/overview": {"requests": 50, "window": 900},  # 50 per 15 min
        "/forecasting/expenses": {"requests": 20, "window": 900},  # 20 per 15 min
        "/trends/spending": {"requests": 30, "window": 900},  # 30 per 15 min
        "/analytics/insights": {"requests": 25, "window": 900},  # 25 per 15 min
    }
    
    # Endpoints that bypass rate limiting
    EXEMPT_PATHS = {
        "/",
        "/health",
        "/docs",
        "/redoc",
        "/openapi.json"
    }
    
    def __init__(self, app):
        super().__init__(app)
        self.default_requests = settings.RATE_LIMIT_REQUESTS
        self.default_window = settings.RATE_LIMIT_WINDOW
        
    async def dispatch(self, request: Request, call_next):
        """Apply rate limiting to requests"""
        path = request.url.path
        
        # Skip rate limiting for exempt paths
        if path in self.EXEMPT_PATHS:
            return await call_next(request)
        
        # Get client identifier
        client_id = await self._get_client_id(request)
        
        # Get rate limit configuration for this endpoint
        rate_config = self._get_rate_limit_config(path)
        
        # Check rate limit
        is_allowed, remaining, reset_time = await self._check_rate_limit(
            client_id, path, rate_config["requests"], rate_config["window"]
        )
        
        if not is_allowed:
            # Log rate limit exceeded
            security_logger.log_rate_limit_exceeded(
                ip_address=self._get_client_ip(request),
                endpoint=path,
                user_id=getattr(request.state, 'user_id', None)
            )
            
            # Return rate limit response
            return JSONResponse(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                content={
                    "error": "Rate limit exceeded",
                    "message": f"Too many requests. Try again in {reset_time} seconds.",
                    "retry_after": reset_time
                },
                headers={
                    "Retry-After": str(reset_time),
                    "X-RateLimit-Limit": str(rate_config["requests"]),
                    "X-RateLimit-Remaining": "0",
                    "X-RateLimit-Reset": str(int(time.time()) + reset_time)
                }
            )
        
        # Continue with request
        response = await call_next(request)
        
        # Add rate limit headers to response
        response.headers["X-RateLimit-Limit"] = str(rate_config["requests"])
        response.headers["X-RateLimit-Remaining"] = str(remaining)
        response.headers["X-RateLimit-Reset"] = str(int(time.time()) + reset_time)
        
        return response
    
    async def _get_client_id(self, request: Request) -> str:
        """Get unique client identifier for rate limiting"""
        # Use user ID if authenticated
        user_id = getattr(request.state, 'user_id', None)
        if user_id:
            return f"user:{user_id}"
        
        # Fallback to IP address
        client_ip = self._get_client_ip(request)
        return f"ip:{client_ip}"
    
    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address from request"""
        # Check for forwarded IP first
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            return forwarded_for.split(",")[0].strip()
        
        # Check for real IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip
        
        # Fallback to client host
        return request.client.host if request.client else "unknown"
    
    def _get_rate_limit_config(self, path: str) -> Dict[str, int]:
        """Get rate limit configuration for specific path"""
        # Check for exact path match
        if path in self.CUSTOM_LIMITS:
            return self.CUSTOM_LIMITS[path]
        
        # Check for path prefix matches
        for custom_path, config in self.CUSTOM_LIMITS.items():
            if path.startswith(custom_path):
                return config
        
        # Return default configuration
        return {
            "requests": self.default_requests,
            "window": self.default_window
        }
    
    async def _check_rate_limit(
        self, 
        client_id: str, 
        path: str, 
        max_requests: int, 
        window_seconds: int
    ) -> Tuple[bool, int, int]:
        """
        Check if client has exceeded rate limit
        Returns: (is_allowed, remaining_requests, reset_time_seconds)
        """
        try:
            redis = await get_redis_client()
            current_time = int(time.time())
            window_start = current_time - window_seconds
            
            # Create unique key for this client and endpoint
            key = f"rate_limit:{client_id}:{path}"
            
            # Use Redis sorted set to track requests in time window
            pipe = redis.pipeline()
            
            # Remove old requests outside the time window
            pipe.zremrangebyscore(key, 0, window_start)
            
            # Count current requests in window
            pipe.zcard(key)
            
            # Execute pipeline
            results = await pipe.execute()
            current_requests = results[1]
            
            if current_requests >= max_requests:
                # Rate limit exceeded
                oldest_request = await redis.zrange(key, 0, 0, withscores=True)
                if oldest_request:
                    reset_time = int(oldest_request[0][1]) + window_seconds - current_time
                    return False, 0, max(1, reset_time)
                else:
                    return False, 0, window_seconds
            
            # Add current request to set
            await redis.zadd(key, {str(current_time): current_time})
            
            # Set expiration on key
            await redis.expire(key, window_seconds + 10)  # Add buffer
            
            remaining = max_requests - current_requests - 1
            reset_time = window_seconds
            
            return True, remaining, reset_time
            
        except Exception as e:
            logger.error("Rate limiting check failed", error=str(e))
            # Allow request if rate limiting fails
            return True, max_requests - 1, window_seconds
    
    async def _cleanup_expired_keys(self):
        """Clean up expired rate limiting keys (background task)"""
        try:
            redis = await get_redis_client()
            pattern = "rate_limit:*"
            
            # Get all rate limiting keys
            keys = await redis.keys(pattern)
            
            if keys:
                # Check TTL and remove expired keys
                pipe = redis.pipeline()
                for key in keys:
                    pipe.ttl(key)
                
                ttls = await pipe.execute()
                expired_keys = [key for key, ttl in zip(keys, ttls) if ttl <= 0]
                
                if expired_keys:
                    await redis.delete(*expired_keys)
                    logger.debug("Cleaned up expired rate limit keys", count=len(expired_keys))
                    
        except Exception as e:
            logger.error("Rate limit cleanup failed", error=str(e))


class AdaptiveRateLimit:
    """Adaptive rate limiting that adjusts based on system load"""
    
    def __init__(self):
        self.base_limit = settings.RATE_LIMIT_REQUESTS
        self.current_multiplier = 1.0
        self.last_adjustment = time.time()
        
    async def get_adaptive_limit(self, endpoint: str) -> int:
        """Get adaptive rate limit based on current system load"""
        try:
            # Get system metrics
            redis = await get_redis_client()
            
            # Check Redis memory usage
            info = await redis.info("memory")
            used_memory_mb = info.get("used_memory", 0) / (1024 * 1024)
            
            # Adjust rate limit based on memory usage
            if used_memory_mb > 500:  # High memory usage
                self.current_multiplier = 0.5  # Reduce by 50%
            elif used_memory_mb > 200:  # Medium memory usage
                self.current_multiplier = 0.75  # Reduce by 25%
            else:
                self.current_multiplier = 1.0  # Normal rate limit
            
            adaptive_limit = int(self.base_limit * self.current_multiplier)
            
            # Log adjustment if changed
            current_time = time.time()
            if abs(self.current_multiplier - 1.0) > 0.1 and current_time - self.last_adjustment > 60:
                logger.info(
                    "Rate limit adjusted",
                    endpoint=endpoint,
                    multiplier=self.current_multiplier,
                    new_limit=adaptive_limit,
                    memory_mb=used_memory_mb
                )
                self.last_adjustment = current_time
            
            return max(1, adaptive_limit)  # Ensure minimum of 1 request
            
        except Exception as e:
            logger.error("Adaptive rate limit calculation failed", error=str(e))
            return self.base_limit


# Global adaptive rate limiter instance
adaptive_limiter = AdaptiveRateLimit()


async def get_rate_limit_status(client_id: str, endpoint: str) -> Dict[str, int]:
    """Get current rate limit status for client"""
    try:
        redis = await get_redis_client()
        key = f"rate_limit:{client_id}:{endpoint}"
        
        current_requests = await redis.zcard(key)
        ttl = await redis.ttl(key)
        
        return {
            "current_requests": current_requests,
            "reset_in_seconds": max(0, ttl),
            "requests_remaining": max(0, settings.RATE_LIMIT_REQUESTS - current_requests)
        }
        
    except Exception as e:
        logger.error("Rate limit status check failed", error=str(e))
        return {
            "current_requests": 0,
            "reset_in_seconds": settings.RATE_LIMIT_WINDOW,
            "requests_remaining": settings.RATE_LIMIT_REQUESTS
        }


async def clear_rate_limit(client_id: str, endpoint: str = None) -> bool:
    """Clear rate limit for specific client/endpoint (admin function)"""
    try:
        redis = await get_redis_client()
        
        if endpoint:
            key = f"rate_limit:{client_id}:{endpoint}"
            await redis.delete(key)
        else:
            # Clear all rate limits for client
            pattern = f"rate_limit:{client_id}:*"
            keys = await redis.keys(pattern)
            if keys:
                await redis.delete(*keys)
        
        logger.info("Rate limit cleared", client_id=client_id, endpoint=endpoint)
        return True
        
    except Exception as e:
        logger.error("Rate limit clear failed", error=str(e))
        return False