-- Default data seeding for Finance Tracker
-- This script inserts default categories and demo data

-- Create demo user (for testing purposes)
INSERT INTO users (id, email, password_hash, first_name, last_name, status, email_verified) 
VALUES (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'demo@financetracker.com',
    '$2b$12$LQv3c1yqBwEHxE4fjHQUPuJNYkNJhqfN3B8dKMlZ9vQb8qIb7Z8qi',
    'Demo',
    'User',
    'active',
    TRUE
) ON CONFLICT (email) DO NOTHING;

-- Default expense categories (FIXED UUID)
INSERT INTO categories (user_id, name, description, color, icon, type, is_default) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, 'Food & Dining', 'Restaurants, groceries, food delivery', '#FF6B35', '🍽️', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Transportation', 'Gas, public transit, ride-sharing, car maintenance', '#4ECDC4', '🚗', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Shopping', 'Clothing, electronics, general shopping', '#45B7D1', '🛍️', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Entertainment', 'Movies, concerts, games, subscriptions', '#96CEB4', '🎬', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Bills & Utilities', 'Electric, water, internet, phone bills', '#FFEAA7', '📄', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Healthcare', 'Medical, dental, pharmacy, insurance', '#DDA0DD', '❤️', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Education', 'Books, courses, tuition, training', '#98D8C8', '📚', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Travel', 'Flights, hotels, vacation expenses', '#F7DC6F', '✈️', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Home & Garden', 'Rent, mortgage, home improvement, garden', '#BB8FCE', '🏠', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Personal Care', 'Haircuts, cosmetics, gym, wellness', '#85C1E9', '✨', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Gifts & Donations', 'Presents, charity, donations', '#F8C471', '🎁', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Business', 'Office supplies, business meals, tools', '#82E0AA', '💼', 'expense', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Other Expenses', 'Miscellaneous and uncategorized expenses', '#D5DBDB', '📝', 'expense', TRUE);

-- Default income categories (FIXED UUID)
INSERT INTO categories (user_id, name, description, color, icon, type, is_default) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, 'Salary', 'Regular employment income', '#27AE60', '💰', 'income', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Freelance', 'Contract and freelance work', '#2ECC71', '💼', 'income', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Business Income', 'Revenue from business activities', '#58D68D', '📈', 'income', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Investment Returns', 'Dividends, capital gains, interest', '#A9DFBF', '📊', 'income', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Rental Income', 'Property rental earnings', '#7DCEA0', '🏠', 'income', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Side Hustle', 'Additional income sources', '#52C785', '⚡', 'income', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Gifts & Bonuses', 'Monetary gifts, work bonuses, rewards', '#76D7C4', '🎁', 'income', TRUE),
('00000000-0000-0000-0000-000000000001'::uuid, 'Other Income', 'Miscellaneous income sources', '#85C1E9', '➕', 'income', TRUE);

-- Sample expenses for demo user (last 30 days) - FIXED UUID
INSERT INTO expenses (user_id, category_id, amount, description, transaction_date, location) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Food & Dining' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 45.67, 'Grocery shopping', CURRENT_DATE - INTERVAL '2 days', 'Whole Foods Market'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Transportation' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 85.00, 'Gas fill-up', CURRENT_DATE - INTERVAL '3 days', 'Shell Station'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Food & Dining' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 32.50, 'Lunch at restaurant', CURRENT_DATE - INTERVAL '1 days', 'Local Bistro'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Entertainment' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 15.99, 'Netflix subscription', CURRENT_DATE - INTERVAL '5 days', 'Online'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Bills & Utilities' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 125.00, 'Electric bill', CURRENT_DATE - INTERVAL '7 days', 'Online Payment'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Shopping' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 89.99, 'New shoes', CURRENT_DATE - INTERVAL '10 days', 'Nike Store'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Healthcare' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 25.00, 'Pharmacy prescription', CURRENT_DATE - INTERVAL '12 days', 'CVS Pharmacy'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Food & Dining' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 67.43, 'Weekly groceries', CURRENT_DATE - INTERVAL '9 days', 'Target'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Transportation' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 12.50, 'Uber ride', CURRENT_DATE - INTERVAL '6 days', 'Downtown'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Personal Care' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 35.00, 'Haircut', CURRENT_DATE - INTERVAL '14 days', 'Hair Salon');

-- Sample income for demo user (FIXED UUID)
INSERT INTO income (user_id, category_id, amount, description, frequency, transaction_date, is_recurring, source) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Salary' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 4500.00, 'Monthly salary', 'monthly', CURRENT_DATE - INTERVAL '5 days', TRUE, 'Tech Company Inc.'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Freelance' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 850.00, 'Website development project', 'one_time', CURRENT_DATE - INTERVAL '8 days', FALSE, 'Client ABC'),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Investment Returns' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 125.30, 'Stock dividends', 'quarterly', CURRENT_DATE - INTERVAL '15 days', TRUE, 'Investment Portfolio');

-- Sample budgets (FIXED UUID)
INSERT INTO budgets (user_id, category_id, amount, period, start_date) VALUES
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Food & Dining' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 500.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE)),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Transportation' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 300.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE)),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Entertainment' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 200.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE)),
('00000000-0000-0000-0000-000000000001'::uuid, (SELECT id FROM categories WHERE name = 'Shopping' AND user_id = '00000000-0000-0000-0000-000000000001'::uuid), 400.00, 'monthly', DATE_TRUNC('month', CURRENT_DATE));

-- Create database roles for services (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'finance_auth_service') THEN
        CREATE ROLE finance_auth_service WITH LOGIN PASSWORD 'auth_service_password';
        GRANT CONNECT ON DATABASE finance_tracker TO finance_auth_service;
        GRANT SELECT, INSERT, UPDATE, DELETE ON users, user_sessions TO finance_auth_service;
        GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO finance_auth_service;
    END IF;

    IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'finance_read_only') THEN
        CREATE ROLE finance_read_only WITH LOGIN PASSWORD 'readonly_password';
        GRANT CONNECT ON DATABASE finance_tracker TO finance_read_only;
        GRANT SELECT ON ALL TABLES IN SCHEMA public TO finance_read_only;
    END IF;
END
$$;