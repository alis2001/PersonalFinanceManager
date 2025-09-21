"""
Enhanced Database Connection for Receipt Processing Service - Multi-Transaction Support
Location: services/receipt-processor/src/database/connection.py
"""

import asyncio
import time
from typing import List, Dict, Any, Optional, Union
from contextlib import asynccontextmanager
import json
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

# ==============================================================================
# RECEIPT JOB FUNCTIONS (Enhanced for Multi-Transaction)
# ==============================================================================

async def create_receipt_job(user_id: str, filename: str, original_filename: str, 
                           file_size: int, file_type: str, mime_type: str,
                           file_content: bytes, checksum: str = None) -> str:
    """Create a new receipt processing job with file content stored in database"""
    query = """
        INSERT INTO receipt_jobs (
            user_id, filename, original_filename, file_size, 
            file_type, mime_type, file_content, checksum, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'uploaded')
        RETURNING id
    """
    
    result = await execute_fetchrow(
        query, user_id, filename, original_filename, 
        file_size, file_type, mime_type, file_content, checksum
    )
    
    if result:
        job_id = result['id']
        await log_processing_step(job_id, 'upload', 'completed', 
                                'File uploaded and stored in database successfully')
        return str(job_id)
    
    raise RuntimeError("Failed to create receipt job")

async def get_receipt_job(job_id: str) -> Optional[Dict[str, Any]]:
    """Get receipt job by ID with transaction summary (excludes file content for performance)"""
    query = """
        SELECT rj.id, rj.user_id, rj.filename, rj.original_filename, rj.file_size,
               rj.file_type, rj.mime_type, rj.checksum, rj.status,
               rj.processing_started_at, rj.processing_completed_at, rj.error_message,
               rj.retry_count, rj.ocr_text, rj.ocr_confidence, rj.ocr_provider,
               rj.ai_provider, rj.ai_processing_time_ms, rj.upload_date, rj.file_category,
               rj.created_at, rj.updated_at,
               COALESCE(rj.total_transactions_detected, 0) as total_transactions,
               COALESCE(rj.transactions_processed, 0) as processed_transactions,
               COALESCE(rj.transactions_approved, 0) as approved_transactions,
               -- File content metadata (not actual content)
               CASE WHEN rj.file_content IS NOT NULL THEN true ELSE false END as has_file_content,
               length(rj.file_content) as stored_file_size
        FROM receipt_jobs rj 
        WHERE rj.id = $1
    """
    return await execute_fetchrow(query, job_id)

async def get_receipt_file_content(job_id: str, user_id: str = None) -> Optional[Dict[str, Any]]:
    """Get receipt file content from database (use carefully - large data)"""
    if user_id:
        query = """
            SELECT id, filename, original_filename, file_type, mime_type, 
                   file_content, content_encoding, file_size, checksum
            FROM receipt_jobs 
            WHERE id = $1 AND user_id = $2
        """
        return await execute_fetchrow(query, job_id, user_id)
    else:
        query = """
            SELECT id, filename, original_filename, file_type, mime_type, 
                   file_content, content_encoding, file_size, checksum
            FROM receipt_jobs 
            WHERE id = $1
        """
        return await execute_fetchrow(query, job_id)

async def get_user_receipt_jobs(user_id: str, limit: int = 20) -> List[Dict[str, Any]]:
    """Get user's receipt jobs with transaction summaries (excludes file content for performance)"""
    query = """
        SELECT rj.id, rj.filename, rj.original_filename, rj.file_size, rj.file_type, 
               rj.status, rj.created_at, rj.updated_at, rj.error_message, rj.upload_date,
               rj.file_category, rj.checksum,
               COALESCE(rj.total_transactions_detected, 0) as total_transactions,
               COALESCE(rj.transactions_processed, 0) as processed_transactions,
               COALESCE(rj.transactions_approved, 0) as approved_transactions,
               CASE WHEN rj.file_content IS NOT NULL THEN true ELSE false END as has_file_content,
               length(rj.file_content) as stored_file_size
        FROM receipt_jobs rj 
        WHERE rj.user_id = $1 
        ORDER BY rj.created_at DESC 
        LIMIT $2
    """
    return await execute_query(query, user_id, limit)

# ==============================================================================
# FILE CONTENT MANAGEMENT FUNCTIONS
# ==============================================================================

async def get_receipt_files_summary(user_id: str) -> Dict[str, Any]:
    """Get summary of user's stored files"""
    query = """
        SELECT 
            COUNT(*) as total_files,
            SUM(file_size) as total_size_bytes,
            COUNT(CASE WHEN status = 'completed' THEN 1 END) as processed_files,
            COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_files,
            COUNT(CASE WHEN file_type IN ('.jpg', '.jpeg', '.png') THEN 1 END) as image_files,
            COUNT(CASE WHEN file_type = '.pdf' THEN 1 END) as pdf_files,
            COUNT(CASE WHEN file_type IN ('.xlsx', '.xls', '.csv') THEN 1 END) as data_files,
            MIN(created_at) as first_upload,
            MAX(created_at) as last_upload
        FROM receipt_jobs 
        WHERE user_id = $1
    """
    return await execute_fetchrow(query, user_id)

async def delete_receipt_job_and_content(job_id: str, user_id: str) -> bool:
    """Delete receipt job and all associated data (file content, transactions, logs)"""
    async with get_db_transaction() as conn:
        try:
            # Delete in proper order due to foreign key constraints
            await conn.execute("DELETE FROM receipt_processing_logs WHERE job_id = $1", job_id)
            await conn.execute("DELETE FROM receipt_transactions WHERE job_id = $1 AND user_id = $2", job_id, user_id)
            result = await conn.execute("DELETE FROM receipt_jobs WHERE id = $1 AND user_id = $2", job_id, user_id)
            
            return result.endswith(' 1')  # DELETE 1 means one row was deleted
            
        except Exception as e:
            logger.error("Failed to delete receipt job", job_id=job_id, error=str(e))
            raise

async def cleanup_old_files(retention_days: int = 90) -> int:
    """Clean up old receipt files based on retention policy"""
    query = """
        DELETE FROM receipt_jobs 
        WHERE created_at < NOW() - INTERVAL '%s days'
        AND status IN ('completed', 'failed', 'rejected')
    """
    
    result = await execute_command(query, retention_days)
    
    # Extract number of deleted rows
    if result.startswith('DELETE '):
        return int(result.split(' ')[1])
    return 0

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

async def update_receipt_job_ai_metadata(job_id: str, ai_provider: str = 'claude-3.5', 
                                       processing_time_ms: int = None) -> bool:
    """Update receipt job with AI processing metadata"""
    query = """
        UPDATE receipt_jobs 
        SET ai_provider = $2, ai_processing_time_ms = $3,
            status = 'completed', processing_completed_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
    """
    result = await execute_command(query, job_id, ai_provider, processing_time_ms)
    
    if result.startswith('UPDATE 1'):
        await log_processing_step(job_id, 'ai_processing', 'completed', 'AI processing completed')
        return True
    return False

# ==============================================================================
# TRANSACTION FUNCTIONS (New for Multi-Transaction Support)
# ==============================================================================

async def create_receipt_transactions(job_id: str, user_id: str, 
                                     transactions_data: List[Dict[str, Any]]) -> List[str]:
    """Create multiple transactions for a receipt job"""
    if not transactions_data:
        return []
    
    transaction_ids = []
    
    try:
        logger.info(f"DEBUG: Starting transaction creation for job {job_id}")
        
        async with get_db_transaction() as conn:
            for index, transaction_data in enumerate(transactions_data, 1):
                query = """
                    INSERT INTO receipt_transactions (
                        job_id, user_id, transaction_index, extracted_data, 
                        ai_confidence, raw_text_snippet, status
                    ) VALUES ($1, $2, $3, $4, $5, $6, 'pending')
                    RETURNING id
                """
                
                result = await conn.fetchrow(
                    query, job_id, user_id, index, 
                    json.dumps(transaction_data.get('extracted_data')),
                    transaction_data.get('confidence'),
                    transaction_data.get('raw_text_snippet')
                )
                
                if result:
                    transaction_id = str(result['id'])
                    transaction_ids.append(transaction_id)
                    logger.info(f"DEBUG: Created transaction {transaction_id}")
            
            # Update job transaction counts
            await conn.execute('SELECT update_job_transaction_counts($1)', job_id)
            logger.info(f"DEBUG: Successfully created {len(transaction_ids)} transactions")
        
        # Log AFTER transaction is committed
        for i, transaction_id in enumerate(transaction_ids, 1):
            await log_processing_step(
                job_id, 'transaction_extraction', 'completed',
                f'Transaction {i} extracted',
                transaction_id=transaction_id
            )
    
    except Exception as e:
        logger.error(f"DEBUG: Transaction creation failed: {str(e)}")
        raise
    
    return transaction_ids

async def get_job_transactions(job_id: str, user_id: str = None) -> List[Dict[str, Any]]:
    """Get all transactions for a job"""
    if user_id:
        query = """
            SELECT rt.*, c.name as suggested_category_name, c.color as suggested_category_color
            FROM receipt_transactions rt
            LEFT JOIN categories c ON rt.suggested_category_id = c.id
            WHERE rt.job_id = $1 AND rt.user_id = $2
            ORDER BY rt.transaction_index ASC
        """
        return await execute_query(query, job_id, user_id)
    else:
        query = """
            SELECT rt.*, c.name as suggested_category_name, c.color as suggested_category_color
            FROM receipt_transactions rt
            LEFT JOIN categories c ON rt.suggested_category_id = c.id
            WHERE rt.job_id = $1
            ORDER BY rt.transaction_index ASC
        """
        return await execute_query(query, job_id)

async def get_pending_transactions(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """Get user's pending transactions for approval"""
    query = """
        SELECT rt.*, rj.original_filename, rj.created_at as job_created_at,
               c.name as suggested_category_name, c.color as suggested_category_color
        FROM receipt_transactions rt
        JOIN receipt_jobs rj ON rt.job_id = rj.id
        LEFT JOIN categories c ON rt.suggested_category_id = c.id
        WHERE rt.user_id = $1 AND rt.status = 'pending'
        ORDER BY rt.created_at ASC
        LIMIT $2
    """
    return await execute_query(query, user_id, limit)

async def update_transaction_status(transaction_id: str, status: str, 
                                   rejection_reason: str = None) -> bool:
    """Update transaction status"""
    timestamp_field = 'user_approved_at' if status == 'approved' else 'user_rejected_at'
    
    if status == 'rejected' and rejection_reason:
        query = f"""
            UPDATE receipt_transactions 
            SET status = $2, rejection_reason = $3, {timestamp_field} = NOW(), updated_at = NOW()
            WHERE id = $1
        """
        result = await execute_command(query, transaction_id, status, rejection_reason)
    else:
        query = f"""
            UPDATE receipt_transactions 
            SET status = $2, {timestamp_field} = NOW(), updated_at = NOW()
            WHERE id = $1
        """
        result = await execute_command(query, transaction_id, status)
    
    if result.startswith('UPDATE 1'):
        # Get job_id to update counts
        job_query = "SELECT job_id FROM receipt_transactions WHERE id = $1"
        job_result = await execute_fetchrow(job_query, transaction_id)
        
        if job_result:
            async with get_db_transaction() as conn:
                await conn.execute('SELECT update_job_transaction_counts($1)', job_result['job_id'])
        
        return True
    return False

async def link_transaction_to_expense(transaction_id: str, expense_id: str) -> bool:
    """Link transaction to created expense"""
    query = """
        UPDATE receipt_transactions 
        SET expense_id = $2, status = 'expense_created', updated_at = NOW()
        WHERE id = $1
    """
    result = await execute_command(query, transaction_id, expense_id)
    
    if result.startswith('UPDATE 1'):
        await log_processing_step(
            None, 'expense_creation', 'completed', 
            'Expense created and linked',
            transaction_id=transaction_id
        )
        return True
    return False

# ==============================================================================
# LOGGING FUNCTIONS (Enhanced)
# ==============================================================================

async def log_processing_step(job_id: str, step: str, status: str, 
                             message: str = None, metadata: Dict[str, Any] = None,
                             processing_time_ms: int = None, 
                             error_details: Dict[str, Any] = None,
                             transaction_id: str = None) -> str:
    """Log a processing step"""
    import json
    
    query = """
        SELECT log_receipt_processing_step($1, $2, $3, $4, $5, $6, $7, $8)
    """
    
    result = await execute_fetchrow(
        query, job_id, step, status, message,
        json.dumps(metadata) if metadata else None,
        processing_time_ms,
        json.dumps(error_details) if error_details else None,
        transaction_id
    )
    
    return str(result['log_receipt_processing_step']) if result else None

async def get_job_processing_logs(job_id: str) -> List[Dict[str, Any]]:
    """Get all processing logs for a job"""
    query = """
        SELECT * FROM receipt_processing_logs 
        WHERE job_id = $1 
        ORDER BY created_at ASC
    """
    return await execute_query(query, job_id)

async def get_transaction_processing_logs(transaction_id: str) -> List[Dict[str, Any]]:
    """Get all processing logs for a transaction"""
    query = """
        SELECT * FROM receipt_processing_logs 
        WHERE transaction_id = $1 
        ORDER BY created_at ASC
    """
    return await execute_query(query, transaction_id)