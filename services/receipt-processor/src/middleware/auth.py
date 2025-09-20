"""
Authentication Middleware for Receipt Processing Service
Location: services/receipt-processor/src/middleware/auth.py
"""

import jwt
import time
from typing import Optional
from fastapi import Request, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

from ..config.settings import settings

logger = structlog.get_logger(__name__)

# Security scheme for FastAPI docs
security = HTTPBearer()

class AuthMiddleware(BaseHTTPMiddleware):
    """JWT Authentication middleware - handles auth properly"""
    
    # Public endpoints that don't require authentication
    PUBLIC_PATHS = {
        "/",
        "/health", 
        "/docs",
        "/redoc",
        "/openapi.json"
    }
    
    async def dispatch(self, request: Request, call_next):
        """Process authentication for each request"""
        path = request.url.path
        
        # Skip authentication for public endpoints
        if path in self.PUBLIC_PATHS:
            return await call_next(request)
        
        # Extract authorization header
        auth_header = request.headers.get("authorization")
        if not auth_header:
            logger.warning("Missing authorization header", path=path)
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Authorization header required"}
            )
        
        # Validate bearer token format
        try:
            scheme, token = auth_header.split(" ", 1)
            if scheme.lower() != "bearer":
                raise ValueError("Invalid scheme")
        except ValueError:
            logger.warning("Invalid authorization header format", path=path)
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid authorization header format"}
            )
        
        # Verify and decode JWT
        try:
            payload = jwt.decode(
                token, 
                settings.JWT_SECRET, 
                algorithms=[settings.JWT_ALGORITHM]
            )
            
            # Check token expiration
            if payload.get('exp') and payload['exp'] < time.time():
                logger.warning("Token expired", path=path)
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Token has expired"}
                )
            
            # Extract user information
            user_id = payload.get('userId') or payload.get('user_id')
            if not user_id:
                logger.warning("Token missing user ID", path=path)
                return JSONResponse(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    content={"detail": "Invalid token: missing user ID"}
                )
            
            # Store user info in request state
            request.state.user_id = user_id
            request.state.user_email = payload.get('email')
            request.state.user_verified = payload.get('verified', False)
            request.state.token_payload = payload
            
            logger.debug("Authentication successful", 
                        user_id=user_id, 
                        path=path)
            
        except jwt.ExpiredSignatureError:
            logger.warning("JWT expired", path=path)
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Token has expired"}
            )
        except jwt.InvalidTokenError as e:
            logger.warning("JWT validation failed", path=path, error=str(e))
            return JSONResponse(
                status_code=status.HTTP_401_UNAUTHORIZED,
                content={"detail": "Invalid token"}
            )
        except Exception as e:
            logger.error("Authentication error", path=path, error=str(e))
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"detail": "Authentication service error"}
            )
        
        return await call_next(request)

# Dependency for route handlers
async def get_user_id(request: Request) -> str:
    """Extract user ID from authenticated request"""
    user_id = getattr(request.state, 'user_id', None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    return user_id

async def get_current_user(request: Request) -> dict:
    """Get current user information from authenticated request"""
    user_id = getattr(request.state, 'user_id', None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not authenticated"
        )
    
    return {
        "user_id": user_id,
        "email": getattr(request.state, 'user_email', None),
        "verified": getattr(request.state, 'user_verified', False),
        "token_payload": getattr(request.state, 'token_payload', {})
    }

async def require_verified_user(request: Request) -> str:
    """Require user to be email verified"""
    user_id = await get_user_id(request)
    user_verified = getattr(request.state, 'user_verified', False)
    
    if not user_verified:
        logger.warning("Unverified user access attempt", user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Email verification required"
        )
    
    return user_id