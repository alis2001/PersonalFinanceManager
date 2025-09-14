"""
Logging Utilities for Analytics Service
Location: services/analytics/src/utils/logger.py
"""

import logging
import sys
import time
from typing import Dict, Any, Optional
import structlog
from structlog.stdlib import LoggerFactory

from ..config.settings import settings

def setup_logging():
    """Configure structured logging for the analytics service"""
    
    # Configure structlog
    structlog.configure(
        processors=[
            # Add timestamp
            structlog.stdlib.add_log_level,
            structlog.stdlib.add_logger_name,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.dev.ConsoleRenderer() if settings.is_development else structlog.processors.JSONRenderer()
        ],
        context_class=dict,
        logger_factory=LoggerFactory(),
        wrapper_class=structlog.stdlib.BoundLogger,
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO),
    )
    
    # Configure third-party library log levels
    _configure_third_party_logs()
    
    # Log startup
    logger = structlog.get_logger(__name__)
    logger.info(
        "Logging configured", 
        level=settings.LOG_LEVEL,
        format=settings.LOG_FORMAT,
        environment=settings.ENVIRONMENT
    )

def _configure_third_party_logs():
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
    
    def log_user_activity(self, user_id: str, action: str, resource: str, **kwargs):
        """Log user activity for analytics"""
        self.logger.info(
            "User activity",
            user_id=user_id,
            action=action,
            resource=resource,
            timestamp=time.time(),
            **kwargs
        )
    
    def log_forecast_generation(self, model_type: str, forecast_days: int, 
                              accuracy: float = None, user_id: str = None, **kwargs):
        """Log forecasting operations"""
        log_data = {
            "forecast_generated": True,
            "model_type": model_type,
            "forecast_days": forecast_days,
            "user_id": user_id,
            **kwargs
        }
        
        if accuracy is not None:
            log_data["model_accuracy"] = round(accuracy, 4)
            
        self.logger.info("Forecast generated", **log_data)
    
    def log_export_operation(self, export_format: str, record_count: int, 
                           file_size_mb: float = None, user_id: str = None, **kwargs):
        """Log data export operations"""
        log_data = {
            "data_exported": True,
            "format": export_format,
            "record_count": record_count,
            "user_id": user_id,
            **kwargs
        }
        
        if file_size_mb is not None:
            log_data["file_size_mb"] = round(file_size_mb, 2)
            
        self.logger.info("Data exported", **log_data)
    
    def log_error_with_context(self, error: Exception, context: Dict[str, Any]):
        """Log error with contextual information"""
        self.logger.error(
            "Operation failed",
            error=str(error),
            error_type=type(error).__name__,
            **context
        )

class PerformanceLogger:
    """Performance monitoring logger"""
    
    def __init__(self, logger_name: str = "performance"):
        self.logger = structlog.get_logger(logger_name)
    
    def log_request_performance(self, method: str, path: str, duration_ms: float, 
                              status_code: int, user_id: str = None, **kwargs):
        """Log HTTP request performance"""
        self.logger.info(
            "Request processed",
            http_method=method,
            path=path,
            duration_ms=round(duration_ms, 2),
            status_code=status_code,
            user_id=user_id,
            **kwargs
        )
    
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