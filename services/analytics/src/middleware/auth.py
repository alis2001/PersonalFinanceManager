"""
Authentication Middleware for Analytics Service
Location: services/analytics/src/middleware/auth.py
"""

import jwt
import time
from typing import Optional
from fastapi import Request, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

from ..config.settings import settings

logger = structlog.get_logger(__name__)

# Security scheme for FastAPI docs
security = HTTPBearer()

class AuthMiddleware(BaseHTTPMiddleware):
    """JWT Authentication middleware"""
    
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header required"
            )
        
        # Validate bearer token format
        try:
            scheme, token = auth_header.split(" ", 1)
            if scheme.lower() != "bearer":
                raise ValueError("Invalid scheme")
        except ValueError:
            logger.warning("Invalid authorization header format", path=path)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format"
            )
        
        # Verify and decode JWT token
        try:
            payload = decode_jwt_token(token)
            user_id = payload.get("user_id")
            
            if not user_id:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing user_id"
                )
            
            # Add user info to request state
            request.state.user_id = user_id
            request.state.user_email = payload.get("email")
            request.state.token_payload = payload
            
            logger.info(
                "Authenticated request",
                user_id=user_id,
                path=path,
                method=request.method
            )
            
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Token validation error: {str(e)}", path=path)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired token"
            )
        
        return await call_next(request)

def decode_jwt_token(token: str) -> dict:
    """Decode and validate JWT token"""
    try:
        # Decode token with signature verification
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Check token expiration
        exp = payload.get("exp")
        if exp and exp < time.time():
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.warning("Token expired")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid token: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )

async def get_current_user(request: Request) -> dict:
    """Extract current user from request state"""
    user_id = getattr(request.state, 'user_id', None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    
    return {
        "user_id": user_id,
        "email": getattr(request.state, 'user_email', None),
        "payload": getattr(request.state, 'token_payload', {})
    }

def require_auth(request: Request) -> str:
    """Dependency to require authentication and return user_id"""
    user_id = getattr(request.state, 'user_id', None)
    if not user_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required"
        )
    return user_id

def optional_auth(request: Request) -> Optional[str]:
    """Optional authentication dependency"""
    return getattr(request.state, 'user_id', None)

class TokenValidator:
    """Token validation utility class"""
    
    @staticmethod
    def validate_token_format(auth_header: str) -> str:
        """Validate and extract token from authorization header"""
        if not auth_header:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Authorization header required"
            )
        
        try:
            scheme, token = auth_header.split(" ", 1)
            if scheme.lower() != "bearer":
                raise ValueError("Invalid scheme")
            return token
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authorization header format. Use: Bearer <token>"
            )
    
    @staticmethod
    def extract_user_claims(token: str) -> dict:
        """Extract user claims from token"""
        try:
            payload = decode_jwt_token(token)
            return {
                "user_id": payload.get("user_id"),
                "email": payload.get("email"),
                "account_type": payload.get("account_type", "personal"),
                "expires_at": payload.get("exp"),
                "issued_at": payload.get("iat")
            }
        except Exception as e:
            logger.error(f"Token claim extraction error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token claims"
            )

# Dependency functions for FastAPI route handlers
async def get_authenticated_user(request: Request) -> dict:
    """FastAPI dependency for authenticated user"""
    return await get_current_user(request)

def get_user_id(request: Request) -> str:
    """FastAPI dependency for user ID only"""
    return require_auth(request)

def get_optional_user_id(request: Request) -> Optional[str]:
    """FastAPI dependency for optional user ID"""
    return optional_auth(request)

# Token refresh utilities
async def verify_refresh_token(refresh_token: str) -> dict:
    """Verify refresh token (for future token refresh endpoints)"""
    try:
        payload = jwt.decode(
            refresh_token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Ensure it's a refresh token
        if payload.get("token_type") != "refresh":
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid refresh token"
            )
        
        return payload
        
    except jwt.InvalidTokenError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid refresh token"
        )