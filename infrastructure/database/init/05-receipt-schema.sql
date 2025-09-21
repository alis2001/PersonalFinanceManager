-- Enhanced Receipt Processing Schema for Multi-Transaction Support
-- Location: infrastructure/database/init/05-receipt-schema.sql

-- Create receipt processing status enum
CREATE TYPE receipt_status AS ENUM ('uploaded', 'processing', 'ocr_completed', 'ai_processing', 'completed', 'failed', 'approved', 'rejected');

-- Create transaction status enum for individual transactions
CREATE TYPE transaction_status AS ENUM ('pending', 'validated', 'approved', 'rejected', 'expense_created');

-- Receipt processing jobs table (main file tracking with database storage)
CREATE TABLE receipt_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    mime_type VARCHAR(100),
    checksum VARCHAR(64),
    
    -- File content stored in database
    file_content BYTEA NOT NULL,  -- Binary file data
    content_encoding VARCHAR(50) DEFAULT 'binary',
    
    -- Processing status
    status receipt_status DEFAULT 'uploaded',
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- OCR results (raw text from entire document)
    ocr_text TEXT,
    ocr_confidence DECIMAL(5,4),
    ocr_provider VARCHAR(50) DEFAULT 'easyocr',
    
    -- AI processing metadata
    ai_provider VARCHAR(50) DEFAULT 'claude-3.5',
    ai_processing_time_ms INTEGER,
    
    -- Multi-transaction support
    total_transactions_detected INTEGER DEFAULT 0,
    transactions_processed INTEGER DEFAULT 0,
    transactions_approved INTEGER DEFAULT 0,
    
    -- File organization metadata
    upload_date DATE DEFAULT CURRENT_DATE,
    file_category VARCHAR(50) DEFAULT 'receipt', -- receipt, invoice, statement
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual transactions extracted from receipts
CREATE TABLE receipt_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES receipt_jobs(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Transaction sequence within the document
    transaction_index INTEGER NOT NULL, -- 1, 2, 3, etc.
    
    -- Extracted transaction data (from Claude AI)
    extracted_data JSONB NOT NULL, -- Contains: amount, description, date, merchant, etc.
    ai_confidence DECIMAL(5,4),
    raw_text_snippet TEXT, -- Portion of OCR text for this transaction
    
    -- Transaction status
    status transaction_status DEFAULT 'pending',
    
    -- Integration with expense system
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    suggested_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- User interaction
    user_approved_at TIMESTAMPTZ,
    user_rejected_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure unique transaction index per job
    UNIQUE(job_id, transaction_index)
);

-- Receipt processing logs for detailed tracking
CREATE TABLE receipt_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES receipt_jobs(id) ON DELETE CASCADE,
    transaction_id UUID REFERENCES receipt_transactions(id) ON DELETE CASCADE, -- NULL for job-level logs
    step VARCHAR(50) NOT NULL, -- 'upload', 'validation', 'ocr', 'ai_processing', 'transaction_extraction', 'expense_creation'
    status VARCHAR(20) NOT NULL, -- 'started', 'completed', 'failed'
    message TEXT,
    metadata JSONB,
    processing_time_ms INTEGER,
    error_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced indexes for receipt processing
CREATE INDEX idx_receipt_jobs_user_status ON receipt_jobs(user_id, status);
CREATE INDEX idx_receipt_jobs_status ON receipt_jobs(status);
CREATE INDEX idx_receipt_jobs_created_at ON receipt_jobs(created_at DESC);
CREATE INDEX idx_receipt_jobs_user_created ON receipt_jobs(user_id, created_at DESC);
CREATE INDEX idx_receipt_jobs_processing ON receipt_jobs(status) WHERE status IN ('processing', 'ai_processing');

-- Indexes for transactions
CREATE INDEX idx_receipt_transactions_job_id ON receipt_transactions(job_id);
CREATE INDEX idx_receipt_transactions_user_status ON receipt_transactions(user_id, status);
CREATE INDEX idx_receipt_transactions_status ON receipt_transactions(status);
CREATE INDEX idx_receipt_transactions_pending ON receipt_transactions(user_id, status, created_at DESC) WHERE status = 'pending';
CREATE INDEX idx_receipt_transactions_expense ON receipt_transactions(expense_id) WHERE expense_id IS NOT NULL;

-- Indexes for processing logs
CREATE INDEX idx_receipt_logs_job_step ON receipt_processing_logs(job_id, step);
CREATE INDEX idx_receipt_logs_transaction ON receipt_processing_logs(transaction_id) WHERE transaction_id IS NOT NULL;
CREATE INDEX idx_receipt_logs_created ON receipt_processing_logs(created_at DESC);

-- Helper functions for transaction management
CREATE OR REPLACE FUNCTION update_job_transaction_counts(p_job_id UUID)
RETURNS VOID AS $$
BEGIN
    UPDATE receipt_jobs 
    SET 
        total_transactions_detected = (
            SELECT COUNT(*) FROM receipt_transactions WHERE job_id = p_job_id
        ),
        transactions_processed = (
            SELECT COUNT(*) FROM receipt_transactions 
            WHERE job_id = p_job_id AND status IN ('validated', 'approved', 'rejected', 'expense_created')
        ),
        transactions_approved = (
            SELECT COUNT(*) FROM receipt_transactions 
            WHERE job_id = p_job_id AND status IN ('approved', 'expense_created')
        ),
        updated_at = NOW()
    WHERE id = p_job_id;
END;
$$ LANGUAGE plpgsql;

-- Function to log processing steps with optional transaction context
CREATE OR REPLACE FUNCTION log_receipt_processing_step(
    p_job_id UUID,
    p_step VARCHAR(50),
    p_status VARCHAR(20),
    p_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_error_details JSONB DEFAULT NULL,
    p_transaction_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO receipt_processing_logs (
        job_id, transaction_id, step, status, message, metadata, 
        processing_time_ms, error_details
    ) VALUES (
        p_job_id, p_transaction_id, p_step, p_status, p_message, 
        p_metadata, p_processing_time_ms, p_error_details
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;