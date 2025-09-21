"""
Receipt Processing Pipeline Orchestrator - Complete Workflow Management
Location: services/receipt-processor/src/services/processing_pipeline.py

RESPONSIBILITY: Orchestrate the complete processing workflow
- File retrieval from database
- Text extraction (OCR for images/PDFs, direct for documents)
- AI processing for multi-transaction extraction
- Database updates and transaction creation
"""

import asyncio
import time
import tempfile
import os
from typing import Dict, List, Any, Optional
from pathlib import Path
import structlog

from ..config.settings import settings
from ..database.connection import (
    get_receipt_file_content, update_receipt_job_status, 
    update_receipt_job_ocr, update_receipt_job_ai_metadata,
    create_receipt_transactions, log_processing_step
)
from .image_processor import ImageProcessor
from .pdf_processor import PDFProcessor
from .document_processor import DocumentProcessor
from .ai_processor import AIProcessor

logger = structlog.get_logger(__name__)

class ProcessingPipeline:
    """Complete receipt processing pipeline orchestrator"""
    
    def __init__(self):
        self.image_processor = ImageProcessor()
        self.pdf_processor = PDFProcessor()
        self.document_processor = DocumentProcessor()
        self.ai_processor = AIProcessor()
        
    async def process_receipt_job(self, job_id: str, user_id: str) -> Dict[str, Any]:
        """
        Complete processing pipeline for a receipt job
        
        Pipeline: Database File → Text Extraction → AI Processing → Transactions
        """
        start_time = time.time()
        temp_file_path = None
        
        try:
            logger.info("🚀 Starting receipt processing pipeline", 
                       job_id=job_id, user_id=user_id)
            
            # Step 1: Update job status to processing
            await update_receipt_job_status(job_id, "processing")
            await log_processing_step(job_id, 'pipeline_start', 'started', 'Processing pipeline initiated')
            
            # Step 2: Retrieve file content from database
            file_data = await get_receipt_file_content(job_id, user_id)
            if not file_data:
                raise ValueError("File not found in database")
            
            logger.info("📁 File retrieved from database", 
                       job_id=job_id,
                       file_type=file_data["file_type"],
                       file_size=len(file_data["file_content"]))
            
            # Step 3: Create temporary file for processing
            temp_file_path = await self._create_temp_file(file_data)
            
            # Step 4: Extract text based on file type
            text_extraction_result = await self._extract_text_from_file(
                job_id, temp_file_path, file_data
            )
            
            if not text_extraction_result["success"]:
                await update_receipt_job_status(job_id, "failed", text_extraction_result["error"])
                return {"success": False, "error": text_extraction_result["error"]}
            
            # Step 5: Update job with OCR results
            await update_receipt_job_ocr(
                job_id, 
                text_extraction_result["text"], 
                text_extraction_result.get("confidence", 0.8)
            )
            
            logger.info("✅ Text extraction completed", 
                       job_id=job_id,
                       text_length=len(text_extraction_result["text"]),
                       confidence=text_extraction_result.get("confidence"))
            
            # Step 6: AI processing for transaction extraction
            ai_start_time = time.time()
            ai_result = await self.ai_processor.extract_transactions_from_text(
                job_id, text_extraction_result["text"], file_data["original_filename"]
            )
            
            ai_processing_time = int((time.time() - ai_start_time) * 1000)
            
            if not ai_result["success"]:
                await update_receipt_job_status(job_id, "failed", ai_result["error"])
                return {"success": False, "error": ai_result["error"]}
            
            # Step 7: Create transaction records in database
            transactions_data = []
            for i, transaction in enumerate(ai_result["transactions"]):
                transactions_data.append({
                    "extracted_data": transaction,
                    "confidence": ai_result.get("confidence", 0.8),
                    "raw_text_snippet": transaction.get("raw_text_snippet", "")
                })
            
            transaction_ids = await create_receipt_transactions(job_id, user_id, transactions_data)
            
            # Step 8: Update job with AI metadata and completion
            await update_receipt_job_ai_metadata(
                job_id, 
                ai_provider=ai_result.get("provider", "claude-3.5"),
                processing_time_ms=ai_processing_time
            )
            
            total_processing_time = int((time.time() - start_time) * 1000)
            
            logger.info("🎉 Receipt processing pipeline completed successfully", 
                       job_id=job_id,
                       transactions_created=len(transaction_ids),
                       total_processing_time_ms=total_processing_time)
            
            await log_processing_step(
                job_id, 'pipeline_complete', 'completed', 
                f'Pipeline completed successfully. {len(transaction_ids)} transactions extracted.',
                metadata={
                    "transactions_created": len(transaction_ids),
                    "ai_processing_time_ms": ai_processing_time,
                    "total_processing_time_ms": total_processing_time,
                    "text_extraction_method": text_extraction_result.get("method"),
                    "ai_provider": ai_result.get("provider")
                }
            )
            
            return {
                "success": True,
                "job_id": job_id,
                "transactions_created": len(transaction_ids),
                "transaction_ids": transaction_ids,
                "processing_time_ms": total_processing_time,
                "ai_processing_time_ms": ai_processing_time,
                "text_length": len(text_extraction_result["text"]),
                "ai_confidence": ai_result.get("confidence"),
                "provider": ai_result.get("provider")
            }
            
        except Exception as e:
            error_msg = f"Processing pipeline failed: {str(e)}"
            logger.error("❌ Processing pipeline failed", 
                        job_id=job_id, error=str(e))
            
            await update_receipt_job_status(job_id, "failed", error_msg)
            await log_processing_step(
                job_id, 'pipeline_error', 'failed', error_msg,
                error_details={"exception": str(e), "exception_type": type(e).__name__}
            )
            
            return {
                "success": False,
                "error": error_msg,
                "processing_time_ms": int((time.time() - start_time) * 1000)
            }
            
        finally:
            # Cleanup temporary file
            if temp_file_path and Path(temp_file_path).exists():
                try:
                    Path(temp_file_path).unlink()
                    logger.debug("🧹 Temporary file cleaned up", temp_file=temp_file_path)
                except Exception as e:
                    logger.warning("Failed to cleanup temp file", temp_file=temp_file_path, error=str(e))
    
    async def _create_temp_file(self, file_data: Dict[str, Any]) -> str:
        """Create temporary file from database content"""
        try:
            # Create temp file with proper extension
            file_ext = file_data["file_type"]
            suffix = file_ext if file_ext.startswith('.') else f'.{file_ext}'
            
            with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as temp_file:
                temp_file.write(file_data["file_content"])
                temp_file_path = temp_file.name
            
            logger.debug("📁 Temporary file created", 
                        temp_file=temp_file_path, 
                        size=len(file_data["file_content"]))
            
            return temp_file_path
            
        except Exception as e:
            raise RuntimeError(f"Failed to create temporary file: {str(e)}")
    
    async def _extract_text_from_file(self, job_id: str, file_path: str, 
                                    file_data: Dict[str, Any]) -> Dict[str, Any]:
        """Extract text from file using appropriate processor"""
        file_type = file_data["file_type"].lower()
        filename = file_data["original_filename"]
        
        try:
            if file_type in ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.tiff', '.gif']:
                # Image files - use OCR
                logger.info("🖼️ Processing image file with OCR", job_id=job_id, file_type=file_type)
                result = await self.image_processor.extract_text_from_image(job_id, file_path, filename)
                result["method"] = "image_ocr"
                return result
                
            elif file_type == '.pdf':
                # PDF files - text extraction + OCR fallback
                logger.info("📄 Processing PDF file", job_id=job_id)
                result = await self.pdf_processor.extract_text_from_pdf(job_id, file_path, filename)
                result["method"] = "pdf_extraction"
                return result
                
            elif file_type in ['.xlsx', '.xls', '.csv', '.txt', '.json', '.xml']:
                # Document files - direct text extraction
                logger.info("📋 Processing document file", job_id=job_id, file_type=file_type)
                result = await self.document_processor.extract_text_from_document(job_id, file_path, filename)
                result["method"] = "document_extraction"
                return result
                
            else:
                return {
                    "success": False,
                    "error": f"Unsupported file type for text extraction: {file_type}"
                }
                
        except Exception as e:
            logger.error("Text extraction failed", job_id=job_id, error=str(e))
            return {
                "success": False,
                "error": f"Text extraction failed: {str(e)}"
            }
    
    async def process_pending_jobs(self, limit: int = 10) -> List[Dict[str, Any]]:
        """Process multiple pending jobs (for background processing)"""
        try:
            from ..database.connection import execute_query
            
            # Get pending jobs
            query = """
                SELECT id, user_id, original_filename 
                FROM receipt_jobs 
                WHERE status = 'uploaded' 
                ORDER BY created_at ASC 
                LIMIT $1
            """
            
            pending_jobs = await execute_query(query, limit)
            
            if not pending_jobs:
                logger.info("No pending jobs to process")
                return []
            
            logger.info(f"🔄 Processing {len(pending_jobs)} pending jobs")
            
            # Process jobs concurrently (with limit)
            semaphore = asyncio.Semaphore(settings.CONCURRENT_PROCESSING_LIMIT)
            
            async def process_single_job(job):
                async with semaphore:
                    return await self.process_receipt_job(job["id"], job["user_id"])
            
            # Process all jobs
            results = await asyncio.gather(
                *[process_single_job(job) for job in pending_jobs],
                return_exceptions=True
            )
            
            # Combine results
            processed_results = []
            for i, result in enumerate(results):
                job = pending_jobs[i]
                if isinstance(result, Exception):
                    processed_results.append({
                        "job_id": job["id"],
                        "success": False,
                        "error": str(result)
                    })
                else:
                    processed_results.append(result)
            
            successful = len([r for r in processed_results if r.get("success")])
            logger.info(f"✅ Batch processing completed: {successful}/{len(processed_results)} successful")
            
            return processed_results
            
        except Exception as e:
            logger.error("Batch processing failed", error=str(e))
            return []
    
    async def reprocess_failed_job(self, job_id: str, user_id: str) -> Dict[str, Any]:
        """Retry processing for a failed job"""
        try:
            logger.info("🔄 Retrying failed job", job_id=job_id)
            
            # Reset job status
            await update_receipt_job_status(job_id, "uploaded")
            await log_processing_step(job_id, 'retry', 'started', 'Retrying failed job')
            
            # Reprocess
            return await self.process_receipt_job(job_id, user_id)
            
        except Exception as e:
            logger.error("Retry processing failed", job_id=job_id, error=str(e))
            return {"success": False, "error": f"Retry failed: {str(e)}"}


# Create global pipeline instance
processing_pipeline = ProcessingPipeline()