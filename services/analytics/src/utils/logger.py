"""
Logger Utilities for Analytics Service
Location: services/analytics/src/utils/logger.py
"""

import os
import sys
import time
import logging
import structlog
from typing import Dict, Any, Optional, Union
from datetime import datetime

from ..config.settings import settings


def setup_logging():
    """Configure structured logging for the analytics service"""
    
    # Configure structlog processors
    processors = [
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
    ]
    
    # Add JSON formatting for production, human-readable for development
    if settings.is_production:
        processors.append(structlog.processors.JSONRenderer())
    else:
        processors.append(structlog.dev.ConsoleRenderer(colors=True))
    
    # Configure structlog
    structlog.configure(
        processors=processors,
        wrapper_class=structlog.stdlib.BoundLogger,
        logger_factory=structlog.stdlib.LoggerFactory(),
        cache_logger_on_first_use=True,
    )
    
    # Configure standard library logging
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, settings.LOG_LEVEL.upper()),
    )
    
    # Set up file logging if specified
    if settings.LOG_FILE:
        file_handler = logging.FileHandler(settings.LOG_FILE)
        file_handler.setFormatter(logging.Formatter("%(message)s"))
        logging.getLogger().addHandler(file_handler)


class AnalyticsLogger:
    """Enhanced logger for analytics-specific operations"""
    
    def __init__(self):
        self.logger = structlog.get_logger("analytics")
    
    def log_user_activity(self, user_id: str, action: str, resource: str, **kwargs):
        """Log user analytics activity"""
        self.logger.info(
            "User Activity",
            user_id=user_id,
            action=action,
            resource=resource,
            timestamp=datetime.utcnow().isoformat(),
            **kwargs
        )
    
    def log_cache_operation(self, operation: str, cache_key: str, hit: bool = None, ttl: int = None):
        """Log cache operations"""
        log_data = {
            "operation": operation,
            "cache_key": cache_key,
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if hit is not None:
            log_data["hit"] = hit
        if ttl is not None:
            log_data["ttl_seconds"] = ttl
            
        self.logger.debug("Cache Operation", **log_data)
    
    def log_query_performance(self, query_type: str, duration_ms: float, rows_affected: int = None):
        """Log database query performance"""
        log_data = {
            "query_type": query_type,
            "duration_ms": round(duration_ms, 2),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if rows_affected is not None:
            log_data["rows_affected"] = rows_affected
        
        # Log as warning if query is slow
        if duration_ms > 1000:  # 1 second
            self.logger.warning("Slow Query Detected", **log_data)
        else:
            self.logger.debug("Query Performance", **log_data)
    
    def log_analytics_generation(self, user_id: str, analytics_type: str, processing_time_ms: float, **kwargs):
        """Log analytics generation events"""
        self.logger.info(
            "Analytics Generated",
            user_id=user_id,
            analytics_type=analytics_type,
            processing_time_ms=round(processing_time_ms, 2),
            timestamp=datetime.utcnow().isoformat(),
            **kwargs
        )
    
    def log_error_with_context(self, error: Exception, context: Dict[str, Any]):
        """Log errors with additional context"""
        self.logger.error(
            "Analytics Error",
            error=str(error),
            error_type=type(error).__name__,
            context=context,
            timestamp=datetime.utcnow().isoformat(),
            exc_info=True
        )
    
    def log_ml_operation(self, model_type: str, operation: str, user_id: str, **kwargs):
        """Log machine learning operations"""
        self.logger.info(
            "ML Operation",
            model_type=model_type,
            operation=operation,
            user_id=user_id,
            timestamp=datetime.utcnow().isoformat(),
            **kwargs
        )


class PerformanceLogger:
    """Logger for performance monitoring and metrics"""
    
    def __init__(self):
        self.logger = structlog.get_logger("performance")
    
    def log_request_metrics(self, endpoint: str, method: str, duration_ms: float, status_code: int, user_id: str = None):
        """Log HTTP request performance metrics"""
        self.logger.info(
            "Request Performance",
            endpoint=endpoint,
            method=method,
            duration_ms=round(duration_ms, 2),
            status_code=status_code,
            user_id=user_id,
            timestamp=datetime.utcnow().isoformat()
        )
    
    def log_database_metrics(self, operation: str, duration_ms: float, pool_stats: Dict[str, Any] = None):
        """Log database performance metrics"""
        log_data = {
            "operation": operation,
            "duration_ms": round(duration_ms, 2),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if pool_stats:
            log_data["pool_stats"] = pool_stats
        
        self.logger.info("Database Performance", **log_data)
    
    def log_cache_metrics(self, operation: str, duration_ms: float, hit_rate: float = None):
        """Log cache performance metrics"""
        log_data = {
            "operation": operation,
            "duration_ms": round(duration_ms, 2),
            "timestamp": datetime.utcnow().isoformat()
        }
        
        if hit_rate is not None:
            log_data["hit_rate"] = round(hit_rate, 3)
        
        self.logger.info("Cache Performance", **log_data)
    
    def log_memory_usage(self, memory_mb: float, process_name: str = "analytics"):
        """Log memory usage metrics"""
        self.logger.info(
            "Memory Usage",
            memory_mb=round(memory_mb, 2),
            process_name=process_name,
            timestamp=datetime.utcnow().isoformat()
        )
    
    def log_processing_benchmark(self, operation: str, records_processed: int, duration_ms: float):
        """Log data processing benchmarks"""
        records_per_second = (records_processed / (duration_ms / 1000)) if duration_ms > 0 else 0
        
        self.logger.info(
            "Processing Benchmark",
            operation=operation,
            records_processed=records_processed,
            duration_ms=round(duration_ms, 2),
            records_per_second=round(records_per_second, 2),
            timestamp=datetime.utcnow().isoformat()
        )


class SecurityLogger:
    """Logger for security-related events"""
    
    def __init__(self):
        self.logger = structlog.get_logger("security")
    
    def log_authentication_attempt(self, user_id: str = None, success: bool = False, ip_address: str = None):
        """Log authentication attempts"""
        self.logger.info(
            "Authentication Attempt",
            user_id=user_id,
            success=success,
            ip_address=ip_address,
            timestamp=datetime.utcnow().isoformat()
        )
    
    def log_rate_limit_exceeded(self, ip_address: str, endpoint: str, user_id: str = None):
        """Log rate limiting events"""
        self.logger.warning(
            "Rate Limit Exceeded",
            ip_address=ip_address,
            endpoint=endpoint,
            user_id=user_id,
            timestamp=datetime.utcnow().isoformat()
        )
    
    def log_suspicious_activity(self, user_id: str, activity: str, details: Dict[str, Any]):
        """Log suspicious user activity"""
        self.logger.warning(
            "Suspicious Activity",
            user_id=user_id,
            activity=activity,
            details=details,
            timestamp=datetime.utcnow().isoformat()
        )


# Create global logger instances
analytics_logger = AnalyticsLogger()
performance_logger = PerformanceLogger()
security_logger = SecurityLogger()


def get_logger(name: str = "analytics") -> structlog.BoundLogger:
    """Get a structured logger instance"""
    return structlog.get_logger(name)


def log_analytics_event(event_type: str, user_id: str, data: Dict[str, Any]):
    """Convenience function to log analytics events"""
    analytics_logger.log_user_activity(
        user_id=user_id,
        action=event_type,
        resource="analytics_event",
        event_data=data
    )


def measure_performance(operation_name: str):
    """Decorator to measure and log function performance"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            start_time = time.time()
            try:
                result = func(*args, **kwargs)
                duration_ms = (time.time() - start_time) * 1000
                performance_logger.log_processing_benchmark(
                    operation=operation_name,
                    records_processed=len(result) if hasattr(result, '__len__') else 1,
                    duration_ms=duration_ms
                )
                return result
            except Exception as e:
                duration_ms = (time.time() - start_time) * 1000
                analytics_logger.log_error_with_context(e, {
                    "operation": operation_name,
                    "duration_ms": duration_ms
                })
                raise
        return wrapper
    return decorator