"""
Receipt Processing API Routes - With Database Integration
Location: services/receipt-processor/src/api/routes/receipt.py
"""

import time
import hashlib
from typing import Optional
from fastapi import APIRouter, Request, HTTPException, status, Depends, UploadFile, File
from fastapi.responses import JSONResponse
import structlog

from ...middleware.auth import get_user_id, get_current_user
from ...config.settings import settings
from ...database.connection import (
    create_receipt_job, get_receipt_job, get_user_receipt_jobs,
    update_receipt_job_status, log_processing_step
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
    Upload receipt file for processing
    
    Accepts: images (jpg, jpeg, png), PDF, TXT, CSV, Excel files
    Supports: Up to 5 transactions per file
    Returns: processing job ID
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
        
        # Read and validate file
        file_content = await file.read()
        if len(file_content) > settings.MAX_FILE_SIZE:
            raise HTTPException(
                status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                detail=f"File too large. Maximum size: {settings.MAX_FILE_SIZE / (1024*1024):.1f}MB"
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
        
        # Generate file checksum for integrity
        checksum = hashlib.sha256(file_content).hexdigest()
        
        # Generate unique filename
        timestamp = int(time.time())
        unique_filename = f"receipt_{timestamp}_{checksum[:8]}{file_ext}"
        
        # Create database record
        job_id = await create_receipt_job(
            user_id=user_id,
            filename=unique_filename,
            original_filename=file.filename,
            file_size=len(file_content),
            file_type=file_ext,
            mime_type=file.content_type or f"application/{file_ext[1:]}",
            checksum=checksum
        )
        
        # TODO: Save file to storage and start processing (next steps)
        # For now, just log the successful upload
        
        logger.info("Receipt uploaded successfully", 
                   job_id=job_id,
                   user_id=user_id,
                   filename=file.filename,
                   file_size=len(file_content),
                   estimated_transactions=validation_result["estimated_transactions"])
        
        response_data = {
            "success": True,
            "job_id": job_id,
            "filename": file.filename,
            "file_size": len(file_content),
            "file_type": file_ext,
            "estimated_transactions": validation_result["estimated_transactions"],
            "status": "uploaded",
            "message": "Receipt uploaded successfully. Processing will begin shortly.",
            "processing_time_ms": (time.time() - start_time) * 1000
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
    Validate file content and estimate number of transactions
    
    Returns: {"valid": bool, "error": str, "estimated_transactions": int}
    """
    try:
        if file_ext in [".jpg", ".jpeg", ".png"]:
            # Image files - assume 1-2 transactions typically
            return {"valid": True, "error": None, "estimated_transactions": 1}
            
        elif file_ext == ".pdf":
            # PDF files - check page count and estimate transactions
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
            estimated = min(page_count * 2, 10)  # Cap at 10 for estimation
            return {"valid": True, "error": None, "estimated_transactions": estimated}
            
        elif file_ext == ".txt":
            # Text files - analyze content for potential transactions
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
                if any(symbol in line for symbol in ['

@router.get("/status/{job_id}", tags=["Receipt Processing"])
async def get_processing_status(
    request: Request,
    job_id: str,
    user_id: str = Depends(get_user_id)
):
    """
    Get processing status for a receipt job
    
    Returns current status and extracted data if completed
    """
    start_time = time.time()
    
    try:
        # Get job from database
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
        
        response_data = {
            "success": True,
            "job_id": job_id,
            "status": job_data["status"],
            "filename": job_data["original_filename"],
            "file_size": job_data["file_size"],
            "created_at": job_data["created_at"].timestamp() if job_data["created_at"] else None,
            "updated_at": job_data["updated_at"].timestamp() if job_data["updated_at"] else None,
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        # Add extracted data if available
        if job_data.get("extracted_data"):
            response_data["extracted_data"] = job_data["extracted_data"]
        
        # Add OCR text if available
        if job_data.get("ocr_text"):
            response_data["ocr_text"] = job_data["ocr_text"]
            response_data["ocr_confidence"] = job_data.get("ocr_confidence")
        
        # Add error details if failed
        if job_data.get("error_message"):
            response_data["error"] = job_data["error_message"]
        
        # Add expense link if approved
        if job_data.get("expense_id"):
            response_data["expense_id"] = job_data["expense_id"]
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Status check failed", error=str(e), job_id=job_id, user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get processing status: {str(e)}"
        )

@router.post("/approve/{job_id}", tags=["Receipt Processing"])
async def approve_and_create_expense(
    request: Request,
    job_id: str,
    user_id: str = Depends(get_user_id)
):
    """
    Approve extracted data and create expense
    
    Takes the AI-extracted receipt data and creates an expense record
    """
    start_time = time.time()
    
    try:
        # Get job from database
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
        
        # Check if processing completed
        if job_data["status"] != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve job with status: {job_data['status']}"
            )
        
        # Check if extracted data exists
        if not job_data.get("extracted_data"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No extracted data available for approval"
            )
        
        # TODO: Create expense record via expense service (next steps)
        # For now, just mark as approved
        await update_receipt_job_status(job_id, "approved")
        
        logger.info("Receipt approved", 
                   job_id=job_id,
                   user_id=user_id)
        
        response_data = {
            "success": True,
            "job_id": job_id,
            "status": "approved",
            "message": "Receipt approved successfully. Expense creation pending.",
            "extracted_data": job_data["extracted_data"],
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Approval failed", error=str(e), job_id=job_id, user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve receipt: {str(e)}"
        )

@router.get("/jobs", tags=["Receipt Processing"])
async def get_user_jobs(
    request: Request,
    limit: int = 20,
    user_id: str = Depends(get_user_id)
):
    """
    Get list of user's processing jobs
    
    Returns recent jobs with their status
    """
    start_time = time.time()
    
    try:
        # Get jobs from database
        jobs = await get_user_receipt_jobs(user_id, limit)
        
        # Convert timestamps to Unix timestamps for consistency
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
        ), '€', '£', '¥', 'USD', 'EUR']):
                    amount_lines += 1
                # Also check for decimal patterns like 12.34, 1,234.56
                import re
                if re.search(r'\d+[.,]\d{2}', line):
                    amount_lines += 1
            
            estimated = min(amount_lines, 10)  # Cap at 10 for estimation
            return {"valid": True, "error": None, "estimated_transactions": estimated}
            
        elif file_ext in [".xlsx", ".xls"]:
            # Excel files - check row count and data patterns
            import pandas as pd
            import io
            
            try:
                df = pd.read_excel(io.BytesIO(file_content))
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
                
                # Estimate based on rows with data
                non_empty_rows = df.dropna().shape[0]
                estimated = min(non_empty_rows, 8)  # Cap at 8 for Excel
                return {"valid": True, "error": None, "estimated_transactions": estimated}
                
            except Exception as e:
                return {"valid": False, "error": f"Cannot read Excel file: {str(e)}", "estimated_transactions": 0}
            
        elif file_ext == ".csv":
            # CSV files - similar to Excel
            import pandas as pd
            import io
            
            try:
                df = pd.read_csv(io.BytesIO(file_content))
                row_count = len(df)
                
                if row_count > settings.MAX_EXCEL_ROWS:
                    return {
                        "valid": False,
                        "error": f"CSV file has {row_count} rows. Maximum: {settings.MAX_EXCEL_ROWS} rows",
                        "estimated_transactions": 0
                    }
                
                # Count rows with numeric data (potential transactions)
                numeric_rows = 0
                for _, row in df.iterrows():
                    if any(pd.api.types.is_numeric_dtype(type(val)) and pd.notna(val) and val > 0 for val in row):
                        numeric_rows += 1
                
                estimated = min(numeric_rows, 6)  # Cap at 6 for CSV
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
    Get processing status for a receipt job
    
    Returns current status and extracted data if completed
    """
    start_time = time.time()
    
    try:
        # Get job from database
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
        
        response_data = {
            "success": True,
            "job_id": job_id,
            "status": job_data["status"],
            "filename": job_data["original_filename"],
            "file_size": job_data["file_size"],
            "created_at": job_data["created_at"].timestamp() if job_data["created_at"] else None,
            "updated_at": job_data["updated_at"].timestamp() if job_data["updated_at"] else None,
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        # Add extracted data if available
        if job_data.get("extracted_data"):
            response_data["extracted_data"] = job_data["extracted_data"]
        
        # Add OCR text if available
        if job_data.get("ocr_text"):
            response_data["ocr_text"] = job_data["ocr_text"]
            response_data["ocr_confidence"] = job_data.get("ocr_confidence")
        
        # Add error details if failed
        if job_data.get("error_message"):
            response_data["error"] = job_data["error_message"]
        
        # Add expense link if approved
        if job_data.get("expense_id"):
            response_data["expense_id"] = job_data["expense_id"]
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Status check failed", error=str(e), job_id=job_id, user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get processing status: {str(e)}"
        )

@router.post("/approve/{job_id}", tags=["Receipt Processing"])
async def approve_and_create_expense(
    request: Request,
    job_id: str,
    user_id: str = Depends(get_user_id)
):
    """
    Approve extracted data and create expense
    
    Takes the AI-extracted receipt data and creates an expense record
    """
    start_time = time.time()
    
    try:
        # Get job from database
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
        
        # Check if processing completed
        if job_data["status"] != "completed":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cannot approve job with status: {job_data['status']}"
            )
        
        # Check if extracted data exists
        if not job_data.get("extracted_data"):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="No extracted data available for approval"
            )
        
        # TODO: Create expense record via expense service (next steps)
        # For now, just mark as approved
        await update_receipt_job_status(job_id, "approved")
        
        logger.info("Receipt approved", 
                   job_id=job_id,
                   user_id=user_id)
        
        response_data = {
            "success": True,
            "job_id": job_id,
            "status": "approved",
            "message": "Receipt approved successfully. Expense creation pending.",
            "extracted_data": job_data["extracted_data"],
            "processing_time_ms": (time.time() - start_time) * 1000
        }
        
        return response_data
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error("Approval failed", error=str(e), job_id=job_id, user_id=user_id)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to approve receipt: {str(e)}"
        )

@router.get("/jobs", tags=["Receipt Processing"])
async def get_user_jobs(
    request: Request,
    limit: int = 20,
    user_id: str = Depends(get_user_id)
):
    """
    Get list of user's processing jobs
    
    Returns recent jobs with their status
    """
    start_time = time.time()
    
    try:
        # Get jobs from database
        jobs = await get_user_receipt_jobs(user_id, limit)
        
        # Convert timestamps to Unix timestamps for consistency
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