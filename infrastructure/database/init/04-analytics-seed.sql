-- Analytics Seed Data for Finance Tracker
-- Location: infrastructure/database/init/04-analytics-seed.sql

-- Insert default analytics preferences for existing users
INSERT INTO user_analytics_preferences (user_id, default_period, preferred_charts, dashboard_layout)
SELECT 
    id,
    'monthly',
    '["line", "bar", "doughnut"]'::jsonb,
    '{
        "layout": "grid",
        "widgets": [
            {"type": "spending_overview", "position": {"x": 0, "y": 0, "w": 12, "h": 4}},
            {"type": "category_breakdown", "position": {"x": 0, "y": 4, "w": 6, "h": 6}},
            {"type": "trend_analysis", "position": {"x": 6, "y": 4, "w": 6, "h": 6}},
            {"type": "budget_progress", "position": {"x": 0, "y": 10, "w": 12, "h": 4}}
        ]
    }'::jsonb
FROM users
ON CONFLICT (user_id) DO NOTHING;

-- Create sample analytics events for demo user (if exists)
INSERT INTO analytics_events (user_id, event_type, event_data, amount, category_id, occurred_at)
SELECT 
    e.user_id,
    'expense_created',
    jsonb_build_object(
        'description', e.description,
        'location', e.location,
        'source', 'initial_data'
    ),
    e.amount,
    e.category_id,
    e.transaction_date::timestamptz
FROM expenses e
WHERE e.user_id = '00000000-0000-0000-0000-000000000001'::uuid
ON CONFLICT DO NOTHING;

-- Create dashboard interaction events for demo user
INSERT INTO analytics_events (user_id, event_type, event_data, occurred_at)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    event_type,
    event_data::jsonb,
    occurred_at
FROM (VALUES
    ('dashboard_view', '{"page": "overview", "duration": 45}', NOW() - INTERVAL '1 day'),
    ('chart_interaction', '{"chart_type": "category_pie", "action": "hover"}', NOW() - INTERVAL '2 days'),
    ('period_change', '{"from": "weekly", "to": "monthly"}', NOW() - INTERVAL '3 days'),
    ('export_request', '{"format": "csv", "period": "monthly"}', NOW() - INTERVAL '5 days'),
    ('budget_check', '{"category": "Food & Dining", "status": "over_budget"}', NOW() - INTERVAL '7 days')
) AS sample_events(event_type, event_data, occurred_at);

-- Insert income analytics events for demo user (if income exists)
INSERT INTO analytics_events (user_id, event_type, event_data, amount, category_id, occurred_at)
SELECT 
    i.user_id,
    'income_added',
    jsonb_build_object(
        'description', i.description,
        'frequency', i.frequency,
        'source', i.source
    ),
    i.amount,
    i.category_id,
    i.transaction_date::timestamptz
FROM income i
WHERE i.user_id = '00000000-0000-0000-0000-000000000001'::uuid
ON CONFLICT DO NOTHING;

-- Create some time-series data for better trend visualization
INSERT INTO analytics_events (user_id, event_type, event_data, amount, occurred_at)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    'daily_summary',
    jsonb_build_object(
        'total_transactions', floor(random() * 10 + 1),
        'avg_amount', round((random() * 100 + 20)::numeric, 2)
    ),
    round((random() * 500 + 50)::numeric, 2),
    generate_series(
        CURRENT_DATE - INTERVAL '30 days',
        CURRENT_DATE - INTERVAL '1 day',
        INTERVAL '1 day'
    )::timestamptz
WHERE EXISTS (
    SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
);

-- Create category performance tracking events
INSERT INTO analytics_events (user_id, event_type, event_data, category_id, occurred_at)
SELECT 
    '00000000-0000-0000-0000-000000000001'::uuid,
    'category_analysis',
    jsonb_build_object(
        'analysis_type', 'monthly_review',
        'trend', CASE 
            WHEN random() > 0.6 THEN 'increasing'
            WHEN random() > 0.3 THEN 'decreasing'
            ELSE 'stable'
        END,
        'variance', round((random() * 50)::numeric, 2)
    ),
    c.id,
    NOW() - (random() * INTERVAL '7 days')
FROM categories c
WHERE c.user_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND c.type IN ('expense', 'both')
    AND EXISTS (
        SELECT 1 FROM users WHERE id = '00000000-0000-0000-0000-000000000001'::uuid
    )
LIMIT 5;

-- Refresh materialized views with new data
REFRESH MATERIALIZED VIEW daily_expense_summary;
REFRESH MATERIALIZED VIEW monthly_budget_analysis;

-- Create a scheduled job to refresh materialized views (if pg_cron is available)
-- This is optional and depends on your PostgreSQL setup
DO $$
BEGIN
    -- Try to create refresh schedule if pg_cron extension exists
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        -- Refresh daily summary every hour
        PERFORM cron.schedule('refresh-daily-summary', '0 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY daily_expense_summary;');
        
        -- Refresh budget analysis every 6 hours
        PERFORM cron.schedule('refresh-budget-analysis', '0 */6 * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY monthly_budget_analysis;');
        
        -- Clean up expired cache every day at 2 AM
        PERFORM cron.schedule('cleanup-cache', '0 2 * * *', 'SELECT cleanup_expired_cache();');
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- If pg_cron is not available, just continue
        NULL;
END $$;

-- Insert analytics preferences for any additional test users
INSERT INTO user_analytics_preferences (user_id, default_period, preferred_charts, dashboard_layout)
SELECT 
    id,
    'weekly',
    '["area", "line", "bar"]'::jsonb,
    '{
        "layout": "grid",
        "widgets": [
            {"type": "spending_overview", "position": {"x": 0, "y": 0, "w": 8, "h": 5}},
            {"type": "quick_stats", "position": {"x": 8, "y": 0, "w": 4, "h": 5}},
            {"type": "category_breakdown", "position": {"x": 0, "y": 5, "w": 6, "h": 6}},
            {"type": "trend_analysis", "position": {"x": 6, "y": 5, "w": 6, "h": 6}}
        ]
    }'::jsonb
FROM users 
WHERE id != '00000000-0000-0000-0000-000000000001'::uuid
ON CONFLICT (user_id) DO NOTHING;

-- Add some sample cache entries to test the cache system
INSERT INTO analytics_cache (cache_key, user_id, data, expires_at)
SELECT 
    'analytics:' || id::text || ':demo',
    id,
    '{"message": "Sample cached data", "generated_at": "' || NOW()::text || '"}'::jsonb,
    NOW() + INTERVAL '1 hour'
FROM users
WHERE EXISTS (SELECT 1 FROM expenses WHERE user_id = users.id)
LIMIT 3;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Analytics seed data completed successfully at %', NOW();
END $$;