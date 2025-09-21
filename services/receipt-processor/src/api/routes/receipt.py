"""
Enhanced Receipt Processing API Routes - With Actual File Storage
Location: services/receipt-processor/src/api/routes/receipt.py
"""

import time
import hashlib
import os
import aiofiles
from pathlib import Path
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, status, Depends, UploadFile, File
from fastapi.responses import JSONResponse
import structlog

from ...middleware.auth import get_user_id, get_current_user
from ...config.settings import settings
from ...database.connection import (
    create_receipt_job, get_receipt_job, get_user_receipt_jobs,
    update_receipt_job_status, log_processing_step, get_job_transactions,
    get_pending_transactions, update_transaction_status
)

logger = structlog.get_logger(__name__)
router = APIRouter()

@router.post("/upload", tags=["Receipt Processing"])
async def upload_receipt(
    request: Request,
    file: UploadFile = File(...),
    user_id: str = Depends(get_user_id)
):
    """
    Upload receipt file for processing - Database storage with complete referencing
    
    Accepts: images (jpg, jpeg, png), PDF, TXT, CSV, Excel files
    Supports: Up to 5 transactions per file
    Stores: Complete file content in database for future reference
    Returns: processing job ID with complete file reference
    """
    start_time = time.time()
    
    try:
        # Validate file type
        if not file.filename:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No file provided"
            )
        
        # Check file extension
        file_ext = "." + file.filename.split(".")[-1].lower()
        if file_ext not in settings.ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type {file_ext} not allowed. Supported: {settings.ALLOWED_EXTENSIONS}"
            )
        
        # Read and validate file content
        file_content = await file.read()
        file_size = len(file_content)
        
        # Check file size with type-specific limits
        size_limit = settings.get_file_size_limit(file_ext)
        if file_size > size_limit:
            size_limit_mb = size_limit / (1024 * 1024)
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large for {file_ext} files. Maximum size: {size_limit_mb:.1f}MB"
            )
        
        # Validate file content and estimate transaction count
        validation_result = await validate_file_content(file_content, file_ext, file.filename)
        
        if not validation_result["valid"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=validation_result["error"]
            )
        
        if validation_result["estimated_transactions"] > settings.MAX_TRANSACTIONS_PER_FILE:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File appears to contain {validation_result['estimated_transactions']} transactions. "
                       f"Maximum allowed: {settings.MAX_TRANSACTIONS_PER_FILE} transactions per file."
            )
        
        # Generate file integrity data
        checksum = hashlib.sha256(file_content).hexdigest()
        timestamp = int(time.time())
        
        # Generate organized filename for database storage
        storage_filename = f"{timestamp}_{checksum[:8]}_{file.filename}"
        
        # Save file content directly to database
        try:
            job_id = await create_receipt_job(
                user_id=user_id,
                filename=storage_filename,
                original_filename=file.filename,
                file_size=file_size,
                file_type=file_ext,
                mime_type=file.content_type or f"application/{file_ext[1:]}",
                file_content=file_content,  # Binary content stored in database
                checksum=checksum
            )
            
            logger.info("Receipt uploaded and stored in database successfully", 
                       job_id=job_id,
                       user_id=user_id,
                       original_filename=file.filename,
                       stored_filename=storage_filename,
                       file_size=file_size,
                       checksum=checksum)
            
        except Exception as e:
            logger.error("Database storage failed", error=str(e), user_id=user_id)
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to store file in database: {str(e)}"
            )
        
        # Log successful upload and storage
        await log_processing_step(
            job_id, 'database_storage', 'completed', 
            'File content saved to database successfully',
            metadata={
                "file_size": file_size,
                "checksum": checksum,
                "estimated_transactions": validation_result["estimated_transactions"],
                "mime_type": file.content_type,
                "storage_method": "database_bytea"
            }
        )
        
        processing_time_ms = (time.time() - start_time) * 1000
        
        response_data = {
            "success": True,
            "job_id": job_id,
            
            # Complete file reference
            "file_reference": {
                "original_filename": file.filename,
                "stored_filename": storage_filename,
                "file_size": file_size,
                "file_type": file_ext,
                "mime_type": file.content_type,
                "checksum": checksum,
                "storage_method": "database",
                "estimated_transactions": validation_result["estimated_transactions"]
            },
            
            # Processing status
            "status": "uploaded",
            "message": "Receipt uploaded and stored in database successfully. Ready for processing.",
            "processing_time_ms": processing_time_ms,
            
            # Next steps information
            "workflow": {
                "next_steps": [
                    "OCR text extraction will begin",
                    "AI processing will extract transactions", 
                    "User approval workflow will start"
                ],
                "sequential_approval": settings.ENABLE_SEQUENTIAL_APPROVAL,
                "max_transactions": settings.MAX_TRANSACTIONS_PER_FILE
            }
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Receipt upload failed", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to upload receipt: {str(e)}"
        )


async def validate_file_content(file_content: bytes, file_ext: str, filename: str) -> dict:
    """
    Enhanced file content validation with transaction estimation
    
    Returns: {"valid": bool, "error": str, "estimated_transactions": int}
    """
    try:
        if file_ext in [".jpg", ".jpeg", ".png", ".webp", ".bmp", ".tiff", ".gif"]:
            # Image files - basic validation
            try:
                from PIL import Image
                import io
                
                # Verify image can be opened
                img = Image.open(io.BytesIO(file_content))
                width, height = img.size
                
                # Basic size validation
                if width < 50 or height < 50:
                    return {"valid": False, "error": "Image too small (minimum 50x50 pixels)", "estimated_transactions": 0}
                
                if width > 10000 or height > 10000:
                    return {"valid": False, "error": "Image too large (maximum 10000x10000 pixels)", "estimated_transactions": 0}
                
                # Estimate: typically 1-2 transactions per receipt image
                return {"valid": True, "error": None, "estimated_transactions": 1}
                
            except Exception as e:
                return {"valid": False, "error": f"Invalid image file: {str(e)}", "estimated_transactions": 0}
            
        elif file_ext == ".pdf":
            # PDF files - check page count and estimate transactions
            try:
                import PyPDF2
                import io
                
                pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_content))
                page_count = len(pdf_reader.pages)
                
                if page_count > settings.MAX_PDF_PAGES:
                    return {
                        "valid": False,
                        "error": f"PDF has {page_count} pages. Maximum allowed: {settings.MAX_PDF_PAGES} pages",
                        "estimated_transactions": 0
                    }
                
                # Estimate: typically 1-2 transactions per page for receipts
                estimated = min(page_count * 2, settings.MAX_TRANSACTIONS_PER_FILE)
                return {"valid": True, "error": None, "estimated_transactions": estimated}
                
            except Exception as e:
                return {"valid": False, "error": f"Invalid PDF file: {str(e)}", "estimated_transactions": 0}
            
        elif file_ext == ".txt":
            # Text files - analyze content for potential transactions
            try:
                text_content = file_content.decode('utf-8', errors='ignore')
                
                if len(text_content) > settings.MAX_TEXT_LENGTH:
                    return {
                        "valid": False,
                        "error": f"Text file too long. Maximum: {settings.MAX_TEXT_LENGTH} characters",
                        "estimated_transactions": 0
                    }
                
                # Simple heuristic: count lines with currency symbols or amounts
                lines = text_content.split('\n')
                amount_lines = 0
                for line in lines:
                    if any(symbol in line for symbol in ['$', '€', '£', '¥', 'USD', 'EUR']):
                        amount_lines += 1
                    # Also check for decimal patterns like 12.34, 1,234.56
                    import re
                    if re.search(r'\d+[.,]\d{2}', line):
                        amount_lines += 1
                
                estimated = min(amount_lines, settings.MAX_TRANSACTIONS_PER_FILE)
                return {"valid": True, "error": None, "estimated_transactions": estimated}
                
            except Exception as e:
                return {"valid": False, "error": f"Cannot read text file: {str(e)}", "estimated_transactions": 0}
            
        elif file_ext in [".xlsx", ".xls"]:
            # Excel files - check row count and data patterns
            try:
                import pandas as pd
                import io
                
                df = pd.read_excel(io.BytesIO(file_content), nrows=settings.MAX_EXCEL_ROWS + 1)
                row_count = len(df)
                
                if row_count > settings.MAX_EXCEL_ROWS:
                    return {
                        "valid": False,
                        "error": f"Excel file has {row_count} rows. Maximum: {settings.MAX_EXCEL_ROWS} rows",
                        "estimated_transactions": 0
                    }
                
                # Look for amount columns or currency data
                amount_columns = 0
                for col in df.columns:
                    col_str = str(col).lower()
                    if any(word in col_str for word in ['amount', 'price', 'cost', 'total', 'sum']):
                        amount_columns += 1
                
                # Estimate based on rows with numeric data
                numeric_rows = 0
                for _, row in df.iterrows():
                    if any(pd.api.types.is_numeric_dtype(type(val)) and pd.notna(val) and val != 0 for val in row):
                        numeric_rows += 1
                
                estimated = min(numeric_rows, settings.MAX_TRANSACTIONS_PER_FILE)
                return {"valid": True, "error": None, "estimated_transactions": estimated}
                
            except Exception as e:
                return {"valid": False, "error": f"Cannot read Excel file: {str(e)}", "estimated_transactions": 0}
            
        elif file_ext == ".csv":
            # CSV files - similar to Excel
            try:
                import pandas as pd
                import io
                
                df = pd.read_csv(io.BytesIO(file_content), nrows=settings.MAX_CSV_ROWS + 1)
                row_count = len(df)
                
                if row_count > settings.MAX_CSV_ROWS:
                    return {
                        "valid": False,
                        "error": f"CSV file has {row_count} rows. Maximum: {settings.MAX_CSV_ROWS} rows",
                        "estimated_transactions": 0
                    }
                
                # Count rows with numeric data (potential transactions)
                numeric_rows = 0
                for _, row in df.iterrows():
                    if any(pd.api.types.is_numeric_dtype(type(val)) and pd.notna(val) and val > 0 for val in row):
                        numeric_rows += 1
                
                estimated = min(numeric_rows, settings.MAX_TRANSACTIONS_PER_FILE)
                return {"valid": True, "error": None, "estimated_transactions": estimated}
                
            except Exception as e:
                return {"valid": False, "error": f"Cannot read CSV file: {str(e)}", "estimated_transactions": 0}
        
        else:
            return {"valid": False, "error": f"Unsupported file type: {file_ext}", "estimated_transactions": 0}
            
    except Exception as e:
        return {"valid": False, "error": f"File validation failed: {str(e)}", "estimated_transactions": 0}


@router.get("/status/{job_id}", tags=["Receipt Processing"])
async def get_processing_status(
    request: Request,
    job_id: str,
    user_id: str = Depends(get_user_id)
):
    """
    Get processing status for a receipt job - Database storage with complete referencing
    
    Returns current status, file details stored in database, and transaction information
    """
    start_time = time.time()
    
    try:
        # Get job from database with enhanced details
        job_data = await get_receipt_job(job_id)
        
        if not job_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Processing job not found"
            )
        
        # Verify user owns this job
        if job_data["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Get transactions for this job
        transactions = await get_job_transactions(job_id, user_id)
        
        response_data = {
            "success": True,
            "job_id": job_id,
            "status": job_data["status"],
            
            # Complete file reference from database
            "file_details": {
                "original_filename": job_data["original_filename"],
                "stored_filename": job_data["filename"],
                "file_size": job_data["file_size"],
                "stored_file_size": job_data.get("stored_file_size", job_data["file_size"]),
                "file_type": job_data["file_type"],
                "mime_type": job_data["mime_type"],
                "checksum": job_data["checksum"],
                "has_file_content": job_data.get("has_file_content", False),
                "storage_method": "database",
                "upload_date": job_data.get("upload_date"),
                "file_category": job_data.get("file_category", "receipt")
            },
            
            # Processing information
            "processing": {
                "created_at": job_data["created_at"].timestamp() if job_data["created_at"] else None,
                "updated_at": job_data["updated_at"].timestamp() if job_data["updated_at"] else None,
                "processing_started_at": job_data["processing_started_at"].timestamp() if job_data.get("processing_started_at") else None,
                "processing_completed_at": job_data["processing_completed_at"].timestamp() if job_data.get("processing_completed_at") else None,
                "ai_provider": job_data.get("ai_provider"),
                "ai_processing_time_ms": job_data.get("ai_processing_time_ms"),
                "retry_count": job_data.get("retry_count", 0)
            },
            
            # Transaction summary
            "transactions": {
                "total_detected": job_data.get("total_transactions", 0),
                "processed": job_data.get("processed_transactions", 0),
                "approved": job_data.get("approved_transactions", 0),
                "pending": job_data.get("total_transactions", 0) - job_data.get("processed_transactions", 0),
                "details": transactions
            },
            
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        # Add OCR results if available
        if job_data.get("ocr_text"):
            response_data["ocr"] = {
                "text_length": len(job_data["ocr_text"]),
                "confidence": job_data.get("ocr_confidence"),
                "provider": job_data.get("ocr_provider", "easyocr")
            }
        
        # Add error details if failed
        if job_data.get("error_message"):
            response_data["error"] = job_data["error_message"]
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Status check failed", error=str(e), job_id=job_id, user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get processing status: {str(e)}"
        )


@router.get("/download/{job_id}", tags=["Receipt Processing"])
async def download_receipt_file(
    request: Request,
    job_id: str,
    user_id: str = Depends(get_user_id)
):
    """
    Download original receipt file from database storage
    
    Returns the original file content with proper headers
    """
    try:
        # Get file content from database
        from ...database.connection import get_receipt_file_content
        file_data = await get_receipt_file_content(job_id, user_id)
        
        if not file_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="File not found or access denied"
            )
        
        # Return file with proper headers
        from fastapi.responses import Response
        
        return Response(
            content=file_data["file_content"],
            media_type=file_data["mime_type"],
            headers={
                "Content-Disposition": f"attachment; filename=\"{file_data['original_filename']}\"",
                "Content-Length": str(len(file_data["file_content"])),
                "X-File-Checksum": file_data.get("checksum", ""),
                "X-Storage-Method": "database"
            }
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("File download failed", error=str(e), job_id=job_id, user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to download file: {str(e)}"
        )


@router.get("/transactions/pending", tags=["Receipt Processing"])
async def get_pending_user_transactions(
    request: Request,
    limit: int = 10,
    user_id: str = Depends(get_user_id)
):
    """
    Get user's pending transactions for approval - Sequential workflow support
    
    Returns transactions ready for user approval in chronological order
    """
    start_time = time.time()
    
    try:
        # Get pending transactions for user
        transactions = await get_pending_transactions(user_id, limit)
        
        response_data = {
            "success": True,
            "pending_transactions": transactions,
            "total": len(transactions),
            "sequential_approval": settings.ENABLE_SEQUENTIAL_APPROVAL,
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        if transactions and settings.ENABLE_SEQUENTIAL_APPROVAL:
            response_data["next_transaction"] = transactions[0]  # First transaction to approve
            response_data["message"] = "Sequential approval enabled. Please review the first transaction."
        
        return response_data
        
    except Exception as e:
        logger.error("Get pending transactions failed", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get pending transactions: {str(e)}"
        )


@router.post("/transactions/{transaction_id}/approve", tags=["Receipt Processing"])
async def approve_transaction(
    request: Request,
    transaction_id: str,
    user_id: str = Depends(get_user_id)
):
    """
    Approve a specific transaction - Enhanced for sequential workflow
    
    Approves transaction and prepares for expense creation
    """
    start_time = time.time()
    
    try:
        # Update transaction status to approved
        success = await update_transaction_status(transaction_id, "approved")
        
        if not success:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Transaction not found or already processed"
            )
        
        logger.info("Transaction approved", 
                   transaction_id=transaction_id,
                   user_id=user_id)
        
        response_data = {
            "success": True,
            "transaction_id": transaction_id,
            "status": "approved",
            "message": "Transaction approved successfully. Ready for expense creation.",
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        # If sequential approval, get next pending transaction
        if settings.ENABLE_SEQUENTIAL_APPROVAL:
            next_transactions = await get_pending_transactions(user_id, 1)
            if next_transactions:
                response_data["next_transaction"] = next_transactions[0]
                response_data["message"] += f" Next transaction ready for review."
            else:
                response_data["message"] += " All transactions processed."
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Transaction approval failed", error=str(e), transaction_id=transaction_id, user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve transaction: {str(e)}"
        )


@router.get("/jobs", tags=["Receipt Processing"])
async def get_user_jobs(
    request: Request,
    limit: int = 20,
    user_id: str = Depends(get_user_id)
):
    """
    Get list of user's processing jobs - Enhanced with complete references
    
    Returns recent jobs with their status and file details
    """
    start_time = time.time()
    
    try:
        # Get jobs from database with enhanced details
        jobs = await get_user_receipt_jobs(user_id, limit)
        
        # Convert timestamps and enhance data
        for job in jobs:
            if job.get("created_at"):
                job["created_at"] = job["created_at"].timestamp()
            if job.get("updated_at"):
                job["updated_at"] = job["updated_at"].timestamp()
        
        response_data = {
            "success": True,
            "jobs": jobs,
            "total": len(jobs),
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        return response_data
        
    except Exception as e:
        logger.error("Get jobs failed", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get jobs: {str(e)}"
        )


@router.post("/process/{job_id}", tags=["Receipt Processing"])
async def process_receipt(
    request: Request,
    job_id: str,
    user_id: str = Depends(get_user_id)
):
    """
    Trigger processing pipeline for an uploaded receipt
    
    Processes: OCR → AI → Multi-Transaction Extraction
    """
    start_time = time.time()
    
    try:
        # Import processing pipeline
        from ...services.processing_pipeline import processing_pipeline
        
        # Verify job exists and belongs to user
        job_data = await get_receipt_job(job_id)
        if not job_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Job not found"
            )
        
        if job_data["user_id"] != user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied"
            )
        
        # Check if job is in correct status
        if job_data["status"] not in ["uploaded", "failed"]:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot process job with status: {job_data['status']}"
            )
        
        # Trigger processing pipeline
        result = await processing_pipeline.process_receipt_job(job_id, user_id)
        
        processing_time_ms = (time.time() - start_time) * 1000
        
        if result["success"]:
            response_data = {
                "success": True,
                "job_id": job_id,
                "status": "completed",
                "message": "Receipt processed successfully",
                "processing_summary": {
                    "transactions_extracted": result.get("transactions_created", 0),
                    "text_extraction_time_ms": result.get("processing_time_ms", 0) - result.get("ai_processing_time_ms", 0),
                    "ai_processing_time_ms": result.get("ai_processing_time_ms", 0),
                    "total_processing_time_ms": processing_time_ms,
                    "ai_confidence": result.get("ai_confidence"),
                    "provider": result.get("provider", "claude-3.5")
                },
                "next_steps": [
                    "Review extracted transactions",
                    "Approve individual transactions",
                    "Create expenses from approved transactions"
                ]
            }
            
            if settings.ENABLE_SEQUENTIAL_APPROVAL:
                # Get first pending transaction for approval
                pending_transactions = await get_pending_transactions(user_id, 1)
                if pending_transactions:
                    response_data["next_transaction"] = pending_transactions[0]
                    response_data["message"] += " First transaction ready for review."
            
            return response_data
        else:
            return {
                "success": False,
                "job_id": job_id,
                "status": "failed",
                "error": result.get("error"),
                "processing_time_ms": processing_time_ms
            }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Processing trigger failed", error=str(e), job_id=job_id, user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process receipt: {str(e)}"
        )


@router.post("/process/batch", tags=["Receipt Processing"])
async def process_batch_receipts(
    request: Request,
    limit: int = 10,
    user_id: str = Depends(get_user_id)
):
    """
    Process multiple pending receipts in batch
    
    Useful for background processing or admin operations
    """
    start_time = time.time()
    
    try:
        # Import processing pipeline
        from ...services.processing_pipeline import processing_pipeline
        
        # Get user's pending jobs only
        from ...database.connection import execute_query
        query = """
            SELECT id FROM receipt_jobs 
            WHERE user_id = $1 AND status = 'uploaded'
            ORDER BY created_at ASC 
            LIMIT $2
        """
        user_pending_jobs = await execute_query(query, user_id, limit)
        
        if not user_pending_jobs:
            return {
                "success": True,
                "message": "No pending jobs to process",
                "processed": 0,
                "processing_time_ms": (time.time() - start_time) * 1000
            }
        
        # Process jobs
        results = []
        for job in user_pending_jobs:
            result = await processing_pipeline.process_receipt_job(job["id"], user_id)
            results.append({
                "job_id": job["id"],
                "success": result["success"],
                "transactions_created": result.get("transactions_created", 0),
                "error": result.get("error")
            })
        
        successful = len([r for r in results if r["success"]])
        total_transactions = sum(r.get("transactions_created", 0) for r in results)
        
        processing_time_ms = (time.time() - start_time) * 1000
        
        return {
            "success": True,
            "processed": len(results),
            "successful": successful,
            "failed": len(results) - successful,
            "total_transactions_extracted": total_transactions,
            "processing_time_ms": processing_time_ms,
            "details": results
        }
        
    except Exception as e:
        logger.error("Batch processing failed", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process batch: {str(e)}"
        )


@router.get("/file-summary", tags=["Receipt Processing"])
async def get_file_storage_summary(
    request: Request,
    user_id: str = Depends(get_user_id)
):
    """
    Get summary of user's stored files and processing statistics
    
    Returns storage usage, file counts, and processing metrics
    """
    try:
        from ...database.connection import get_receipt_files_summary
        
        summary = await get_receipt_files_summary(user_id)
        
        if not summary:
            return {
                "success": True,
                "storage_summary": {
                    "total_files": 0,
                    "total_size_bytes": 0,
                    "total_size_mb": 0,
                    "processed_files": 0,
                    "failed_files": 0,
                    "file_types": {}
                }
            }
        
        # Convert to MB and add type breakdown
        total_size_mb = round((summary.get("total_size_bytes", 0) or 0) / (1024 * 1024), 2)
        
        response_data = {
            "success": True,
            "storage_summary": {
                "total_files": summary.get("total_files", 0),
                "total_size_bytes": summary.get("total_size_bytes", 0),
                "total_size_mb": total_size_mb,
                "processed_files": summary.get("processed_files", 0),
                "failed_files": summary.get("failed_files", 0),
                "file_types": {
                    "images": summary.get("image_files", 0),
                    "pdfs": summary.get("pdf_files", 0),
                    "data_files": summary.get("data_files", 0)
                },
                "date_range": {
                    "first_upload": summary.get("first_upload").isoformat() if summary.get("first_upload") else None,
                    "last_upload": summary.get("last_upload").isoformat() if summary.get("last_upload") else None
                }
            },
            "storage_limits": {
                "max_file_size_mb": settings.MAX_FILE_SIZE_MB,
                "retention_days": settings.STORAGE_RETENTION_DAYS,
                "storage_method": "database"
            }
        }
        
        return response_data
        
    except Exception as e:
        logger.error("File summary failed", error=str(e), user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get file summary: {str(e)}"
        )