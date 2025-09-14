"""
Logger Setup and Utilities for Analytics Service
Location: services/analytics/src/utils/logger.py
"""

import sys
import logging
import structlog
from typing import Any, Dict, Optional
from datetime import datetime
import json

from ..config.settings import settings

def setup_logging():
    """Configure structured logging for the analytics service"""
    
    # Configure structlog processors
    processors = [
        # Add log level
        structlog.stdlib.add_log_level,
        
        # Add timestamp
        structlog.processors.TimeStamper(fmt="iso"),
        
        # Add caller info in development
        structlog.dev.set_exc_info if settings.is_development else structlog.processors.format_exc_info,
        
        # Add service context
        add_service_context,
        
        # JSON formatting for production, pretty printing for development
        structlog.dev.ConsoleRenderer(colors=True) if settings.is_development 
        else structlog.processors.JSONRenderer()
    ]
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        context_class=dict,
        logger_factory=structlog.stdlib.LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper())
    )
    
    # Set third-party library log levels
    configure_third_party_loggers()

def add_service_context(logger, method_name: str, event_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Add service-specific context to all log entries"""
    event_dict.update({
        "service": "analytics",
        "version": settings.VERSION,
        "environment": settings.ENVIRONMENT
    })
    return event_dict

def configure_third_party_loggers():
    """Configure log levels for third-party libraries"""
    # Reduce noise from verbose libraries
    library_levels = {
        "uvicorn.access": logging.WARNING,
        "asyncpg": logging.WARNING,
        "aioredis": logging.WARNING,
        "matplotlib": logging.WARNING,
        "PIL": logging.WARNING,
        "urllib3": logging.WARNING,
        "httpx": logging.WARNING,
    }
    
    for library, level in library_levels.items():
        logging.getLogger(library).setLevel(level)

class AnalyticsLogger:
    """Specialized logger for analytics operations"""
    
    def __init__(self, name: str = "analytics"):
        self.logger = structlog.get_logger(name)
    
    def log_query_performance(self, query_type: str, duration_ms: float, 
                            user_id: str = None, **kwargs):
        """Log database query performance"""
        self.logger.info(
            "Database query executed",
            query_type=query_type,
            duration_ms=round(duration_ms, 2),
            user_id=user_id,
            **kwargs
        )
    
    def log_cache_operation(self, operation: str, key: str, hit: bool = None, 
                          ttl: int = None, **kwargs):
        """Log cache operations"""
        log_data = {
            "cache_operation": operation,
            "cache_key": key,
            **kwargs
        }
        
        if hit is not None:
            log_data["cache_hit"] = hit
        if ttl is not None:
            log_data["ttl_seconds"] = ttl
            
        self.logger.info("Cache operation", **log_data)
    
    def log_chart_generation(self, chart_type: str, data_points: int, 
                           generation_time_ms: float, user_id: str = None, **kwargs):
        """Log chart generation metrics"""
        self.logger.info(
            "Chart generated",
            chart_type=chart_type,
            data_points=data_points,
            generation_time_ms=round(generation_time_ms, 2),
            user_id=user_id,
            **kwargs
        )
    
    def log_ml_operation(self, operation: str, model_type: str, 
                        data_points: int, duration_ms: float, **kwargs):
        """Log machine learning operations"""
        self.logger.info(
            "ML operation completed",
            ml_operation=operation,
            model_type=model_type,
            data_points=data_points,
            duration_ms=round(duration_ms, 2),
            **kwargs
        )
    
    def log_user_activity(self, user_id: str, action: str, 
                         resource: str = None, **kwargs):
        """Log user activities for analytics"""
        self.logger.info(
            "User activity",
            user_id=user_id,
            action=action,
            resource=resource,
            **kwargs
        )
    
    def log_error_with_context(self, error: Exception, context: Dict[str, Any]):
        """Log errors with rich context"""
        self.logger.error(
            "Error occurred",
            error_type=type(error).__name__,
            error_message=str(error),
            **context,
            exc_info=True
        )
    
    def log_api_call(self, endpoint: str, method: str, status_code: int,
                    duration_ms: float, user_id: str = None, **kwargs):
        """Log API call metrics"""
        self.logger.info(
            "API call completed",
            endpoint=endpoint,
            method=method,
            status_code=status_code,
            duration_ms=round(duration_ms, 2),
            user_id=user_id,
            **kwargs
        )

class PerformanceLogger:
    """Performance monitoring logger"""
    
    def __init__(self, logger_name: str = "performance"):
        self.logger = structlog.get_logger(logger_name)
    
    def log_slow_query(self, query: str, duration_ms: float, threshold_ms: float = 1000):
        """Log slow database queries"""
        if duration_ms > threshold_ms:
            self.logger.warning(
                "Slow query detected",
                query_preview=query[:200] + "..." if len(query) > 200 else query,
                duration_ms=round(duration_ms, 2),
                threshold_ms=threshold_ms
            )
    
    def log_memory_usage(self, operation: str, memory_mb: float):
        """Log memory usage for operations"""
        self.logger.info(
            "Memory usage",
            operation=operation,
            memory_mb=round(memory_mb, 2)
        )
    
    def log_rate_limit_hit(self, client_id: str, endpoint: str, limit_type: str):
        """Log rate limit violations"""
        self.logger.warning(
            "Rate limit exceeded",
            client_id=client_id,
            endpoint=endpoint,
            limit_type=limit_type
        )

class SecurityLogger:
    """Security-focused logging"""
    
    def __init__(self, logger_name: str = "security"):
        self.logger = structlog.get_logger(logger_name)
    
    def log_auth_failure(self, reason: str, client_ip: str = None, 
                        user_agent: str = None, **kwargs):
        """Log authentication failures"""
        self.logger.warning(
            "Authentication failed",
            failure_reason=reason,
            client_ip=client_ip,
            user_agent=user_agent,
            **kwargs
        )
    
    def log_suspicious_activity(self, activity: str, user_id: str = None,
                              client_ip: str = None, **kwargs):
        """Log potentially suspicious activities"""
        self.logger.warning(
            "Suspicious activity detected",
            activity=activity,
            user_id=user_id,
            client_ip=client_ip,
            **kwargs
        )
    
    def log_data_access(self, user_id: str, resource: str, action: str,
                       sensitive: bool = False, **kwargs):
        """Log data access for audit trails"""
        log_level = "warning" if sensitive else "info"
        
        getattr(self.logger, log_level)(
            "Data access",
            user_id=user_id,
            resource=resource,
            action=action,
            sensitive_data=sensitive,
            **kwargs
        )

# Utility functions for common logging patterns
def log_execution_time(func_name: str, start_time: float, end_time: float, **kwargs):
    """Log function execution time"""
    logger = structlog.get_logger("performance")
    duration_ms = (end_time - start_time) * 1000
    
    logger.info(
        "Function execution",
        function=func_name,
        duration_ms=round(duration_ms, 2),
        **kwargs
    )

def log_data_processing(operation: str, records_processed: int, 
                       processing_time_ms: float, **kwargs):
    """Log data processing operations"""
    logger = structlog.get_logger("analytics")
    
    logger.info(
        "Data processing completed",
        operation=operation,
        records_processed=records_processed,
        processing_time_ms=round(processing_time_ms, 2),
        records_per_second=round(records_processed / (processing_time_ms / 1000), 2) if processing_time_ms > 0 else 0,
        **kwargs
    )

def create_request_logger(request_id: str = None, user_id: str = None):
    """Create a logger with request context"""
    logger = structlog.get_logger("request")
    
    context = {}
    if request_id:
        context["request_id"] = request_id
    if user_id:
        context["user_id"] = user_id
    
    return logger.bind(**context)

# Export common logger instances
analytics_logger = AnalyticsLogger()
performance_logger = PerformanceLogger() 
security_logger = SecurityLogger()