-- Receipt Processing Schema Extension for Finance Tracker
-- Location: infrastructure/database/init/04-receipt-schema.sql

-- Create receipt processing status enum
CREATE TYPE receipt_status AS ENUM ('uploaded', 'processing', 'ocr_completed', 'ai_processing', 'completed', 'failed', 'approved', 'rejected');

-- Receipt processing jobs table
CREATE TABLE receipt_jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_size BIGINT NOT NULL,
    file_type VARCHAR(10) NOT NULL,
    mime_type VARCHAR(100),
    file_path TEXT,
    checksum VARCHAR(64),
    
    -- Processing status
    status receipt_status DEFAULT 'uploaded',
    processing_started_at TIMESTAMPTZ,
    processing_completed_at TIMESTAMPTZ,
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- OCR results
    ocr_text TEXT,
    ocr_confidence DECIMAL(5,4),
    ocr_provider VARCHAR(50) DEFAULT 'easyocr',
    
    -- AI extraction results
    extracted_data JSONB,
    ai_provider VARCHAR(50) DEFAULT 'claude-3.5',
    ai_processing_time_ms INTEGER,
    ai_confidence DECIMAL(5,4),
    
    -- Integration results
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    suggested_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipt processing logs for detailed tracking
CREATE TABLE receipt_processing_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES receipt_jobs(id) ON DELETE CASCADE,
    step VARCHAR(50) NOT NULL, -- 'upload', 'validation', 'ocr', 'ai_processing', 'expense_creation'
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
CREATE INDEX idx_receipt_jobs_expense_id ON receipt_jobs(expense_id) WHERE expense_id IS NOT NULL;

-- Index for processing logs
CREATE INDEX idx_receipt_logs_job_step ON receipt_processing_logs(job_id, step);
CREATE INDEX idx_receipt_logs_created_at ON receipt_processing_logs(created_at DESC);

-- Trigger for updated_at column
CREATE TRIGGER update_receipt_jobs_updated_at 
    BEFORE UPDATE ON receipt_jobs 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to log processing steps
CREATE OR REPLACE FUNCTION log_receipt_processing_step(
    p_job_id UUID,
    p_step VARCHAR(50),
    p_status VARCHAR(20),
    p_message TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT NULL,
    p_processing_time_ms INTEGER DEFAULT NULL,
    p_error_details JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    log_id UUID;
BEGIN
    INSERT INTO receipt_processing_logs (
        job_id, step, status, message, metadata, 
        processing_time_ms, error_details
    ) VALUES (
        p_job_id, p_step, p_status, p_message, p_metadata,
        p_processing_time_ms, p_error_details
    ) RETURNING id INTO log_id;
    
    RETURN log_id;
END;
$$ LANGUAGE plpgsql;