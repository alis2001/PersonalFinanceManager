"""
Authentication Middleware for Analytics Service
Location: services/analytics/src/middleware/auth.py
"""

import jwt
import time
from typing import Optional
from fastapi import Request, HTTPException, status, Depends
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
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Token has expired"
                )
            
            # Extract user information
            user_id = payload.get('userId') or payload.get('user_id')
            if not user_id:
                logger.warning("Token missing user ID", path=path)
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Invalid token: missing user ID"
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
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Token has expired"
            )
        except jwt.InvalidTokenError as e:
            logger.warning("JWT validation failed", path=path, error=str(e))
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token"
            )
        except Exception as e:
            logger.error("Authentication error", path=path, error=str(e))
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Authentication service error"
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

# Token utilities
def verify_token(token: str) -> Optional[dict]:
    """Verify JWT token and return payload"""
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET,
            algorithms=[settings.JWT_ALGORITHM]
        )
        
        # Check expiration
        if payload.get('exp') and payload['exp'] < time.time():
            return None
            
        return payload
        
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError):
        return None
    except Exception as e:
        logger.error("Token verification error", error=str(e))
        return None

def create_token(user_data: dict, expires_in: int = None) -> str:
    """Create JWT token for user"""
    try:
        expires_in = expires_in or 3600  # 1 hour default
        
        payload = {
            'userId': user_data['user_id'],
            'email': user_data.get('email'),
            'verified': user_data.get('verified', False),
            'exp': int(time.time()) + expires_in,
            'iat': int(time.time())
        }
        
        token = jwt.encode(
            payload,
            settings.JWT_SECRET,
            algorithm=settings.JWT_ALGORITHM
        )
        
        return token
        
    except Exception as e:
        logger.error("Token creation error", error=str(e))
        raise

# Security validation helpers
def validate_user_access(request: Request, resource_user_id: str) -> bool:
    """Validate user has access to resource"""
    current_user_id = getattr(request.state, 'user_id', None)
    
    if not current_user_id:
        return False
    
    # Users can only access their own resources
    return current_user_id == resource_user_id

async def require_resource_access(request: Request, resource_user_id: str) -> str:
    """Require user to have access to specific resource"""
    user_id = await get_user_id(request)
    
    if not validate_user_access(request, resource_user_id):
        logger.warning("Unauthorized resource access attempt", 
                      user_id=user_id, 
                      resource_user_id=resource_user_id)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return user_id

# Optional authentication for public endpoints
async def get_optional_user_id(request: Request) -> Optional[str]:
    """Get user ID if available, but don't require authentication"""
    return getattr(request.state, 'user_id', None)

# Rate limiting user identification
def get_rate_limit_key(request: Request) -> str:
    """Get rate limiting key for request"""
    user_id = getattr(request.state, 'user_id', None)
    if user_id:
        return f"user:{user_id}"
    
    # Fallback to IP address
    client_ip = request.client.host if request.client else "unknown"
    forwarded_for = request.headers.get("x-forwarded-for")
    if forwarded_for:
        client_ip = forwarded_for.split(",")[0].strip()
    
    return f"ip:{client_ip}"