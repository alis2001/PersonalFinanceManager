class AIProcessor:
    """AI-powered text understanding and multi-transaction extraction"""
    
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
            
            # TODO: Add fallback clients (OpenAI, Groq, etc.)
            
        except Exception as e:
            logger.error("Failed to initialize AI clients", error=str(e))
    
    async def extract_transactions_from_text(self, job_id: str, text: str, filename: str) -> Dict[str, Any]:
        """
        Extract multiple transactions from text using Claude 3.5
        
        Returns: {
            "success": bool,
            "transactions": [{"amount": float, "description": str, "date": str, ...}],
            "confidence": float,
            "provider": str,
            "error": str
        }
        """
        start_time = time.time()
        
        try:
            logger.info("🤖 Starting AI transaction extraction", 
                       job_id=job_id, text_length=len(text))
            
            if not self.anthropic_client:
                return {"success": False, "error": "Claude AI client not available"}
            
            if not text or len(text.strip()) < 10:
                return {"success": False, "error": "Insufficient text for processing"}
            
            # Create Claude prompt for multi-transaction extraction
            prompt = self._create_transaction_extraction_prompt(text, filename)
            
            # Call Claude API
            response = await self._call_claude_api(prompt)
            
            if not response["success"]:
                return response
            
            # Parse Claude response into structured transactions
            parsed_result = self._parse_claude_response(response["content"])
            
            processing_time_ms = int((time.time() - start_time) * 1000)
            
            if parsed_result["success"]:
                logger.info("✅ AI transaction extraction completed", 
                           job_id=job_id,
                           transactions_found=len(parsed_result["transactions"]),
                           processing_time_ms=processing_time_ms)
                
                await log_processing_step(
                    job_id, 'ai_extraction', 'completed',
                    f'AI extracted {len(parsed_result["transactions"])} transactions',
                    metadata={
                        "transactions_count": len(parsed_result["transactions"]),
                        "processing_time_ms": processing_time_ms,
                        "confidence": parsed_result.get("confidence"),
                        "provider": "claude-3.5-sonnet"
                    }
                )
                
                return {
                    "success": True,
                    "transactions": parsed_result["transactions"],
                    "confidence": parsed_result.get("confidence", 0.8),
                    "provider": "claude-3.5-sonnet",
                    "processing_time_ms": processing_time_ms
                }
            else:
                return parsed_result
            
        except Exception as e:
            processing_time_ms = int((time.time() - start_time) * 1000)
            error_msg = f"AI processing failed: {str(e)}"
            
            logger.error("❌ AI transaction extraction failed", 
                        job_id=job_id, error=str(e), processing_time_ms=processing_time_ms)
            
            await log_processing_step(
                job_id, 'ai_extraction', 'failed', error_msg,
                error_details={"exception": str(e), "processing_time_ms": processing_time_ms}
            )
            
            return {"success": False, "error": error_msg}
    
    def _create_transaction_extraction_prompt(self, text: str, filename: str) -> str:
        """Create optimized prompt for Claude to extract multiple transactions"""
        
        return f"""You are an expert at extracting financial transaction data from receipt and document text. 

TASK: Extract ALL individual transactions from the following text, which may contain multiple purchases, expenses, or financial transactions.

DOCUMENT TEXT:
{text}

REQUIREMENTS:
1. Extract EACH INDIVIDUAL TRANSACTION (up to {settings.MAX_TRANSACTIONS_PER_FILE} transactions)
2. For each transaction, extract these fields:
   - amount: The monetary value (as positive number, no currency symbols)
   - description: Brief description of the item/service (max 100 characters)
   - date: Transaction date in YYYY-MM-DD format (estimate if needed)
   - merchant: Business/vendor name (if identifiable)
   - category: Expense category (food, transport, shopping, etc.)
   - currency: Currency code (USD, EUR, etc. - estimate if not specified)

OUTPUT FORMAT: Return ONLY valid JSON in this exact structure:
{{
  "transactions": [
    {{
      "amount": 25.99,
      "description": "Coffee and pastry",
      "date": "2024-01-15",
      "merchant": "Starbucks",
      "category": "food",
      "currency": "USD",
      "raw_text_snippet": "relevant portion of original text"
    }}
  ],
  "confidence": 0.9,
  "total_transactions": 1
}}

IMPORTANT RULES:
- Only extract REAL transactions with amounts
- If amount is unclear, skip that transaction
- Use today's date if no date is found: {datetime.now().strftime('%Y-%m-%d')}
- Keep descriptions concise and clear
- Confidence should be 0.1-1.0 based on text clarity
- Maximum {settings.MAX_TRANSACTIONS_PER_FILE} transactions
- Return empty transactions array if no valid transactions found

Extract the transactions now:"""

    async def _call_claude_api(self, prompt: str) -> Dict[str, Any]:
        """Call Claude 3.5 API with error handling and retries"""
        try:
            message = await self.anthropic_client.messages.create(
                model=settings.CLAUDE_MODEL,
                max_tokens=settings.CLAUDE_MAX_TOKENS,
                temperature=settings.CLAUDE_TEMPERATURE,
                messages=[
                    {"role": "user", "content": prompt}
                ]
            )
            
            content = message.content[0].text if message.content else ""
            
            return {
                "success": True,
                "content": content,
                "usage": {
                    "input_tokens": message.usage.input_tokens if hasattr(message, 'usage') else 0,
                    "output_tokens": message.usage.output_tokens if hasattr(message, 'usage') else 0
                }
            }
            
        except Exception as e:
            logger.error("Claude API call failed", error=str(e))
            return {"success": False, "error": f"Claude API error: {str(e)}"}
    
    def _parse_claude_response(self, content: str) -> Dict[str, Any]:
        """Parse Claude's JSON response into structured data"""
        try:
            # Clean the response (remove any markdown or extra text)
            content = content.strip()
            
            # Find JSON content
            start_idx = content.find('{')
            end_idx = content.rfind('}') + 1
            
            if start_idx == -1 or end_idx == 0:
                return {"success": False, "error": "No JSON found in AI response"}
            
            json_content = content[start_idx:end_idx]
            data = json.loads(json_content)
            
            # Validate structure
            if "transactions" not in data:
                return {"success": False, "error": "Invalid response structure: missing transactions"}
            
            transactions = data["transactions"]
            if not isinstance(transactions, list):
                return {"success": False, "error": "Transactions must be a list"}
            
            # Validate and clean each transaction
            cleaned_transactions = []
            for i, transaction in enumerate(transactions):
                cleaned = self._validate_transaction(transaction, i)
                if cleaned:
                    cleaned_transactions.append(cleaned)
            
            if not cleaned_transactions:
                return {"success": False, "error": "No valid transactions found in AI response"}
            
            return {
                "success": True,
                "transactions": cleaned_transactions,
                "confidence": self._validate_confidence(data.get("confidence", 0.7)),
                "ai_metadata": {
                    "total_found": len(cleaned_transactions),
                    "raw_response_length": len(content)
                }
            }
            
        except json.JSONDecodeError as e:
            logger.error("Failed to parse Claude JSON response", error=str(e))
            return {"success": False, "error": f"Invalid JSON from AI: {str(e)}"}
        except Exception as e:
            logger.error("Failed to process Claude response", error=str(e))
            return {"success": False, "error": f"Response processing failed: {str(e)}"}
    
    def _validate_transaction(self, transaction: Dict[str, Any], index: int) -> Optional[Dict[str, Any]]:
        """Validate and clean a single transaction"""
        try:
            # Required: amount
            amount = transaction.get("amount")
            if not amount:
                logger.warning(f"Transaction {index}: missing amount")
                return None
            
            # Convert amount to float
            try:
                amount_float = float(amount)
                if amount_float <= 0:
                    logger.warning(f"Transaction {index}: invalid amount {amount}")
                    return None
            except (ValueError, TypeError):
                logger.warning(f"Transaction {index}: cannot convert amount to float: {amount}")
                return None
            
            # Clean and validate other fields
            cleaned = {
                "amount": round(amount_float, 2),
                "description": str(transaction.get("description", "")).strip()[:100] or "Unspecified transaction",
                "date": self._validate_date(transaction.get("date")),
                "merchant": str(transaction.get("merchant", "")).strip()[:100] or "Unknown merchant",
                "category": str(transaction.get("category", "")).strip().lower() or "other",
                "currency": str(transaction.get("currency", "USD")).upper()[:3],
                "raw_text_snippet": str(transaction.get("raw_text_snippet", "")).strip()[:500]
            }
            
            return cleaned
            
        except Exception as e:
            logger.warning(f"Transaction {index} validation failed", error=str(e))
            return None
    
    def _validate_date(self, date_str: Any) -> str:
        """Validate and normalize date string"""
        if not date_str:
            return datetime.now().strftime('%Y-%m-%d')
        
        try:
            date_str = str(date_str).strip()
            
            # Try parsing various date formats
            for fmt in ['%Y-%m-%d', '%m/%d/%Y', '%d/%m/%Y', '%Y-%m-%d %H:%M:%S']:
                try:
                    parsed_date = datetime.strptime(date_str, fmt)
                    return parsed_date.strftime('%Y-%m-%d')
                except ValueError:
                    continue
            
            # If parsing fails, use today's date
            logger.warning(f"Could not parse date: {date_str}, using today")
            return datetime.now().strftime('%Y-%m-%d')
            
        except Exception:
            return datetime.now().strftime('%Y-%m-%d')
    
    def _validate_confidence(self, confidence: Any) -> float:
        """Validate confidence score"""
        try:
            conf_float = float(confidence)
            return max(0.1, min(1.0, conf_float))  # Clamp between 0.1 and 1.0
        except (ValueError, TypeError):
            return 0.7  # Default confidence