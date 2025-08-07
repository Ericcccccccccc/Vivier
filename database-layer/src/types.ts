export interface User {
  id: string;
  email: string;
  created_at: Date;
  updated_at: Date;
  settings: UserSettings;
  subscription_tier: 'free' | 'pro' | 'enterprise';
}

export interface UserSettings {
  notifications_enabled?: boolean;
  auto_reply?: boolean;
  time_zone?: string;
  language?: string;
  theme?: 'light' | 'dark' | 'system';
  email_signature?: string;
  ai_tone?: 'professional' | 'casual' | 'friendly';
  custom_settings?: Record<string, any>;
}

export interface EmailAccount {
  id: string;
  user_id: string;
  email_address: string;
  provider: 'gmail' | 'outlook' | 'imap';
  encrypted_credentials: string;
  settings: EmailAccountSettings;
  last_sync: Date | null;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface EmailAccountSettings {
  sync_interval_minutes?: number;
  folders_to_sync?: string[];
  auto_categorize?: boolean;
  spam_filter_level?: 'low' | 'medium' | 'high';
  custom_rules?: EmailRule[];
  [key: string]: any;
}

export interface EmailRule {
  id: string;
  condition: {
    field: 'from' | 'subject' | 'body';
    operator: 'contains' | 'equals' | 'starts_with' | 'ends_with';
    value: string;
  };
  action: {
    type: 'categorize' | 'auto_reply' | 'forward' | 'archive';
    value?: string;
  };
}

export interface Email {
  id: string;
  account_id: string;
  message_id: string;
  thread_id?: string;
  subject: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  body_text: string;
  body_html?: string;
  attachments?: Attachment[];
  received_at: Date;
  processed_at?: Date;
  metadata: EmailMetadata;
  created_at: Date;
  updated_at: Date;
}

export interface Attachment {
  id: string;
  filename: string;
  content_type: string;
  size_bytes: number;
  url?: string;
  inline?: boolean;
}

export interface EmailMetadata {
  headers?: Record<string, string>;
  labels?: string[];
  categories?: string[];
  importance?: 'low' | 'normal' | 'high';
  is_read?: boolean;
  is_starred?: boolean;
  is_spam?: boolean;
  sentiment?: 'positive' | 'neutral' | 'negative';
  [key: string]: any;
}

export interface AIResponse {
  id: string;
  email_id: string;
  response_text: string;
  model_used: string;
  confidence_score: number;
  tokens_used: number;
  response_time_ms: number;
  template_id?: string;
  user_edited: boolean;
  sent_at?: Date;
  created_at: Date;
  updated_at: Date;
}

export interface ResponseTemplate {
  id: string;
  user_id: string;
  name: string;
  description?: string;
  template_text: string;
  variables: TemplateVariable[];
  category?: string;
  usage_count: number;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TemplateVariable {
  name: string;
  type: 'text' | 'number' | 'date' | 'select';
  required: boolean;
  default_value?: any;
  options?: string[];
  description?: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  email_id?: string;
  notification_type: string;
  channel: 'email' | 'push' | 'webhook';
  recipient: string;
  subject?: string;
  content?: string;
  status: 'pending' | 'sent' | 'failed' | 'delivered';
  error_message?: string;
  metadata?: Record<string, any>;
  sent_at?: Date;
  delivered_at?: Date;
  created_at: Date;
}

export interface UsageMetric {
  id: string;
  user_id: string;
  metric_type: MetricType;
  count: number;
  period_start: Date;
  period_end: Date;
  created_at: Date;
  updated_at: Date;
}

export type MetricType = 'ai_calls' | 'emails_processed' | 'storage_used' | 'templates_created';

// Input types for creating/updating entities
export interface CreateUserInput {
  email: string;
  settings?: Partial<UserSettings>;
  subscription_tier?: 'free' | 'pro' | 'enterprise';
}

export interface UpdateUserInput {
  email?: string;
  settings?: Partial<UserSettings>;
  subscription_tier?: 'free' | 'pro' | 'enterprise';
}

export interface EmailAccountInput {
  email_address: string;
  provider: 'gmail' | 'outlook' | 'imap';
  encrypted_credentials: string;
  settings?: Partial<EmailAccountSettings>;
}

export interface CreateEmailInput {
  account_id: string;
  message_id: string;
  thread_id?: string;
  subject: string;
  from_address: string;
  to_addresses: string[];
  cc_addresses?: string[];
  bcc_addresses?: string[];
  body_text: string;
  body_html?: string;
  attachments?: Attachment[];
  received_at: Date;
  metadata?: Partial<EmailMetadata>;
}

export interface AIResponseInput {
  email_id: string;
  response_text: string;
  model_used: string;
  confidence_score: number;
  tokens_used: number;
  response_time_ms: number;
  template_id?: string;
}

export interface TemplateInput {
  name: string;
  description?: string;
  template_text: string;
  variables?: TemplateVariable[];
  category?: string;
}

export interface NotificationInput {
  user_id: string;
  email_id?: string;
  notification_type: string;
  channel: 'email' | 'push' | 'webhook';
  recipient: string;
  subject?: string;
  content?: string;
  metadata?: Record<string, any>;
}

// Query and pagination types
export interface QueryOptions {
  limit?: number;
  offset?: number;
  orderBy?: string;
  orderDirection?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

// Real-time subscription types
export type SubscriptionCallback<T> = (data: T) => void;
export type UnsubscribeFunction = () => void;

// Transaction type
export interface TransactionContext {
  commit: () => Promise<void>;
  rollback: () => Promise<void>;
}