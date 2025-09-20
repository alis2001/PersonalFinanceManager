"""
PDF Processing Module - Pure Text Extraction
Location: services/receipt-processor/src/services/pdf_processor.py

FOCUSED RESPONSIBILITY: Clean text extraction from PDFs ONLY
- Text-based PDF extraction
- Image-based PDF OCR processing
- NO content interpretation or assumptions
- Works for ANY PDF content in ANY language
- AI processor handles ALL text understanding
"""

import asyncio
import time
from typing import Dict, List, Optional, Any
from pathlib import Path
import tempfile
import os

import PyPDF2
import pdfplumber
import fitz  # PyMuPDF
from PIL import Image
import structlog

from ..config.settings import settings
from .image_processor import ImageProcessor

logger = structlog.get_logger(__name__)

class PDFProcessor:
    """Pure text extractor from PDF files - content agnostic"""
    
    def __init__(self):
        self.image_processor = ImageProcessor()
        self.supported_formats = {'.pdf'}
        self.max_pages = 20  # Reasonable limit for processing
    
    async def extract_text_from_pdf(self, job_id: str, file_path: str, filename: str) -> Dict[str, any]:
        """
        Extract clean text from PDF files - NO content interpretation
        
        Args:
            job_id: Processing job ID
            file_path: Path to PDF file
            filename: Original filename
            
        Returns:
            Dict with clean extracted text only
        """
        start_time = time.time()
        
        try:
            logger.info("📄 Starting PDF text extraction", 
                       job_id=job_id,
                       filename=filename)
            
            # Validate PDF file
            validation_result = self._validate_pdf_file(file_path)
            if not validation_result["valid"]:
                return {
                    "success": False,
                    "error": validation_result["error"]
                }
            
            # Try multiple extraction methods
            extraction_result = await self._extract_with_best_method(file_path, job_id)
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            if extraction_result["success"]:
                logger.info("✅ PDF text extraction completed", 
                           job_id=job_id,
                           method=extraction_result["method"],
                           text_length=len(extraction_result["text"]),
                           confidence=extraction_result["confidence"],
                           processing_time_ms=processing_time_ms)
            
            extraction_result["processing_time_ms"] = processing_time_ms
            extraction_result["pdf_info"] = validation_result.get("info", {})
            
            return extraction_result
            
        except Exception as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            error_msg = f"PDF text extraction failed: {str(e)}"
            
            logger.error("❌ PDF text extraction failed", 
                        job_id=job_id,
                        error=str(e),
                        processing_time_ms=processing_time_ms)
            
            return {
                "success": False,
                "error": error_msg,
                "processing_time_ms": processing_time_ms
            }

    def _validate_pdf_file(self, file_path: str) -> Dict[str, any]:
        """Validate PDF file without content assumptions"""
        try:
            if not Path(file_path).exists():
                return {"valid": False, "error": "PDF file not found"}
            
            # Check file size
            file_size = Path(file_path).stat().st_size
            if file_size > settings.MAX_FILE_SIZE_BYTES:
                return {"valid": False, "error": f"PDF file too large: {file_size} bytes"}
            
            # Basic PDF validation
            try:
                with open(file_path, 'rb') as file:
                    pdf_reader = PyPDF2.PdfReader(file)
                    
                    # Check if encrypted
                    if pdf_reader.is_encrypted:
                        return {"valid": False, "error": "PDF is password protected"}
                    
                    # Check page count
                    num_pages = len(pdf_reader.pages)
                    if num_pages == 0:
                        return {"valid": False, "error": "PDF has no pages"}
                    
                    if num_pages > self.max_pages:
                        return {"valid": False, "error": f"PDF has too many pages ({num_pages}). Maximum: {self.max_pages}"}
                    
                    # Get basic metadata
                    metadata = {}
                    if pdf_reader.metadata:
                        metadata = {
                            'title': str(pdf_reader.metadata.get('/Title', '')),
                            'author': str(pdf_reader.metadata.get('/Author', '')),
                            'creator': str(pdf_reader.metadata.get('/Creator', '')),
                            'producer': str(pdf_reader.metadata.get('/Producer', ''))
                        }
                    
                    return {
                        "valid": True,
                        "info": {
                            "num_pages": num_pages,
                            "file_size": file_size,
                            "metadata": metadata,
                            "is_encrypted": False
                        }
                    }
                    
            except PyPDF2.errors.PdfReadError as e:
                return {"valid": False, "error": f"Invalid PDF file: {str(e)}"}
            
        except Exception as e:
            return {"valid": False, "error": f"PDF validation failed: {str(e)}"}

    async def _extract_with_best_method(self, file_path: str, job_id: str) -> Dict[str, any]:
        """Try multiple extraction methods and return the best result"""
        
        methods = [
            ("pdfplumber", self._extract_with_pdfplumber),
            ("pymupdf", self._extract_with_pymupdf),
            ("pypdf2", self._extract_with_pypdf2)
        ]
        
        best_result = None
        best_score = 0
        
        # Try text-based extraction methods
        for method_name, method_func in methods:
            try:
                result = await method_func(file_path)
                if result["success"]:
                    text_length = len(result["text"].strip())
                    
                    # Simple scoring based on text length
                    score = text_length
                    
                    if score > best_score:
                        best_score = score
                        best_result = result
                        best_result["method"] = method_name
                        
            except Exception as e:
                logger.debug(f"{method_name} extraction failed", error=str(e))
                continue
        
        # If text extraction found meaningful content, return it
        if best_result and best_score > 20:  # Minimum meaningful text length
            return best_result
        
        # Fallback to OCR for image-based PDFs
        logger.info("Text extraction yielded minimal results, trying OCR", job_id=job_id)
        ocr_result = await self._extract_with_ocr(file_path, job_id)
        ocr_result["method"] = "ocr_fallback"
        return ocr_result

    async def _extract_with_pdfplumber(self, file_path: str) -> Dict[str, any]:
        """Extract text using pdfplumber"""
        try:
            with pdfplumber.open(file_path) as pdf:
                text_parts = []
                
                for page_num, page in enumerate(pdf.pages):
                    # Extract text
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        text_parts.append(page_text.strip())
                    
                    # Extract tables if present
                    tables = page.extract_tables()
                    if tables:
                        for table in tables:
                            table_text = self._format_table_data(table)
                            if table_text:
                                text_parts.append(table_text)
                
                if text_parts:
                    extracted_text = '\n\n'.join(text_parts)
                    cleaned_text = self._basic_text_cleanup(extracted_text)
                    
                    return {
                        "success": True,
                        "text": cleaned_text,
                        "confidence": 0.95
                    }
                else:
                    return {
                        "success": False,
                        "error": "No text found with pdfplumber"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": f"pdfplumber extraction failed: {str(e)}"
            }

    async def _extract_with_pymupdf(self, file_path: str) -> Dict[str, any]:
        """Extract text using PyMuPDF (fitz)"""
        try:
            doc = fitz.open(file_path)
            text_parts = []
            
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                page_text = page.get_text()
                
                if page_text and page_text.strip():
                    text_parts.append(page_text.strip())
            
            doc.close()
            
            if text_parts:
                extracted_text = '\n\n'.join(text_parts)
                cleaned_text = self._basic_text_cleanup(extracted_text)
                
                return {
                    "success": True,
                    "text": cleaned_text,
                    "confidence": 0.92
                }
            else:
                return {
                    "success": False,
                    "error": "No text found with PyMuPDF"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"PyMuPDF extraction failed: {str(e)}"
            }

    async def _extract_with_pypdf2(self, file_path: str) -> Dict[str, any]:
        """Extract text using PyPDF2"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                text_parts = []
                
                for page_num, page in enumerate(pdf_reader.pages):
                    page_text = page.extract_text()
                    if page_text and page_text.strip():
                        text_parts.append(page_text.strip())
                
                if text_parts:
                    extracted_text = '\n\n'.join(text_parts)
                    cleaned_text = self._basic_text_cleanup(extracted_text)
                    
                    return {
                        "success": True,
                        "text": cleaned_text,
                        "confidence": 0.90
                    }
                else:
                    return {
                        "success": False,
                        "error": "No text found with PyPDF2"
                    }
                    
        except Exception as e:
            return {
                "success": False,
                "error": f"PyPDF2 extraction failed: {str(e)}"
            }

    async def _extract_with_ocr(self, file_path: str, job_id: str) -> Dict[str, any]:
        """Extract text using OCR for image-based PDFs"""
        try:
            doc = fitz.open(file_path)
            all_text = []
            total_confidence = 0.0
            pages_processed = 0
            
            with tempfile.TemporaryDirectory() as temp_dir:
                for page_num in range(min(len(doc), 10)):  # Limit to 10 pages
                    page = doc.load_page(page_num)
                    
                    # Convert page to image
                    mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better OCR
                    pix = page.get_pixmap(matrix=mat)
                    img_data = pix.tobytes("png")
                    
                    # Save temporary image
                    temp_image_path = Path(temp_dir) / f"page_{page_num}.png"
                    with open(temp_image_path, "wb") as f:
                        f.write(img_data)
                    
                    # Run OCR on the image
                    ocr_result = await self.image_processor.extract_text_from_image(
                        job_id, str(temp_image_path), f"page_{page_num}.png"
                    )
                    
                    if ocr_result["success"]:
                        page_text = ocr_result["text"]
                        if page_text.strip():
                            all_text.append(page_text.strip())
                            total_confidence += ocr_result["confidence"]
                            pages_processed += 1
            
            doc.close()
            
            if all_text:
                extracted_text = '\n\n'.join(all_text)
                avg_confidence = total_confidence / pages_processed if pages_processed > 0 else 0.0
                
                return {
                    "success": True,
                    "text": extracted_text,
                    "confidence": avg_confidence,
                    "pages_processed": pages_processed
                }
            else:
                return {
                    "success": False,
                    "error": "OCR found no text in PDF"
                }
                
        except Exception as e:
            return {
                "success": False,
                "error": f"OCR extraction failed: {str(e)}"
            }

    def _format_table_data(self, table: List[List[str]]) -> str:
        """Format table data as clean text"""
        try:
            if not table:
                return ""
            
            formatted_rows = []
            for row in table:
                if row:
                    # Clean row data
                    clean_row = [str(cell).strip() if cell else "" for cell in row]
                    if any(clean_row):  # Only add non-empty rows
                        formatted_rows.append(" | ".join(clean_row))
            
            return "\n".join(formatted_rows)
            
        except Exception as e:
            logger.warning("Table formatting failed", error=str(e))
            return ""

    def _basic_text_cleanup(self, text: str) -> str:
        """Basic text cleanup - remove excessive whitespace only"""
        if not text:
            return ""
        
        # Split into lines and clean each line
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Remove extra whitespace
            cleaned_line = ' '.join(line.split())
            if cleaned_line:  # Only add non-empty lines
                cleaned_lines.append(cleaned_line)
        
        # Join lines back
        cleaned_text = '\n'.join(cleaned_lines)
        
        # Remove excessive consecutive newlines
        import re
        cleaned_text = re.sub(r'\n{3,}', '\n\n', cleaned_text)
        
        return cleaned_text.strip()

    def is_supported_format(self, file_extension: str) -> bool:
        """Check if file format is supported"""
        return file_extension.lower() in self.supported_formats

    async def get_pdf_info(self, file_path: str) -> Dict[str, any]:
        """Get basic PDF information"""
        try:
            info = {"pages": []}
            
            # Get document-level info
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                info["num_pages"] = len(pdf_reader.pages)
                info["is_encrypted"] = pdf_reader.is_encrypted
                
                if pdf_reader.metadata:
                    info["metadata"] = {
                        'title': str(pdf_reader.metadata.get('/Title', '')),
                        'author': str(pdf_reader.metadata.get('/Author', '')),
                        'creator': str(pdf_reader.metadata.get('/Creator', '')),
                        'producer': str(pdf_reader.metadata.get('/Producer', ''))
                    }
            
            # Get page-level info with PyMuPDF
            doc = fitz.open(file_path)
            for page_num in range(len(doc)):
                page = doc.load_page(page_num)
                page_info = {
                    "page_number": page_num + 1,
                    "rotation": page.rotation,
                    "has_images": len(page.get_images()) > 0,
                    "has_text": bool(page.get_text().strip())
                }
                info["pages"].append(page_info)
            
            doc.close()
            return info
            
        except Exception as e:
            logger.error("Failed to get PDF info", error=str(e))
            return {"error": str(e)}