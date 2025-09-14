-- Analytics Schema Extension for Finance Tracker
-- Location: infrastructure/database/init/03-analytics-schema.sql

-- Enable TimescaleDB extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Create analytics events table for tracking user interactions
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB NOT NULL,
    amount DECIMAL(15,2),
    category_id UUID REFERENCES categories(id),
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Convert to hypertable for time-series optimization
SELECT create_hypertable('analytics_events', 'occurred_at');

-- Create analytics cache table for performance optimization
CREATE TABLE analytics_cache (
    cache_key VARCHAR(255) PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    data JSONB NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create user preferences for analytics dashboard
CREATE TABLE user_analytics_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    default_period VARCHAR(20) DEFAULT 'monthly',
    preferred_charts JSONB DEFAULT '["line", "bar", "pie"]',
    dashboard_layout JSONB,
    timezone VARCHAR(50) DEFAULT 'UTC',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enhanced indexes for analytics queries
CREATE INDEX idx_analytics_events_user_occurred ON analytics_events(user_id, occurred_at DESC);
CREATE INDEX idx_analytics_events_type_occurred ON analytics_events(event_type, occurred_at DESC);
CREATE INDEX idx_analytics_events_category_occurred ON analytics_events(category_id, occurred_at DESC) WHERE category_id IS NOT NULL;
CREATE INDEX idx_analytics_events_amount ON analytics_events(amount) WHERE amount IS NOT NULL;

-- Index for cache table
CREATE INDEX idx_analytics_cache_user_expires ON analytics_cache(user_id, expires_at);
CREATE INDEX idx_analytics_cache_expires ON analytics_cache(expires_at);

-- Materialized view for daily expense summary
CREATE MATERIALIZED VIEW daily_expense_summary AS
SELECT 
    user_id,
    category_id,
    DATE_TRUNC('day', transaction_date) as day,
    SUM(amount) as total_amount,
    COUNT(*) as transaction_count,
    AVG(amount) as avg_amount,
    MAX(amount) as max_amount,
    MIN(amount) as min_amount
FROM expenses
GROUP BY user_id, category_id, DATE_TRUNC('day', transaction_date);

CREATE UNIQUE INDEX idx_daily_expense_summary_unique 
ON daily_expense_summary(user_id, category_id, day);

-- Materialized view for monthly budget analysis
CREATE MATERIALIZED VIEW monthly_budget_analysis AS
SELECT 
    b.user_id,
    b.category_id,
    c.name as category_name,
    DATE_TRUNC('month', CURRENT_DATE) as month,
    b.amount as budget_amount,
    COALESCE(SUM(e.amount), 0) as spent_amount,
    (b.amount - COALESCE(SUM(e.amount), 0)) as remaining_amount,
    CASE 
        WHEN b.amount > 0 THEN (COALESCE(SUM(e.amount), 0) / b.amount * 100)
        ELSE 0
    END as usage_percentage
FROM budgets b
LEFT JOIN categories c ON b.category_id = c.id
LEFT JOIN expenses e ON b.category_id = e.category_id 
    AND b.user_id = e.user_id
    AND e.transaction_date >= DATE_TRUNC('month', CURRENT_DATE)
    AND e.transaction_date < DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month'
WHERE b.is_active = true
GROUP BY b.user_id, b.category_id, c.name, b.amount;

-- Function for spending trend analysis
CREATE OR REPLACE FUNCTION get_spending_trend(
    p_user_id UUID,
    p_days INTEGER DEFAULT 30
) RETURNS TABLE (
    period_date DATE,
    total_amount DECIMAL,
    transaction_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('day', e.transaction_date)::DATE as period_date,
        SUM(e.amount) as total_amount,
        COUNT(*) as transaction_count
    FROM expenses e
    WHERE e.user_id = p_user_id
        AND e.transaction_date >= CURRENT_DATE - (p_days || ' days')::INTERVAL
    GROUP BY DATE_TRUNC('day', e.transaction_date)
    ORDER BY period_date;
END;
$$ LANGUAGE plpgsql;

-- Function for category insights
CREATE OR REPLACE FUNCTION get_category_insights(
    p_user_id UUID,
    p_period VARCHAR DEFAULT 'month'
) RETURNS TABLE (
    category_id UUID,
    category_name VARCHAR,
    total_amount DECIMAL,
    transaction_count BIGINT,
    avg_transaction DECIMAL,
    percentage_of_total DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    WITH period_expenses AS (
        SELECT e.category_id, e.amount
        FROM expenses e
        WHERE e.user_id = p_user_id
            AND e.transaction_date >= CASE 
                WHEN p_period = 'week' THEN CURRENT_DATE - INTERVAL '7 days'
                WHEN p_period = 'month' THEN DATE_TRUNC('month', CURRENT_DATE)
                WHEN p_period = 'year' THEN DATE_TRUNC('year', CURRENT_DATE)
                ELSE DATE_TRUNC('month', CURRENT_DATE)
            END
    ),
    totals AS (
        SELECT SUM(amount) as grand_total FROM period_expenses
    )
    SELECT 
        c.id as category_id,
        c.name as category_name,
        SUM(pe.amount) as total_amount,
        COUNT(pe.amount) as transaction_count,
        AVG(pe.amount) as avg_transaction,
        CASE 
            WHEN t.grand_total > 0 THEN (SUM(pe.amount) / t.grand_total * 100)
            ELSE 0
        END as percentage_of_total
    FROM categories c
    LEFT JOIN period_expenses pe ON c.id = pe.category_id
    CROSS JOIN totals t
    WHERE c.user_id = p_user_id AND c.type IN ('expense', 'both')
    GROUP BY c.id, c.name, t.grand_total
    HAVING SUM(pe.amount) > 0
    ORDER BY total_amount DESC;
END;
$$ LANGUAGE plpgsql;

-- Clean up expired cache entries function
CREATE OR REPLACE FUNCTION cleanup_expired_cache() RETURNS void AS $$
BEGIN
    DELETE FROM analytics_cache WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;