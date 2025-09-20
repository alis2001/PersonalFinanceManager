"""
Database Connection for Receipt Processing Service
Location: services/receipt-processor/src/database/connection.py
"""

import asyncio
import time
from typing import List, Dict, Any, Optional, Union
from contextlib import asynccontextmanager

import asyncpg
import structlog
from decimal import Decimal

from ..config.settings import settings

logger = structlog.get_logger(__name__)

# Global connection pool
db_pool: Optional[asyncpg.Pool] = None

async def init_db():
    """Initialize database connection pool"""
    global db_pool
    
    try:
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
        
        # Test connection
        async with db_pool.acquire() as conn:
            await conn.execute('SELECT 1')
            logger.info("PostgreSQL connection pool initialized successfully")
        
    except Exception as e:
        logger.error("Failed to initialize database pool", error=str(e))
        raise

async def close_db():
    """Close database connection pool"""
    global db_pool
    
    if db_pool:
        try:
            await db_pool.close()
            logger.info("Database connection pool closed")
        except Exception as e:
            logger.error("Error closing database pool", error=str(e))

async def execute_query(query: str, *args) -> List[Dict[str, Any]]:
    """Execute query and return results as list of dictionaries"""
    if not db_pool:
        raise RuntimeError("Database pool not initialized")
    
    try:
        async with db_pool.acquire() as conn:
            rows = await conn.fetch(query, *args)
            return [dict(row) for row in rows]
    except Exception as e:
        logger.error("Query execution failed", query=query, error=str(e))
        raise

async def execute_fetchrow(query: str, *args) -> Optional[Dict[str, Any]]:
    """Execute query and return single row as dictionary"""
    if not db_pool:
        raise RuntimeError("Database pool not initialized")
    
    try:
        async with db_pool.acquire() as conn:
            row = await conn.fetchrow(query, *args)
            return dict(row) if row else None
    except Exception as e:
        logger.error("Fetchrow execution failed", query=query, error=str(e))
        raise

async def execute_command(query: str, *args) -> str:
    """Execute command and return status"""
    if not db_pool:
        raise RuntimeError("Database pool not initialized")
    
    try:
        async with db_pool.acquire() as conn:
            result = await conn.execute(query, *args)
            return result
    except Exception as e:
        logger.error("Command execution failed", query=query, error=str(e))
        raise

@asynccontextmanager
async def get_db_transaction():
    """Get database transaction context manager"""
    if not db_pool:
        raise RuntimeError("Database pool not initialized")
    
    async with db_pool.acquire() as conn:
        async with conn.transaction():
            yield conn

# Receipt-specific database functions
async def create_receipt_job(user_id: str, filename: str, original_filename: str, 
                           file_size: int, file_type: str, mime_type: str,
                           file_path: str = None, checksum: str = None) -> str:
    """Create a new receipt processing job"""
    query = """
        INSERT INTO receipt_jobs (
            user_id, filename, original_filename, file_size, 
            file_type, mime_type, file_path, checksum, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
        RETURNING id
    """
    
    result = await execute_fetchrow(
        query, user_id, filename, original_filename, 
        file_size, file_type, mime_type, file_path, checksum
    )
    
    if result:
        job_id = result['id']
        await log_processing_step(job_id, 'upload', 'completed', 'File uploaded successfully')
        return str(job_id)
    
    raise RuntimeError("Failed to create receipt job")

async def get_receipt_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get receipt job by ID"""
    query = """
        SELECT * FROM receipt_jobs 
        WHERE id = $1
    """
    return await execute_fetchrow(query, job_id)

async def get_user_receipt_jobs(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Get user's receipt jobs"""
    query = """
        SELECT id, filename, original_filename, status, 
               created_at, updated_at, error_message
        FROM receipt_jobs 
        WHERE user_id = $1 
        ORDER BY created_at DESC 
        LIMIT $2
    """
    return await execute_query(query, user_id, limit)

async def update_receipt_job_status(job_id: str, status: str, error_message: str = None) -> bool:
    """Update receipt job status"""
    if error_message:
        query = """
            UPDATE receipt_jobs 
            SET status = $2, error_message = $3, updated_at = NOW()
            WHERE id = $1
        """
        result = await execute_command(query, job_id, status, error_message)
    else:
        query = """
            UPDATE receipt_jobs 
            SET status = $2, error_message = NULL, updated_at = NOW()
            WHERE id = $1
        """
        result = await execute_command(query, job_id, status)
    
    return result.startswith('UPDATE 1')

async def update_receipt_job_ocr(job_id: str, ocr_text: str, confidence: float = None) -> bool:
    """Update receipt job with OCR results"""
    query = """
        UPDATE receipt_jobs 
        SET ocr_text = $2, ocr_confidence = $3, 
            status = 'ocr_completed', updated_at = NOW()
        WHERE id = $1
    """
    result = await execute_command(query, job_id, ocr_text, confidence)
    
    if result.startswith('UPDATE 1'):
        await log_processing_step(job_id, 'ocr', 'completed', 'OCR processing completed')
        return True
    return False

async def update_receipt_job_ai_data(job_id: str, extracted_data: Dict[str, Any], 
                                   ai_provider: str = 'claude-3.5', 
                                   processing_time_ms: int = None,
                                   confidence: float = None) -> bool:
    """Update receipt job with AI extraction results"""
    import json
    
    query = """
        UPDATE receipt_jobs 
        SET extracted_data = $2, ai_provider = $3, 
            ai_processing_time_ms = $4, ai_confidence = $5,
            status = 'completed', processing_completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
    """
    
    result = await execute_command(
        query, job_id, json.dumps(extracted_data), 
        ai_provider, processing_time_ms, confidence
    )
    
    if result.startswith('UPDATE 1'):
        await log_processing_step(job_id, 'ai_processing', 'completed', 'AI extraction completed')
        return True
    return False

async def link_receipt_to_expense(job_id: str, expense_id: str) -> bool:
    """Link receipt job to created expense"""
    query = """
        UPDATE receipt_jobs 
        SET expense_id = $2, status = 'approved', updated_at = NOW()
        WHERE id = $1
    """
    result = await execute_command(query, job_id, expense_id)
    
    if result.startswith('UPDATE 1'):
        await log_processing_step(job_id, 'expense_creation', 'completed', 'Expense created and linked')
        return True
    return False

async def log_processing_step(job_id: str, step: str, status: str, 
                             message: str = None, metadata: Dict[str, Any] = None,
                             processing_time_ms: int = None, 
                             error_details: Dict[str, Any] = None) -> str:
    """Log a processing step"""
    import json
    
    query = """
        SELECT log_receipt_processing_step($1, $2, $3, $4, $5, $6, $7)
    """
    
    result = await execute_fetchrow(
        query, job_id, step, status, message,
        json.dumps(metadata) if metadata else None,
        processing_time_ms,
        json.dumps(error_details) if error_details else None
    )
    
    return str(result['log_receipt_processing_step']) if result else None