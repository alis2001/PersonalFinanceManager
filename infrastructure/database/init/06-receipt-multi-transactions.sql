-- Receipt Multi-Transaction Support Schema
-- Location: infrastructure/database/init/06-receipt-multi-transactions.sql

-- Add columns to support multiple transactions per file
ALTER TABLE receipt_jobs ADD COLUMN IF NOT EXISTS transactions_found INTEGER DEFAULT 0;
ALTER TABLE receipt_jobs ADD COLUMN IF NOT EXISTS transactions_processed INTEGER DEFAULT 0;
ALTER TABLE receipt_jobs ADD COLUMN IF NOT EXISTS validation_passed BOOLEAN DEFAULT NULL;
ALTER TABLE receipt_jobs ADD COLUMN IF NOT EXISTS validation_message TEXT;

-- Create table for individual transactions within a receipt
CREATE TABLE IF NOT EXISTS receipt_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES receipt_jobs(id) ON DELETE CASCADE,
    transaction_index INTEGER NOT NULL, -- 1, 2, 3, 4, 5
    
    -- Extracted transaction data
    merchant_name VARCHAR(255),
    transaction_date DATE,
    amount DECIMAL(12,2),
    description TEXT,
    category_suggestion VARCHAR(100),
    
    -- Raw extracted data for this transaction
    raw_data JSONB,
    
    -- Processing status for this individual transaction
    processing_status VARCHAR(20) DEFAULT 'extracted', -- 'extracted', 'validated', 'approved', 'expense_created'
    confidence_score DECIMAL(5,4),
    
    -- Links to created records
    expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL,
    suggested_category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
    
    -- User approval
    user_approved BOOLEAN DEFAULT NULL,
    user_modified_data JSONB, -- If user makes changes
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Ensure max 5 transactions per job
    CONSTRAINT max_transactions_per_job CHECK (transaction_index BETWEEN 1 AND 5)
);

-- Indexes for receipt transactions
CREATE INDEX idx_receipt_transactions_job_id ON receipt_transactions(job_id);
CREATE INDEX idx_receipt_transactions_job_index ON receipt_transactions(job_id, transaction_index);
CREATE INDEX idx_receipt_transactions_status ON receipt_transactions(processing_status);
CREATE INDEX idx_receipt_transactions_expense_id ON receipt_transactions(expense_id) WHERE expense_id IS NOT NULL;

-- Trigger for updated_at column
CREATE TRIGGER update_receipt_transactions_updated_at 
    BEFORE UPDATE ON receipt_transactions 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to validate transaction count
CREATE OR REPLACE FUNCTION validate_receipt_transaction_count()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if this would exceed 5 transactions for this job
    IF (SELECT COUNT(*) FROM receipt_transactions WHERE job_id = NEW.job_id) >= 5 THEN
        RAISE EXCEPTION 'Maximum 5 transactions allowed per receipt file';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to enforce transaction limit
CREATE TRIGGER enforce_transaction_limit
    BEFORE INSERT ON receipt_transactions
    FOR EACH ROW
    EXECUTE FUNCTION validate_receipt_transaction_count();

-- Function to update job transaction counts
CREATE OR REPLACE FUNCTION update_job_transaction_counts()
RETURNS TRIGGER AS $$
BEGIN
    -- Update the job's transaction counts
    UPDATE receipt_jobs 
    SET 
        transactions_found = (
            SELECT COUNT(*) 
            FROM receipt_transactions 
            WHERE job_id = COALESCE(NEW.job_id, OLD.job_id)
        ),
        transactions_processed = (
            SELECT COUNT(*) 
            FROM receipt_transactions 
            WHERE job_id = COALESCE(NEW.job_id, OLD.job_id) 
            AND processing_status IN ('validated', 'approved', 'expense_created')
        ),
        updated_at = NOW()
    WHERE id = COALESCE(NEW.job_id, OLD.job_id);
    
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers to maintain transaction counts
CREATE TRIGGER update_job_counts_on_insert
    AFTER INSERT ON receipt_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_job_transaction_counts();

CREATE TRIGGER update_job_counts_on_update
    AFTER UPDATE ON receipt_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_job_transaction_counts();

CREATE TRIGGER update_job_counts_on_delete
    AFTER DELETE ON receipt_transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_job_transaction_counts();