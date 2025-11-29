-- Finance Tracker Database Initialization - Enhanced Version
-- This script creates the complete database schema with email verification and account types

-- Create extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create enum types
CREATE TYPE user_status AS ENUM ('active', 'inactive', 'suspended', 'pending_verification');
CREATE TYPE transaction_type AS ENUM ('income', 'expense');
CREATE TYPE category_type AS ENUM ('income', 'expense', 'both');
CREATE TYPE transaction_frequency AS ENUM ('one_time', 'daily', 'weekly', 'bi_weekly', 'semi_monthly', 'monthly', 'bi_monthly', 'quarterly', 'semi_annually', 'yearly');
CREATE TYPE account_type AS ENUM ('personal', 'business');
CREATE TYPE verification_type AS ENUM ('email_verification', 'password_reset', 'login_verification');

-- Enhanced Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    account_type account_type DEFAULT 'personal',
    company_name VARCHAR(255),
    default_currency VARCHAR(3) DEFAULT 'USD',
    currency_locale VARCHAR(10) DEFAULT 'en-US',
    preferred_language VARCHAR(5) DEFAULT 'en',
    status user_status DEFAULT 'pending_verification',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP WITH TIME ZONE,
    email_verified BOOLEAN DEFAULT FALSE,
    email_verified_at TIMESTAMP WITH TIME ZONE,
    email_verification_token VARCHAR(255),
    email_verification_expires TIMESTAMP WITH TIME ZONE,
    login_verification_token VARCHAR(255),
    login_verification_expires TIMESTAMP WITH TIME ZONE,
    failed_login_attempts INTEGER DEFAULT 0,
    locked_until TIMESTAMP WITH TIME ZONE,
    verification_token VARCHAR(255)
);

-- Email verification logs table
CREATE TABLE email_verifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    verification_type verification_type NOT NULL,
    verification_token VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    verified_at TIMESTAMP WITH TIME ZONE,
    attempts INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Email send log table for tracking
CREATE TABLE email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    email_type VARCHAR(50) NOT NULL,
    subject VARCHAR(255) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- MISSING TABLE - Default categories table (CRITICAL FIX)
CREATE TABLE default_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    color VARCHAR(7) NOT NULL,
    icon VARCHAR(50),
    type category_type NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Categories table with unlimited hierarchical support
CREATE TABLE categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    color VARCHAR(7),
    icon VARCHAR(50),
    type category_type NOT NULL DEFAULT 'both',
    is_default BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    -- Hierarchical fields
    parent_id UUID REFERENCES categories(id) ON DELETE CASCADE,
    level INTEGER NOT NULL DEFAULT 1,
    path VARCHAR(1000) NOT NULL DEFAULT '',
    path_ids UUID[] NOT NULL DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    -- Constraints
    CONSTRAINT unique_user_category_name_per_parent UNIQUE (user_id, name, parent_id),
    CONSTRAINT valid_level CHECK (level >= 1),
    CONSTRAINT valid_path CHECK (path IS NOT NULL)
);

-- Expenses table
-- DECIMAL(15,2) supports all currencies: USD ($10M), EUR (€10M), IRR (100B Rials), VND, IDR
CREATE TABLE expenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    description TEXT,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    user_date DATE NOT NULL,
    user_time TIME NOT NULL,
    location VARCHAR(255),
    is_recurring BOOLEAN DEFAULT FALSE,
    frequency transaction_frequency DEFAULT 'one_time',
    next_expected_date DATE,
    tags TEXT[],
    receipt_url VARCHAR(500),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Income table
-- DECIMAL(15,2) supports all currencies
CREATE TABLE income (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    description TEXT NOT NULL,
    transaction_date TIMESTAMP WITH TIME ZONE NOT NULL,
    user_date DATE NOT NULL,
    user_time TIME NOT NULL,
    source VARCHAR(255),
    is_recurring BOOLEAN DEFAULT FALSE,
    frequency transaction_frequency DEFAULT 'one_time',
    next_expected_date DATE,
    tags TEXT[],
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- User sessions table
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    ip_address INET,
    user_agent TEXT
);

-- Budget table
-- DECIMAL(15,2) supports all currencies
CREATE TABLE budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    amount DECIMAL(15,2) NOT NULL CHECK (amount > 0),
    period VARCHAR(20) NOT NULL DEFAULT 'monthly',
    start_date DATE NOT NULL,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, category_id, period, start_date)
);

-- Indexes for hierarchical categories performance
CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_parent_id ON categories(parent_id);
CREATE INDEX idx_categories_path ON categories(path);
CREATE INDEX idx_categories_path_ids ON categories USING GIN(path_ids);
CREATE INDEX idx_categories_user_type ON categories(user_id, type);
CREATE INDEX idx_categories_level ON categories(level);

-- MISSING DATA - Insert default categories (CRITICAL FIX)
INSERT INTO default_categories (name, description, color, icon, type) VALUES
-- Expense Categories
('Food & Dining', 'Restaurants, groceries, food delivery', '#FF6B35', '🍽️', 'expense'),
('Transportation', 'Gas, public transit, ride-sharing, car maintenance', '#4ECDC4', '🚗', 'expense'),
('Shopping', 'Clothing, electronics, general shopping', '#45B7D1', '🛍️', 'expense'),
('Entertainment', 'Movies, concerts, games, subscriptions', '#96CEB4', '🎬', 'expense'),
('Bills & Utilities', 'Electric, water, internet, phone bills', '#FFEAA7', '📄', 'expense'),
('Healthcare', 'Medical, dental, pharmacy, insurance', '#DDA0DD', '❤️', 'expense'),
('Education', 'Books, courses, tuition, training', '#98D8C8', '📚', 'expense'),
('Travel', 'Flights, hotels, vacation expenses', '#F7DC6F', '✈️', 'expense'),
('Home & Garden', 'Rent, mortgage, home improvement, garden', '#BB8FCE', '🏠', 'expense'),
('Personal Care', 'Haircuts, cosmetics, gym, wellness', '#85C1E9', '✨', 'expense'),
('Gifts & Donations', 'Presents, charity, donations', '#F8C471', '🎁', 'expense'),
('Business', 'Office supplies, business meals, tools', '#82E0AA', '💼', 'expense'),
('Other Expenses', 'Miscellaneous and uncategorized expenses', '#D5DBDB', '📝', 'expense'),

-- Income Categories
('Salary', 'Regular employment income', '#27AE60', '💰', 'income'),
('Freelance', 'Contract and freelance work', '#2ECC71', '💼', 'income'),
('Business Income', 'Revenue from business activities', '#58D68D', '📈', 'income'),
('Investment Returns', 'Dividends, capital gains, interest', '#A9DFBF', '📊', 'income'),
('Rental Income', 'Property rental earnings', '#7DCEA0', '🏠', 'income'),
('Side Hustle', 'Additional income sources', '#52C785', '⚡', 'income'),
('Gifts & Bonuses', 'Monetary gifts, work bonuses, rewards', '#76D7C4', '🎁', 'income'),
('Other Income', 'Miscellaneous income sources', '#85C1E9', '➕', 'income');

-- Indexes for better performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_created_at ON users(created_at);
CREATE INDEX idx_users_account_type ON users(account_type);
CREATE INDEX idx_users_email_verification_token ON users(email_verification_token);
CREATE INDEX idx_users_login_verification_token ON users(login_verification_token);

CREATE INDEX idx_email_verifications_user_id ON email_verifications(user_id);
CREATE INDEX idx_email_verifications_token ON email_verifications(verification_token);
CREATE INDEX idx_email_verifications_type ON email_verifications(verification_type);
CREATE INDEX idx_email_verifications_expires ON email_verifications(expires_at);

CREATE INDEX idx_email_logs_user_id ON email_logs(user_id);
CREATE INDEX idx_email_logs_email_type ON email_logs(email_type);
CREATE INDEX idx_email_logs_status ON email_logs(status);
CREATE INDEX idx_email_logs_created_at ON email_logs(created_at);

CREATE INDEX idx_categories_user_id ON categories(user_id);
CREATE INDEX idx_categories_type ON categories(type);
CREATE INDEX idx_categories_is_active ON categories(is_active);
CREATE INDEX idx_default_categories_type ON default_categories(type);
CREATE INDEX idx_default_categories_active ON default_categories(is_active);

CREATE INDEX idx_expenses_user_id ON expenses(user_id);
CREATE INDEX idx_expenses_category_id ON expenses(category_id);
CREATE INDEX idx_expenses_transaction_date ON expenses(transaction_date);
CREATE INDEX idx_expenses_amount ON expenses(amount);
CREATE INDEX idx_expenses_user_date ON expenses(user_id, transaction_date);
CREATE INDEX idx_expenses_user_local_date ON expenses(user_id, user_date DESC, user_time DESC);
CREATE INDEX idx_expenses_user_date_range ON expenses(user_id, user_date) WHERE user_date >= CURRENT_DATE - INTERVAL '90 days';

CREATE INDEX idx_income_user_id ON income(user_id);
CREATE INDEX idx_income_category_id ON income(category_id);
CREATE INDEX idx_income_transaction_date ON income(transaction_date);
CREATE INDEX idx_income_user_local_date ON income(user_id, user_date DESC, user_time DESC);
CREATE INDEX idx_income_frequency ON income(frequency);
CREATE INDEX idx_income_is_recurring ON income(is_recurring);

CREATE INDEX idx_expenses_is_recurring ON expenses(is_recurring);
CREATE INDEX idx_expenses_frequency ON expenses(frequency);
CREATE INDEX idx_expenses_next_expected_date ON expenses(next_expected_date) WHERE next_expected_date IS NOT NULL;

CREATE INDEX idx_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_sessions_expires_at ON user_sessions(expires_at);

CREATE INDEX idx_budgets_user_id ON budgets(user_id);
CREATE INDEX idx_budgets_category_id ON budgets(category_id);
CREATE INDEX idx_budgets_period ON budgets(period);

-- MISSING FUNCTIONS - Fix the ambiguous column reference issue (CRITICAL FIX)
CREATE OR REPLACE FUNCTION copy_default_categories_to_user(new_user_id UUID)
RETURNS VOID AS $func$
BEGIN
    INSERT INTO categories (user_id, name, description, color, icon, type, is_default, is_active)
    SELECT 
        new_user_id,           -- Use parameter explicitly to avoid ambiguity
        dc.name,
        dc.description,
        dc.color,
        dc.icon,
        dc.type,
        TRUE,                  -- Mark as default for this user
        dc.is_active
    FROM default_categories dc
    WHERE dc.is_active = TRUE
    ON CONFLICT (user_id, name) DO NOTHING;
END;
$func$ LANGUAGE plpgsql;

-- MISSING TRIGGER FUNCTION (CRITICAL FIX)
CREATE OR REPLACE FUNCTION trigger_add_default_categories()
RETURNS TRIGGER AS $trigger$
BEGIN
    PERFORM copy_default_categories_to_user(NEW.id);
    RETURN NEW;
END;
$trigger$ LANGUAGE plpgsql;

-- Triggers for updated_at columns
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_email_verifications_updated_at BEFORE UPDATE ON email_verifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON expenses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_income_updated_at BEFORE UPDATE ON income FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_budgets_updated_at BEFORE UPDATE ON budgets FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- MISSING TRIGGER - Create the trigger that was causing the error (CRITICAL FIX)
CREATE TRIGGER after_user_insert
    AFTER INSERT ON users
    FOR EACH ROW
    EXECUTE FUNCTION trigger_add_default_categories();