"""
Image Processing Module - Pure Text Extraction
Location: services/receipt-processor/src/services/image_processor.py

FOCUSED RESPONSIBILITY: Clean text extraction from images ONLY
- Image preprocessing for optimal OCR
- EasyOCR text extraction 
- NO content interpretation or language assumptions
- Works for ANY image content in ANY language
- AI processor handles ALL text understanding
"""

import asyncio
import time
from typing import Dict, List, Tuple, Optional
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageOps
import easyocr
import structlog

from ..config.settings import settings

logger = structlog.get_logger(__name__)

class ImageProcessor:
    """Pure text extractor from image files - content agnostic"""
    
    def __init__(self):
        self.ocr_reader = None
        self.supported_formats = {'.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.webp', '.gif'}
        self._initialize_ocr()
    
    def _initialize_ocr(self):
        """Initialize EasyOCR reader for general text extraction"""
        try:
            logger.info("🖼️ Initializing EasyOCR for text extraction", 
                       languages=settings.OCR_LANGUAGES)
            
            self.ocr_reader = easyocr.Reader(
                settings.OCR_LANGUAGES,
                gpu=False,  # CPU for Docker compatibility
                verbose=False,
                model_storage_directory='./models',
                download_enabled=True
            )
            
            logger.info("✅ Image OCR reader initialized successfully")
            
        except Exception as e:
            logger.error("❌ Failed to initialize image OCR reader", error=str(e))
            raise

    async def extract_text_from_image(self, job_id: str, file_path: str, filename: str) -> Dict[str, any]:
        """
        Extract clean text from image files - NO content interpretation
        
        Args:
            job_id: Processing job ID
            file_path: Path to image file
            filename: Original filename
            
        Returns:
            Dict with clean extracted text only
        """
        start_time = time.time()
        
        try:
            logger.info("🖼️ Starting image text extraction", 
                       job_id=job_id,
                       filename=filename)
            
            # Validate image file
            validation_result = self._validate_image_file(file_path)
            if not validation_result["valid"]:
                return {
                    "success": False,
                    "error": validation_result["error"]
                }
            
            # Load and preprocess image for optimal OCR
            processed_image = await self._preprocess_for_ocr(file_path)
            if processed_image is None:
                return {
                    "success": False,
                    "error": "Failed to load or process image"
                }
            
            # Extract text using OCR
            ocr_results = await self._extract_with_easyocr(processed_image)
            
            # Convert OCR results to clean text
            extracted_text = self._ocr_results_to_text(ocr_results)
            confidence = self._calculate_ocr_confidence(ocr_results)
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            logger.info("✅ Image text extraction completed", 
                       job_id=job_id,
                       text_length=len(extracted_text),
                       confidence=confidence,
                       processing_time_ms=processing_time_ms)
            
            return {
                "success": True,
                "text": extracted_text,
                "confidence": confidence,
                "method": "easyocr",
                "processing_time_ms": processing_time_ms,
                "image_dimensions": validation_result.get("dimensions")
            }
            
        except Exception as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            error_msg = f"Image text extraction failed: {str(e)}"
            
            logger.error("❌ Image text extraction failed", 
                        job_id=job_id,
                        error=str(e),
                        processing_time_ms=processing_time_ms)
            
            return {
                "success": False,
                "error": error_msg,
                "processing_time_ms": processing_time_ms
            }

    def _validate_image_file(self, file_path: str) -> Dict[str, any]:
        """Validate image file without content assumptions"""
        try:
            if not Path(file_path).exists():
                return {"valid": False, "error": "Image file not found"}
            
            # Check file size
            file_size = Path(file_path).stat().st_size
            if file_size > settings.MAX_FILE_SIZE_BYTES:
                return {"valid": False, "error": "Image file too large"}
            
            # Validate with PIL
            with Image.open(file_path) as img:
                width, height = img.size
                format_name = img.format
                mode = img.mode
                
                # Basic dimension checks
                if width < 50 or height < 50:
                    return {"valid": False, "error": "Image too small (minimum 50x50 pixels)"}
                
                if width > 15000 or height > 15000:
                    return {"valid": False, "error": "Image too large (maximum 15000x15000 pixels)"}
                
                # Test if image is readable
                try:
                    img.verify()
                except:
                    return {"valid": False, "error": "Image file appears to be corrupted"}
            
            return {
                "valid": True,
                "dimensions": {"width": width, "height": height},
                "format": format_name,
                "mode": mode,
                "file_size": file_size
            }
            
        except Exception as e:
            return {"valid": False, "error": f"Image validation failed: {str(e)}"}

    async def _preprocess_for_ocr(self, file_path: str) -> Optional[np.ndarray]:
        """
        Preprocess image for optimal OCR - content agnostic
        Applies general image enhancement techniques
        """
        try:
            # Load image with PIL (better format support)
            pil_image = Image.open(file_path)
            
            # Convert to RGB if needed
            if pil_image.mode in ('RGBA', 'LA', 'P'):
                pil_image = pil_image.convert('RGB')
            
            # Auto-rotate based on EXIF data
            pil_image = ImageOps.exif_transpose(pil_image)
            
            # Convert to OpenCV format
            opencv_image = cv2.cvtColor(np.array(pil_image), cv2.COLOR_RGB2BGR)
            
            # Apply general OCR preprocessing
            processed = await self._apply_ocr_preprocessing(opencv_image)
            
            return processed
            
        except Exception as e:
            logger.error("Image preprocessing failed", error=str(e))
            return None

    async def _apply_ocr_preprocessing(self, image: np.ndarray) -> np.ndarray:
        """Apply general image preprocessing for OCR optimization"""
        try:
            # Convert to grayscale
            if len(image.shape) == 3:
                gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            else:
                gray = image
            
            # Resize if too large (for processing efficiency)
            height, width = gray.shape
            if width > 3000:
                scale = 3000 / width
                new_width = int(width * scale)
                new_height = int(height * scale)
                gray = cv2.resize(gray, (new_width, new_height), interpolation=cv2.INTER_AREA)
            
            # Noise reduction
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Enhance contrast using CLAHE
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
            enhanced = clahe.apply(denoised)
            
            # Apply adaptive thresholding
            thresh = cv2.adaptiveThreshold(
                enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 11, 2
            )
            
            # Morphological operations to clean up
            kernel = np.ones((1, 1), np.uint8)
            cleaned = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            # Final median blur to reduce noise
            final = cv2.medianBlur(cleaned, 3)
            
            return final
            
        except Exception as e:
            logger.warning("Image preprocessing failed, using grayscale", error=str(e))
            # Fallback to simple grayscale
            if len(image.shape) == 3:
                return cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
            return image

    async def _extract_with_easyocr(self, image: np.ndarray) -> List[Tuple]:
        """Extract text using EasyOCR with general settings"""
        try:
            # Convert to RGB for EasyOCR
            if len(image.shape) == 2:  # Grayscale
                image_rgb = cv2.cvtColor(image, cv2.COLOR_GRAY2RGB)
            else:
                image_rgb = cv2.cvtColor(image, cv2.COLOR_BGR2RGB)
            
            # Run OCR in thread pool
            loop = asyncio.get_event_loop()
            ocr_results = await loop.run_in_executor(
                None, 
                self._run_easyocr,
                image_rgb
            )
            
            return ocr_results
            
        except Exception as e:
            logger.error("EasyOCR extraction failed", error=str(e))
            return []

    def _run_easyocr(self, image_rgb: np.ndarray) -> List[Tuple]:
        """Run EasyOCR with balanced settings for general text"""
        try:
            results = self.ocr_reader.readtext(
                image_rgb,
                detail=1,  # Include bounding boxes and confidence
                paragraph=True,  # Group text into paragraphs
                width_ths=0.7,  # Paragraph width threshold
                height_ths=0.7,  # Paragraph height threshold
                slope_ths=0.1,  # Text slope threshold
                ycenter_ths=0.7,  # Y-center threshold for line grouping
                # General OCR settings
                text_threshold=0.7,  # Text confidence threshold
                low_text=0.4,  # Low text threshold
                link_threshold=0.4,  # Link threshold
                canvas_size=2560,  # Processing canvas size
                mag_ratio=1.5  # Magnification ratio
            )
            
            return results
            
        except Exception as e:
            logger.error("EasyOCR processing failed", error=str(e))
            return []

    def _ocr_results_to_text(self, ocr_results: List[Tuple]) -> str:
        """Convert OCR results to clean text - NO content processing"""
        try:
            if not ocr_results:
                return ""
            
            text_blocks = []
            
            # Sort results by position (top to bottom, left to right)
            sorted_results = self._sort_by_position(ocr_results)
            
            for result in sorted_results:
                if len(result) >= 2:
                    text = result[1].strip()
                    if text:  # Include all text, no filtering
                        text_blocks.append(text)
            
            # Join with newlines to preserve reading order
            full_text = '\n'.join(text_blocks)
            
            # Basic cleanup only - remove excessive whitespace
            cleaned_text = self._basic_cleanup_only(full_text)
            
            return cleaned_text
            
        except Exception as e:
            logger.error("OCR result processing failed", error=str(e))
            return ""

    def _sort_by_position(self, ocr_results: List[Tuple]) -> List[Tuple]:
        """Sort text blocks by reading order (top to bottom, left to right)"""
        try:
            # Sort by y-coordinate first (top to bottom), then x-coordinate (left to right)
            sorted_results = sorted(ocr_results, key=lambda x: (x[0][0][1], x[0][0][0]))
            return sorted_results
        except:
            # Fallback to original order if sorting fails
            return ocr_results

    def _basic_cleanup_only(self, text: str) -> str:
        """Basic text cleanup - remove excessive whitespace only"""
        if not text:
            return ""
        
        # Remove excessive whitespace but preserve structure
        lines = text.split('\n')
        cleaned_lines = []
        
        for line in lines:
            # Basic whitespace cleanup
            cleaned_line = ' '.join(line.split())
            if cleaned_line:  # Only add non-empty lines
                cleaned_lines.append(cleaned_line)
        
        # Join lines and reduce excessive newlines
        final_text = '\n'.join(cleaned_lines)
        
        # Reduce multiple newlines to max 2
        import re
        final_text = re.sub(r'\n{3,}', '\n\n', final_text)
        
        return final_text.strip()

    def _calculate_ocr_confidence(self, ocr_results: List[Tuple]) -> float:
        """Calculate OCR confidence without content assumptions"""
        try:
            if not ocr_results:
                return 0.0
            
            confidences = []
            
            for result in ocr_results:
                if len(result) >= 3:  # Has confidence score
                    confidence = result[2]
                    text = result[1]
                    
                    if isinstance(confidence, (int, float)) and text.strip():
                        confidences.append(confidence)
            
            if not confidences:
                return 0.5  # Default confidence
            
            # Simple average confidence
            avg_confidence = sum(confidences) / len(confidences)
            return max(min(avg_confidence, 1.0), 0.0)  # Clamp between 0 and 1
            
        except Exception as e:
            logger.warning("Confidence calculation failed", error=str(e))
            return 0.5

    def is_supported_format(self, file_extension: str) -> bool:
        """Check if file format is supported"""
        return file_extension.lower() in self.supported_formats

    async def get_image_info(self, file_path: str) -> Dict[str, any]:
        """Get basic image information"""
        try:
            with Image.open(file_path) as img:
                return {
                    "width": img.width,
                    "height": img.height,
                    "format": img.format,
                    "mode": img.mode,
                    "has_transparency": img.mode in ('RGBA', 'LA') or 'transparency' in img.info,
                    "dpi": img.info.get('dpi', (72, 72))
                }
        except Exception as e:
            logger.error("Failed to get image info", error=str(e))
            return {"error": str(e)}