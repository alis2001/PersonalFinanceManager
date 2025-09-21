"""
AI Processing Module - Claude 3.5 Text Understanding & Structuring
Location: services/receipt-processor/src/services/ai_processor.py

FOCUSED RESPONSIBILITY: Text understanding and transaction extraction
- Claude 3.5 Sonnet integration for text interpretation
- Multi-language support for any extracted text
- Transaction data structuring and validation
- Confidence scoring and fallback handling
- NO text extraction - only text understanding
"""

import asyncio
import time
import json
import re
from typing import Dict, List, Optional, Any, Union
from decimal import Decimal, InvalidOperation
from datetime import datetime, date
import anthropic
import structlog

from ..config.settings import settings
from ..database.connection import log_processing_step

logger = structlog.get_logger(__name__)

class AIProcessor:
    """AI-powered text understanding and transaction extraction"""
    
    def __init__(self):
        self.anthropic_client = None
        self.fallback_available = False
        self._initialize_ai_clients()
    
    def _initialize_ai_clients(self):
        """Initialize AI clients with fallback options"""
        try:
            # Primary: Claude 3.5 Sonnet
            if settings.ANTHROPIC_API_KEY:
                self.anthropic_client = anthropic.Anthropic(
                    api_key=settings.ANTHROPIC_API_KEY
                )
                logger.info("✅ Claude 3.5 Sonnet client initialized")
            else:
                logger.warning("⚠️ No Anthropic API key provided")
            
            # TODO: Add fallback clients (OpenAI, Groq, etc.) if configured
            if settings.OPENAI_API_KEY or settings.GROQ_API_KEY:
                self.fallback_available = True
                logger.info("✅ Fallback AI clients available")
            
        except Exception as e:
            logger.error("❌ Failed to initialize AI clients", error=str(e))
            raise

    async def process_extracted_text(self, job_id: str, extracted_text: str, 
                                   extraction_confidence: float = 0.0,
                                   extraction_method: str = "unknown") -> Dict[str, Any]:
        """
        Process extracted text to understand and structure transaction data
        
        Args:
            job_id: Processing job ID
            extracted_text: Clean text from extraction modules
            extraction_confidence: Confidence from text extraction
            extraction_method: Method used for text extraction
            
        Returns:
            Dict with structured transaction data
        """
        start_time = time.time()
        
        try:
            logger.info("🤖 Starting AI text processing", 
                       job_id=job_id,
                       text_length=len(extracted_text),
                       extraction_method=extraction_method)
            
            await log_processing_step(job_id, 'ai_processing', 'started', 
                                    'Starting AI text interpretation')
            
            # Pre-validate text
            if not self._is_text_processable(extracted_text):
                return {
                    "success": False,
                    "error": "Extracted text is too short or contains no meaningful content",
                    "processing_time_ms": int((time.time() - start_time) * 1000)
                }
            
            # Process with Claude 3.5 (primary method)
            if self.anthropic_client:
                result = await self._process_with_claude(job_id, extracted_text)
            else:
                return {
                    "success": False,
                    "error": "No AI processing client available",
                    "processing_time_ms": int((time.time() - start_time) * 1000)
                }
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            if result["success"]:
                # Validate and structure the extracted transactions
                validation_result = await self._validate_and_structure_transactions(
                    job_id, result["transactions"], extraction_confidence
                )
                
                result.update(validation_result)
                
                await log_processing_step(
                    job_id, 'ai_processing', 'completed',
                    f'Successfully processed {len(result["transactions"])} transactions',
                    processing_time_ms=processing_time_ms
                )
                
                logger.info("✅ AI text processing completed", 
                           job_id=job_id,
                           transactions_found=len(result["transactions"]),
                           overall_confidence=result.get("overall_confidence", 0.0),
                           processing_time_ms=processing_time_ms)
            else:
                await log_processing_step(
                    job_id, 'ai_processing', 'failed',
                    result.get("error", "AI processing failed"),
                    processing_time_ms=processing_time_ms
                )
            
            result["processing_time_ms"] = processing_time_ms
            result["extraction_method"] = extraction_method
            return result
            
        except Exception as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            error_msg = f"AI processing failed: {str(e)}"
            
            await log_processing_step(
                job_id, 'ai_processing', 'failed',
                error_msg,
                processing_time_ms=processing_time_ms,
                error_details={"error": str(e), "error_type": type(e).__name__}
            )
            
            logger.error("❌ AI text processing failed", 
                        job_id=job_id,
                        error=str(e),
                        processing_time_ms=processing_time_ms)
            
            return {
                "success": False,
                "error": error_msg,
                "processing_time_ms": processing_time_ms
            }

    def _is_text_processable(self, text: str) -> bool:
        """Check if text contains enough content to process"""
        if not text or len(text.strip()) < 10:
            return False
        
        # Check for reasonable word count
        words = text.split()
        if len(words) < 3:
            return False
        
        return True

    async def _process_with_claude(self, job_id: str, text: str) -> Dict[str, Any]:
        """Process text with Claude 3.5 Sonnet"""
        try:
            # Create the prompt for transaction extraction
            prompt = self._create_extraction_prompt(text)
            
            # Call Claude API
            response = await asyncio.get_event_loop().run_in_executor(
                None,
                self._call_claude_api,
                prompt
            )
            
            # Parse Claude's response
            parsed_result = self._parse_claude_response(response)
            
            return parsed_result
            
        except Exception as e:
            logger.error("Claude processing failed", job_id=job_id, error=str(e))
            
            # Try fallback if available
            if self.fallback_available:
                logger.info("Attempting fallback AI processing", job_id=job_id)
                return await self._process_with_fallback(job_id, text)
            
            return {
                "success": False,
                "error": f"Claude processing failed: {str(e)}"
            }

    def _create_extraction_prompt(self, text: str) -> str:
        """Create optimized prompt for Claude 3.5 transaction extraction"""
        
        prompt = f"""
You are an expert at extracting financial transaction data from various types of documents. 

TASK: Analyze the following text and extract up to 5 individual transactions. The text might be from:
- Receipts (shopping, restaurant, service)
- Bank statements or transaction lists
- Invoices or bills
- Expense reports
- Any financial document in any language

TEXT TO ANALYZE:
{text}

INSTRUCTIONS:
1. Extract each separate transaction/purchase/expense you can identify
2. For each transaction, determine:
   - Merchant/vendor name
   - Transaction amount (convert to USD if needed)
   - Date (estimate if not clear)
   - Description/what was purchased
   - Category suggestion (food, transport, shopping, etc.)

3. IMPORTANT RULES:
   - Maximum 5 transactions per document
   - If amounts are unclear, make reasonable estimates
   - If dates are unclear, use today's date: {datetime.now().strftime('%Y-%m-%d')}
   - If merchant unclear, use "Unknown Merchant"
   - Handle any language or currency format
   - Be conservative but helpful

4. RESPONSE FORMAT (JSON only):
{{
    "success": true,
    "transactions": [
        {{
            "merchant_name": "Store Name",
            "amount": 25.99,
            "currency": "USD",
            "transaction_date": "2024-12-20",
            "description": "Coffee and pastry",
            "category_suggestion": "Food & Dining",
            "confidence": 0.85,
            "raw_text_snippet": "relevant text from document"
        }}
    ],
    "document_language": "English",
    "document_type": "receipt",
    "total_amount": 25.99,
    "processing_notes": "Clear receipt with itemized purchases"
}}

If no valid transactions found:
{{
    "success": false,
    "error": "No financial transactions found in the text",
    "document_language": "detected language",
    "processing_notes": "explanation of what was found instead"
}}

Extract transactions now:
"""
        return prompt

    def _call_claude_api(self, prompt: str) -> str:
        """Call Claude API synchronously (runs in executor)"""
        try:
            message = self.anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=settings.CLAUDE_MAX_TOKENS,
                temperature=settings.CLAUDE_TEMPERATURE,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            return message.content[0].text
            
        except Exception as e:
            logger.error("Claude API call failed", error=str(e))
            raise

    def _parse_claude_response(self, response: str) -> Dict[str, Any]:
        """Parse Claude's JSON response"""
        try:
            # Extract JSON from response (handle markdown code blocks)
            json_text = self._extract_json_from_response(response)
            
            # Parse JSON
            data = json.loads(json_text)
            
            # Validate response structure
            if not isinstance(data, dict):
                raise ValueError("Response is not a valid JSON object")
            
            # Check for success/failure
            if not data.get("success", False):
                return {
                    "success": False,
                    "error": data.get("error", "Claude found no transactions"),
                    "processing_notes": data.get("processing_notes", "")
                }
            
            # Validate transactions
            transactions = data.get("transactions", [])
            if not transactions:
                return {
                    "success": False,
                    "error": "No transactions extracted by Claude"
                }
            
            # Clean and validate each transaction
            cleaned_transactions = []
            for transaction in transactions:
                cleaned_transaction = self._clean_transaction_data(transaction)
                if cleaned_transaction:
                    cleaned_transactions.append(cleaned_transaction)
            
            if not cleaned_transactions:
                return {
                    "success": False,
                    "error": "No valid transactions after cleaning"
                }
            
            return {
                "success": True,
                "transactions": cleaned_transactions,
                "document_language": data.get("document_language", "Unknown"),
                "document_type": data.get("document_type", "Unknown"),
                "processing_notes": data.get("processing_notes", ""),
                "claude_confidence": self._calculate_claude_confidence(data, cleaned_transactions)
            }
            
        except json.JSONDecodeError as e:
            logger.error("Failed to parse Claude JSON response", error=str(e))
            return {
                "success": False,
                "error": f"Invalid JSON response from Claude: {str(e)}"
            }
        except Exception as e:
            logger.error("Failed to process Claude response", error=str(e))
            return {
                "success": False,
                "error": f"Error processing Claude response: {str(e)}"
            }

    def _extract_json_from_response(self, response: str) -> str:
        """Extract JSON from Claude's response (handle markdown formatting)"""
        # Remove markdown code blocks if present
        response = response.strip()
        
        # Look for JSON content between ```json and ``` or just ```
        json_pattern = r'```(?:json)?\s*(\{.*?\})\s*```'
        match = re.search(json_pattern, response, re.DOTALL | re.IGNORECASE)
        
        if match:
            return match.group(1)
        
        # Look for JSON object directly
        json_pattern = r'\{.*\}'
        match = re.search(json_pattern, response, re.DOTALL)
        
        if match:
            return match.group(0)
        
        # Return as-is if no patterns found
        return response

    def _clean_transaction_data(self, transaction: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Clean and validate individual transaction data"""
        try:
            # Required fields
            merchant_name = str(transaction.get("merchant_name", "Unknown Merchant")).strip()
            if not merchant_name:
                merchant_name = "Unknown Merchant"
            
            # Amount validation and conversion
            amount = self._clean_amount(transaction.get("amount"))
            if amount is None or amount <= 0:
                logger.warning("Invalid or missing amount in transaction", transaction=transaction)
                return None
            
            # Date validation and conversion
            transaction_date = self._clean_date(transaction.get("transaction_date"))
            
            # Description
            description = str(transaction.get("description", "")).strip()
            if not description:
                description = f"Purchase from {merchant_name}"
            
            # Category suggestion
            category_suggestion = str(transaction.get("category_suggestion", "Other")).strip()
            if not category_suggestion:
                category_suggestion = "Other"
            
            # Confidence score
            confidence = float(transaction.get("confidence", 0.5))
            confidence = max(0.0, min(1.0, confidence))  # Clamp between 0 and 1
            
            return {
                "merchant_name": merchant_name,
                "amount": float(amount),
                "currency": str(transaction.get("currency", "USD")),
                "transaction_date": transaction_date,
                "description": description,
                "category_suggestion": category_suggestion,
                "confidence": confidence,
                "raw_text_snippet": str(transaction.get("raw_text_snippet", ""))[:500]  # Limit length
            }
            
        except Exception as e:
            logger.warning("Failed to clean transaction data", error=str(e), transaction=transaction)
            return None

    def _clean_amount(self, amount_value: Any) -> Optional[Decimal]:
        """Clean and validate amount value"""
        try:
            if amount_value is None:
                return None
            
            # Convert to string first
            amount_str = str(amount_value).strip()
            
            # Remove currency symbols and common formatting
            amount_str = re.sub(r'[^\d.,\-]', '', amount_str)
            
            # Handle common decimal formats
            if ',' in amount_str and '.' in amount_str:
                # Determine which is decimal separator (last one usually)
                if amount_str.rfind('.') > amount_str.rfind(','):
                    # Period is decimal separator, comma is thousands
                    amount_str = amount_str.replace(',', '')
                else:
                    # Comma is decimal separator, period is thousands
                    amount_str = amount_str.replace('.', '').replace(',', '.')
            elif ',' in amount_str:
                # Could be thousands separator or decimal
                parts = amount_str.split(',')
                if len(parts[-1]) == 2:  # Likely decimal (e.g., "1,234,56")
                    amount_str = amount_str.replace(',', '.')
                else:  # Likely thousands separator
                    amount_str = amount_str.replace(',', '')
            
            # Convert to Decimal
            amount = Decimal(amount_str)
            
            # Reasonable bounds check
            if amount < 0:
                amount = abs(amount)  # Make positive
            
            if amount > 100000:  # $100k seems reasonable max for receipts
                logger.warning("Amount seems very large", amount=amount)
            
            return amount
            
        except (ValueError, InvalidOperation, TypeError):
            logger.warning("Could not parse amount", amount_value=amount_value)
            return None

    def _clean_date(self, date_value: Any) -> str:
        """Clean and validate date value"""
        try:
            if not date_value:
                return datetime.now().strftime('%Y-%m-%d')
            
            date_str = str(date_value).strip()
            
            # Try to parse various date formats
            date_formats = [
                '%Y-%m-%d',
                '%m/%d/%Y',
                '%d/%m/%Y',
                '%m-%d-%Y',
                '%d-%m-%Y',
                '%Y/%m/%d',
                '%B %d, %Y',
                '%b %d, %Y',
                '%d %B %Y',
                '%d %b %Y'
            ]
            
            for fmt in date_formats:
                try:
                    parsed_date = datetime.strptime(date_str, fmt)
                    return parsed_date.strftime('%Y-%m-%d')
                except ValueError:
                    continue
            
            # If all parsing fails, use today's date
            logger.warning("Could not parse date, using today", date_value=date_value)
            return datetime.now().strftime('%Y-%m-%d')
            
        except Exception:
            return datetime.now().strftime('%Y-%m-%d')

    def _calculate_claude_confidence(self, data: Dict[str, Any], transactions: List[Dict[str, Any]]) -> float:
        """Calculate overall confidence in Claude's response"""
        try:
            # Base confidence from individual transactions
            individual_confidences = [t.get("confidence", 0.5) for t in transactions]
            avg_confidence = sum(individual_confidences) / len(individual_confidences) if individual_confidences else 0.5
            
            # Boost confidence based on response quality indicators
            confidence_boost = 0.0
            
            # Has processing notes (indicates thoughtful analysis)
            if data.get("processing_notes"):
                confidence_boost += 0.05
            
            # Detected document language
            if data.get("document_language") and data.get("document_language") != "Unknown":
                confidence_boost += 0.05
            
            # Detected document type
            if data.get("document_type") and data.get("document_type") != "Unknown":
                confidence_boost += 0.05
            
            # Number of transactions found (sweet spot is 1-3)
            num_transactions = len(transactions)
            if 1 <= num_transactions <= 3:
                confidence_boost += 0.05
            elif num_transactions == 4:
                confidence_boost += 0.03
            # No boost for 5 transactions (might be forcing it)
            
            final_confidence = min(avg_confidence + confidence_boost, 1.0)
            return max(final_confidence, 0.0)
            
        except Exception as e:
            logger.warning("Confidence calculation failed", error=str(e))
            return 0.5

    async def extract_transactions_from_text(self, job_id: str, text: str, filename: str) -> Dict[str, Any]:
        """
        Legacy method name for compatibility with processing pipeline
        Delegates to the main process_extracted_text method
        """
        return await self.process_extracted_text(
            job_id=job_id,
            extracted_text=text,
            extraction_confidence=0.8,  # Default confidence for legacy calls
            extraction_method="pipeline_extraction"
        )

    async def _validate_and_structure_transactions(self, job_id: str, transactions: List[Dict[str, Any]], 
                                                 extraction_confidence: float) -> Dict[str, Any]:
        """Validate and structure the final transaction data"""
        try:
            # Limit to maximum allowed transactions
            max_transactions = settings.MAX_TRANSACTIONS_PER_FILE
            if len(transactions) > max_transactions:
                logger.info("Truncating transactions to maximum allowed", 
                           found=len(transactions), 
                           max_allowed=max_transactions)
                transactions = transactions[:max_transactions]
            
            # Calculate overall confidence
            transaction_confidences = [t.get("confidence", 0.5) for t in transactions]
            avg_transaction_confidence = sum(transaction_confidences) / len(transaction_confidences)
            
            # Combine extraction and AI confidence
            overall_confidence = (extraction_confidence * 0.3) + (avg_transaction_confidence * 0.7)
            
            # Create structured data for database storage
            structured_data = {
                "transactions": transactions,
                "metadata": {
                    "total_transactions": len(transactions),
                    "extraction_confidence": extraction_confidence,
                    "ai_confidence": avg_transaction_confidence,
                    "overall_confidence": overall_confidence,
                    "processing_timestamp": datetime.now().isoformat(),
                    "ai_provider": "claude-3.5-sonnet"
                }
            }
            
            return {
                "success": True,
                "transactions": transactions,
                "structured_data": structured_data,
                "overall_confidence": overall_confidence,
                "total_transactions": len(transactions)
            }
            
        except Exception as e:
            logger.error("Transaction validation failed", job_id=job_id, error=str(e))
            return {
                "success": False,
                "error": f"Transaction validation failed: {str(e)}"
            }

    async def _process_with_fallback(self, job_id: str, text: str) -> Dict[str, Any]:
        """Fallback AI processing (OpenAI, Groq, etc.)"""
        # TODO: Implement fallback AI processing
        logger.warning("Fallback AI processing not yet implemented", job_id=job_id)
        return {
            "success": False,
            "error": "Primary AI processing failed and fallback not available"
        }

    def is_ai_available(self) -> bool:
        """Check if AI processing is available"""
        return self.anthropic_client is not None or self.fallback_available

    def get_ai_status(self) -> Dict[str, Any]:
        """Get AI service status"""
        return {
            "claude_available": self.anthropic_client is not None,
            "fallback_available": self.fallback_available,
            "model": settings.CLAUDE_MODEL if self.anthropic_client else None,
            "max_transactions": settings.MAX_TRANSACTIONS_PER_FILE
        }