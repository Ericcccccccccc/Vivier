-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable RLS
ALTER DATABASE postgres SET "app.jwt_secret" TO 'your-jwt-secret';

-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    settings JSONB DEFAULT '{}',
    subscription_tier TEXT DEFAULT 'free' CHECK (subscription_tier IN ('free', 'pro', 'enterprise'))
);

-- Email accounts table
CREATE TABLE email_accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_address VARCHAR(255) NOT NULL,
    provider TEXT NOT NULL CHECK (provider IN ('gmail', 'outlook', 'imap')),
    encrypted_credentials TEXT NOT NULL,
    settings JSONB DEFAULT '{}',
    last_sync TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, email_address)
);

-- Emails table
CREATE TABLE emails (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES email_accounts(id) ON DELETE CASCADE,
    message_id VARCHAR(255) NOT NULL,
    thread_id VARCHAR(255),
    subject TEXT,
    from_address VARCHAR(255) NOT NULL,
    to_addresses TEXT[] NOT NULL,
    cc_addresses TEXT[] DEFAULT '{}',
    bcc_addresses TEXT[] DEFAULT '{}',
    body_text TEXT,
    body_html TEXT,
    attachments JSONB DEFAULT '[]',
    received_at TIMESTAMPTZ NOT NULL,
    processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(account_id, message_id)
);

-- AI Responses table
CREATE TABLE ai_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email_id UUID NOT NULL REFERENCES emails(id) ON DELETE CASCADE,
    response_text TEXT NOT NULL,
    model_used VARCHAR(100) NOT NULL,
    confidence_score DECIMAL(3,2) CHECK (confidence_score >= 0 AND confidence_score <= 1),
    tokens_used INTEGER NOT NULL,
    response_time_ms INTEGER NOT NULL,
    template_id UUID,
    user_edited BOOLEAN DEFAULT false,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Response Templates table
CREATE TABLE response_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_text TEXT NOT NULL,
    variables JSONB DEFAULT '[]',
    category VARCHAR(100),
    usage_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- Notification Logs table
CREATE TABLE notification_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    email_id UUID REFERENCES emails(id) ON DELETE SET NULL,
    notification_type VARCHAR(50) NOT NULL,
    channel VARCHAR(50) NOT NULL CHECK (channel IN ('email', 'push', 'webhook')),
    recipient VARCHAR(255) NOT NULL,
    subject VARCHAR(255),
    content TEXT,
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'sent', 'failed', 'delivered')),
    error_message TEXT,
    metadata JSONB DEFAULT '{}',
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage Metrics table
CREATE TABLE usage_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('ai_calls', 'emails_processed', 'storage_used', 'templates_created')),
    count INTEGER DEFAULT 0,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, metric_type, period_start)
);

-- Create indexes for performance
CREATE INDEX idx_email_accounts_user_id ON email_accounts(user_id);
CREATE INDEX idx_emails_account_id ON emails(account_id);
CREATE INDEX idx_emails_received_at ON emails(account_id, received_at DESC);
CREATE INDEX idx_emails_thread_id ON emails(thread_id);
CREATE INDEX idx_ai_responses_email_id ON ai_responses(email_id);
CREATE INDEX idx_response_templates_user_id ON response_templates(user_id);
CREATE INDEX idx_notification_logs_user_id ON notification_logs(user_id);
CREATE INDEX idx_notification_logs_email_id ON notification_logs(email_id);
CREATE INDEX idx_usage_metrics_user_id ON usage_metrics(user_id, metric_type, period_start);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_email_accounts_updated_at BEFORE UPDATE ON email_accounts
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_emails_updated_at BEFORE UPDATE ON emails
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ai_responses_updated_at BEFORE UPDATE ON ai_responses
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_response_templates_updated_at BEFORE UPDATE ON response_templates
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_usage_metrics_updated_at BEFORE UPDATE ON usage_metrics
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to increment usage metrics
CREATE OR REPLACE FUNCTION increment_usage_metric(
    p_user_id UUID,
    p_metric_type VARCHAR(50),
    p_amount INTEGER DEFAULT 1
)
RETURNS void AS $$
DECLARE
    v_period_start DATE;
    v_period_end DATE;
BEGIN
    -- Get current period (month)
    v_period_start := DATE_TRUNC('month', CURRENT_DATE);
    v_period_end := (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month - 1 day')::DATE;
    
    -- Upsert the metric
    INSERT INTO usage_metrics (user_id, metric_type, count, period_start, period_end)
    VALUES (p_user_id, p_metric_type, p_amount, v_period_start, v_period_end)
    ON CONFLICT (user_id, metric_type, period_start)
    DO UPDATE SET 
        count = usage_metrics.count + p_amount,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE emails ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE response_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for users table
CREATE POLICY "Users can view own profile" ON users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

-- RLS Policies for email_accounts table
CREATE POLICY "Users can view own email accounts" ON email_accounts
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own email accounts" ON email_accounts
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own email accounts" ON email_accounts
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own email accounts" ON email_accounts
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for emails table
CREATE POLICY "Users can view own emails" ON emails
    FOR SELECT USING (
        account_id IN (
            SELECT id FROM email_accounts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own emails" ON emails
    FOR INSERT WITH CHECK (
        account_id IN (
            SELECT id FROM email_accounts WHERE user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own emails" ON emails
    FOR UPDATE USING (
        account_id IN (
            SELECT id FROM email_accounts WHERE user_id = auth.uid()
        )
    );

-- RLS Policies for ai_responses table
CREATE POLICY "Users can view own AI responses" ON ai_responses
    FOR SELECT USING (
        email_id IN (
            SELECT e.id FROM emails e
            JOIN email_accounts ea ON e.account_id = ea.id
            WHERE ea.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own AI responses" ON ai_responses
    FOR INSERT WITH CHECK (
        email_id IN (
            SELECT e.id FROM emails e
            JOIN email_accounts ea ON e.account_id = ea.id
            WHERE ea.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update own AI responses" ON ai_responses
    FOR UPDATE USING (
        email_id IN (
            SELECT e.id FROM emails e
            JOIN email_accounts ea ON e.account_id = ea.id
            WHERE ea.user_id = auth.uid()
        )
    );

-- RLS Policies for response_templates table
CREATE POLICY "Users can view own templates" ON response_templates
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own templates" ON response_templates
    FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own templates" ON response_templates
    FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own templates" ON response_templates
    FOR DELETE USING (user_id = auth.uid());

-- RLS Policies for notification_logs table
CREATE POLICY "Users can view own notifications" ON notification_logs
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own notifications" ON notification_logs
    FOR INSERT WITH CHECK (user_id = auth.uid());

-- RLS Policies for usage_metrics table
CREATE POLICY "Users can view own usage metrics" ON usage_metrics
    FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "System can insert usage metrics" ON usage_metrics
    FOR INSERT WITH CHECK (true);

CREATE POLICY "System can update usage metrics" ON usage_metrics
    FOR UPDATE USING (true);

-- Create a service role that bypasses RLS for backend operations
-- This will be used with the service key in the backend
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;