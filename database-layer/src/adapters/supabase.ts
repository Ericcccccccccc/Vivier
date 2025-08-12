import { createClient, SupabaseClient, RealtimeChannel } from '@supabase/supabase-js';
import { z } from 'zod';
import {
  DatabaseAdapter,
  User,
  CreateUserInput,
  UpdateUserInput,
  EmailAccount,
  EmailAccountInput,
  Email,
  CreateEmailInput,
  AIResponse,
  AIResponseInput,
  ResponseTemplate,
  TemplateInput,
  NotificationLog,
  NotificationInput,
  UsageMetric,
  MetricType,
  QueryOptions,
  PaginatedResult,
  SubscriptionCallback,
  UnsubscribeFunction,
} from '../interface';
import {
  DatabaseConnectionError,
  NotFoundError,
  DuplicateError,
  TransactionError,
  withErrorHandling,
} from '../errors';
import { logger } from '../utils/logger';

// Validation schemas
const emailSchema = z.object({
  account_id: z.string().uuid(),
  message_id: z.string(),
  thread_id: z.string().optional(),
  subject: z.string(),
  from_address: z.string().email(),
  to_addresses: z.array(z.string().email()),
  cc_addresses: z.array(z.string().email()).optional(),
  bcc_addresses: z.array(z.string().email()).optional(),
  body_text: z.string(),
  body_html: z.string().optional(),
  attachments: z.array(z.object({
    id: z.string(),
    filename: z.string(),
    content_type: z.string(),
    size_bytes: z.number(),
    url: z.string().optional(),
    inline: z.boolean().optional(),
  })).optional(),
  received_at: z.date(),
  metadata: z.record(z.any()).optional(),
});

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  serviceKey?: string;
  options?: {
    auth?: {
      autoRefreshToken?: boolean;
      persistSession?: boolean;
    };
    db?: {
      schema?: string;
    };
    pooling?: {
      min?: number;
      max?: number;
    };
  };
}

export class SupabaseAdapter implements DatabaseAdapter {
  private client: SupabaseClient<any, 'public', any>;
  private serviceClient?: SupabaseClient<any, 'public', any>;
  private channels: Map<string, RealtimeChannel> = new Map();

  constructor(config: SupabaseConfig) {
    // Initialize main client with anon key
    this.client = createClient<any, 'public', any>(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: config.options?.auth?.autoRefreshToken ?? true,
        persistSession: config.options?.auth?.persistSession ?? true,
      },
      db: {
        schema: (config.options?.db?.schema ?? 'public') as 'public',
      },
      global: {
        headers: {
          'x-application': 'email-ai-assistant',
        },
      },
    });

    // Initialize service client if service key is provided (for backend operations)
    if (config.serviceKey) {
      this.serviceClient = createClient<any, 'public', any>(config.url, config.serviceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        db: {
          schema: (config.options?.db?.schema ?? 'public') as 'public',
        },
      });
    }
  }

  // Use service client if available, otherwise use regular client
  private get db(): SupabaseClient {
    return this.serviceClient || this.client;
  }

  async connect(): Promise<void> {
    try {
      const { error } = await this.db.from('users').select('count').limit(1);
      if (error) throw error;
      
      logger.info('Connected to Supabase successfully');
    } catch (error) {
      logger.error('Failed to connect to Supabase', { error });
      throw new DatabaseConnectionError('Failed to connect to Supabase', error);
    }
  }

  async disconnect(): Promise<void> {
    // Unsubscribe from all channels
    for (const [, channel] of this.channels) {
      await this.client.removeChannel(channel);
    }
    this.channels.clear();
    
    logger.info('Disconnected from Supabase');
  }

  async healthCheck(): Promise<boolean> {
    try {
      const { error } = await this.db.from('users').select('count').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  // User Operations

  async createUser(data: CreateUserInput): Promise<User> {
    return withErrorHandling(async () => {
      const { data: user, error } = await this.db
        .from('users')
        .insert({
          email: data.email,
          settings: data.settings || {},
          subscription_tier: data.subscription_tier || 'free',
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') { // Unique violation
          throw new DuplicateError('email', data.email);
        }
        throw error;
      }

      logger.info('Created user', { userId: user.id, email: user.email });
      return this.mapUser(user);
    }, 'create user');
  }

  async getUser(id: string): Promise<User | null> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('users')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? this.mapUser(data) : null;
    }, 'get user');
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null; // Not found
        throw error;
      }

      return data ? this.mapUser(data) : null;
    }, 'get user by email');
  }

  async updateUser(id: string, data: UpdateUserInput): Promise<User> {
    return withErrorHandling(async () => {
      const { data: user, error } = await this.db
        .from('users')
        .update({
          ...(data.email && { email: data.email }),
          ...(data.settings && { settings: data.settings }),
          ...(data.subscription_tier && { subscription_tier: data.subscription_tier }),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('User', id);
        }
        throw error;
      }

      logger.info('Updated user', { userId: id });
      return this.mapUser(user);
    }, 'update user');
  }

  async deleteUser(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await this.db
        .from('users')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('User', id);
        }
        throw error;
      }

      logger.info('Deleted user', { userId: id });
    }, 'delete user');
  }

  // Email Account Operations

  async addEmailAccount(userId: string, data: EmailAccountInput): Promise<EmailAccount> {
    return withErrorHandling(async () => {
      const { data: account, error } = await this.db
        .from('email_accounts')
        .insert({
          user_id: userId,
          email_address: data.email_address,
          provider: data.provider,
          encrypted_credentials: data.encrypted_credentials,
          settings: data.settings || {},
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new DuplicateError('email_address', data.email_address);
        }
        throw error;
      }

      logger.info('Added email account', { accountId: account.id, userId });
      return this.mapEmailAccount(account);
    }, 'add email account');
  }

  async getEmailAccounts(userId: string): Promise<EmailAccount[]> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('email_accounts')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (error) throw error;

      return (data || []).map(this.mapEmailAccount);
    }, 'get email accounts');
  }

  async getEmailAccount(id: string): Promise<EmailAccount | null> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('email_accounts')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? this.mapEmailAccount(data) : null;
    }, 'get email account');
  }

  async updateEmailAccount(id: string, data: Partial<EmailAccountInput>): Promise<EmailAccount> {
    return withErrorHandling(async () => {
      const { data: account, error } = await this.db
        .from('email_accounts')
        .update({
          ...(data.email_address && { email_address: data.email_address }),
          ...(data.provider && { provider: data.provider }),
          ...(data.encrypted_credentials && { encrypted_credentials: data.encrypted_credentials }),
          ...(data.settings && { settings: data.settings }),
        })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('EmailAccount', id);
        }
        throw error;
      }

      logger.info('Updated email account', { accountId: id });
      return this.mapEmailAccount(account);
    }, 'update email account');
  }

  async deleteEmailAccount(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await this.db
        .from('email_accounts')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('EmailAccount', id);
        }
        throw error;
      }

      logger.info('Deleted email account', { accountId: id });
    }, 'delete email account');
  }

  // Email Operations

  async createEmail(data: CreateEmailInput): Promise<Email> {
    return withErrorHandling(async () => {
      // Validate input
      const validated = emailSchema.parse(data);

      const { data: email, error } = await this.db
        .from('emails')
        .insert({
          ...validated,
          attachments: data.attachments || [],
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      // Increment usage metrics
      const account = await this.getEmailAccount(data.account_id);
      if (account) {
        await this.incrementUsage(account.user_id, 'emails_processed');
      }

      logger.info('Created email', { emailId: email.id, accountId: data.account_id });
      return this.mapEmail(email);
    }, 'create email');
  }

  async createEmails(data: CreateEmailInput[]): Promise<Email[]> {
    return withErrorHandling(async () => {
      // Validate all inputs
      const validated = data.map(item => emailSchema.parse(item));

      const { data: emails, error } = await this.db
        .from('emails')
        .insert(validated.map(item => ({
          ...item,
          attachments: item.attachments || [],
          metadata: item.metadata || {},
        })))
        .select();

      if (error) throw error;

      // Increment usage metrics
      if (validated.length > 0 && validated[0]) {
        const account = await this.getEmailAccount(validated[0].account_id);
        if (account) {
          await this.incrementUsage(account.user_id, 'emails_processed', validated.length);
        }
      }

      logger.info('Created emails batch', { count: emails.length });
      return (emails || []).map(this.mapEmail);
    }, 'create emails batch');
  }

  async getEmails(accountId: string, options?: QueryOptions): Promise<PaginatedResult<Email>> {
    return withErrorHandling(async () => {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;
      const orderBy = options?.orderBy || 'received_at';
      const orderDirection = options?.orderDirection || 'desc';

      // Build query
      let query = this.db
        .from('emails')
        .select('*', { count: 'exact' })
        .eq('account_id', accountId);

      // Apply filters
      if (options?.filters) {
        for (const [key, value] of Object.entries(options.filters)) {
          if (value !== undefined && value !== null) {
            query = query.eq(key, value);
          }
        }
      }

      // Apply pagination and ordering
      query = query
        .order(orderBy, { ascending: orderDirection === 'asc' })
        .range(offset, offset + limit - 1);

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        data: (data || []).map(this.mapEmail),
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      };
    }, 'get emails');
  }

  async getEmailsByThread(threadId: string): Promise<Email[]> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('emails')
        .select('*')
        .eq('thread_id', threadId)
        .order('received_at', { ascending: true });

      if (error) throw error;

      return (data || []).map(this.mapEmail);
    }, 'get emails by thread');
  }

  async getEmail(id: string): Promise<Email | null> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('emails')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? this.mapEmail(data) : null;
    }, 'get email');
  }

  async markEmailProcessed(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await this.db
        .from('emails')
        .update({ processed_at: new Date().toISOString() })
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Email', id);
        }
        throw error;
      }

      logger.info('Marked email as processed', { emailId: id });
    }, 'mark email processed');
  }

  async updateEmailMetadata(id: string, metadata: Record<string, any>): Promise<Email> {
    return withErrorHandling(async () => {
      const { data: email, error } = await this.db
        .from('emails')
        .update({ metadata })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Email', id);
        }
        throw error;
      }

      return this.mapEmail(email);
    }, 'update email metadata');
  }

  async deleteEmail(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await this.db
        .from('emails')
        .delete()
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Email', id);
        }
        throw error;
      }

      logger.info('Deleted email', { emailId: id });
    }, 'delete email');
  }

  // AI Response Operations

  async saveAIResponse(data: AIResponseInput): Promise<AIResponse> {
    return withErrorHandling(async () => {
      const { data: response, error } = await this.db
        .from('ai_responses')
        .insert({
          email_id: data.email_id,
          response_text: data.response_text,
          model_used: data.model_used,
          confidence_score: data.confidence_score,
          tokens_used: data.tokens_used,
          response_time_ms: data.response_time_ms,
          template_id: data.template_id,
          user_edited: false,
        })
        .select()
        .single();

      if (error) throw error;

      // Increment AI usage
      const email = await this.getEmail(data.email_id);
      if (email) {
        const account = await this.getEmailAccount(email.account_id);
        if (account) {
          await this.incrementUsage(account.user_id, 'ai_calls');
        }
      }

      logger.info('Saved AI response', { responseId: response.id, emailId: data.email_id });
      return this.mapAIResponse(response);
    }, 'save AI response');
  }

  async getAIResponse(emailId: string): Promise<AIResponse | null> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('ai_responses')
        .select('*')
        .eq('email_id', emailId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? this.mapAIResponse(data) : null;
    }, 'get AI response');
  }

  async getAIResponses(userId: string, options?: QueryOptions): Promise<PaginatedResult<AIResponse>> {
    return withErrorHandling(async () => {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      const { data, error, count } = await this.db
        .from('ai_responses')
        .select(`
          *,
          emails!inner(
            email_accounts!inner(user_id)
          )
        `, { count: 'exact' })
        .eq('emails.email_accounts.user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: (data || []).map(this.mapAIResponse),
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      };
    }, 'get AI responses');
  }

  async updateAIResponse(id: string, data: Partial<AIResponseInput>): Promise<AIResponse> {
    return withErrorHandling(async () => {
      const updateData: any = {};
      if (data.response_text !== undefined) updateData.response_text = data.response_text;
      if (data.confidence_score !== undefined) updateData.confidence_score = data.confidence_score;
      updateData.user_edited = true;

      const { data: response, error } = await this.db
        .from('ai_responses')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('AIResponse', id);
        }
        throw error;
      }

      logger.info('Updated AI response', { responseId: id });
      return this.mapAIResponse(response);
    }, 'update AI response');
  }

  async markAIResponseSent(id: string, sentAt: Date): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await this.db
        .from('ai_responses')
        .update({ sent_at: sentAt.toISOString() })
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('AIResponse', id);
        }
        throw error;
      }

      logger.info('Marked AI response as sent', { responseId: id });
    }, 'mark AI response sent');
  }

  // Template Operations

  async createTemplate(userId: string, data: TemplateInput): Promise<ResponseTemplate> {
    return withErrorHandling(async () => {
      const { data: template, error } = await this.db
        .from('response_templates')
        .insert({
          user_id: userId,
          name: data.name,
          description: data.description,
          template_text: data.template_text,
          variables: data.variables || [],
          category: data.category,
        })
        .select()
        .single();

      if (error) {
        if (error.code === '23505') {
          throw new DuplicateError('template name', data.name);
        }
        throw error;
      }

      await this.incrementUsage(userId, 'templates_created');
      
      logger.info('Created template', { templateId: template.id, userId });
      return this.mapTemplate(template);
    }, 'create template');
  }

  async getTemplates(userId: string, category?: string): Promise<ResponseTemplate[]> {
    return withErrorHandling(async () => {
      let query = this.db
        .from('response_templates')
        .select('*')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query.order('usage_count', { ascending: false });

      if (error) throw error;

      return (data || []).map(this.mapTemplate);
    }, 'get templates');
  }

  async getTemplate(id: string): Promise<ResponseTemplate | null> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('response_templates')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? this.mapTemplate(data) : null;
    }, 'get template');
  }

  async updateTemplate(id: string, data: Partial<TemplateInput>): Promise<ResponseTemplate> {
    return withErrorHandling(async () => {
      const updateData: any = {};
      if (data.name !== undefined) updateData.name = data.name;
      if (data.description !== undefined) updateData.description = data.description;
      if (data.template_text !== undefined) updateData.template_text = data.template_text;
      if (data.variables !== undefined) updateData.variables = data.variables;
      if (data.category !== undefined) updateData.category = data.category;

      const { data: template, error } = await this.db
        .from('response_templates')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Template', id);
        }
        throw error;
      }

      logger.info('Updated template', { templateId: id });
      return this.mapTemplate(template);
    }, 'update template');
  }

  async incrementTemplateUsage(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await this.db.rpc('increment_template_usage', { template_id: id });

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Template', id);
        }
        throw error;
      }

      logger.info('Incremented template usage', { templateId: id });
    }, 'increment template usage');
  }

  async deleteTemplate(id: string): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await this.db
        .from('response_templates')
        .update({ is_active: false })
        .eq('id', id);

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Template', id);
        }
        throw error;
      }

      logger.info('Deleted template', { templateId: id });
    }, 'delete template');
  }

  // Notification Operations

  async logNotification(data: NotificationInput): Promise<NotificationLog> {
    return withErrorHandling(async () => {
      const { data: notification, error } = await this.db
        .from('notification_logs')
        .insert({
          user_id: data.user_id,
          email_id: data.email_id,
          notification_type: data.notification_type,
          channel: data.channel,
          recipient: data.recipient,
          subject: data.subject,
          content: data.content,
          status: 'pending',
          metadata: data.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;

      logger.info('Logged notification', { notificationId: notification.id });
      return this.mapNotification(notification);
    }, 'log notification');
  }

  async updateNotificationStatus(
    id: string,
    status: 'sent' | 'failed' | 'delivered',
    errorMessage?: string
  ): Promise<NotificationLog> {
    return withErrorHandling(async () => {
      const updateData: any = { status };
      if (errorMessage) updateData.error_message = errorMessage;
      if (status === 'sent') updateData.sent_at = new Date().toISOString();
      if (status === 'delivered') updateData.delivered_at = new Date().toISOString();

      const { data: notification, error } = await this.db
        .from('notification_logs')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new NotFoundError('Notification', id);
        }
        throw error;
      }

      logger.info('Updated notification status', { notificationId: id, status });
      return this.mapNotification(notification);
    }, 'update notification status');
  }

  async getNotifications(userId: string, options?: QueryOptions): Promise<PaginatedResult<NotificationLog>> {
    return withErrorHandling(async () => {
      const limit = options?.limit || 50;
      const offset = options?.offset || 0;

      const { data, error, count } = await this.db
        .from('notification_logs')
        .select('*', { count: 'exact' })
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        data: (data || []).map(this.mapNotification),
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      };
    }, 'get notifications');
  }

  // Usage Tracking

  async incrementUsage(userId: string, metric: MetricType, amount: number = 1): Promise<void> {
    return withErrorHandling(async () => {
      const { error } = await this.db.rpc('increment_usage_metric', {
        p_user_id: userId,
        p_metric_type: metric,
        p_amount: amount,
      });

      if (error) throw error;

      logger.info('Incremented usage', { userId, metric, amount });
    }, 'increment usage');
  }

  async getUsage(userId: string, metric: MetricType, period: Date): Promise<UsageMetric | null> {
    return withErrorHandling(async () => {
      const periodStart = new Date(period.getFullYear(), period.getMonth(), 1);
      
      const { data, error } = await this.db
        .from('usage_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('metric_type', metric)
        .eq('period_start', periodStart.toISOString())
        .single();

      if (error) {
        if (error.code === 'PGRST116') return null;
        throw error;
      }

      return data ? this.mapUsageMetric(data) : null;
    }, 'get usage');
  }

  async getAllUsage(userId: string, periodStart: Date, periodEnd: Date): Promise<UsageMetric[]> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db
        .from('usage_metrics')
        .select('*')
        .eq('user_id', userId)
        .gte('period_start', periodStart.toISOString())
        .lte('period_end', periodEnd.toISOString());

      if (error) throw error;

      return (data || []).map(this.mapUsageMetric);
    }, 'get all usage');
  }

  async checkUsageLimit(userId: string, metric: MetricType, limit: number): Promise<boolean> {
    return withErrorHandling(async () => {
      const currentPeriod = new Date();
      const usage = await this.getUsage(userId, metric, currentPeriod);
      
      return usage ? usage.count >= limit : false;
    }, 'check usage limit');
  }

  // Real-time Subscriptions

  subscribeToEmails(accountId: string, callback: SubscriptionCallback<Email>): UnsubscribeFunction {
    const channelName = `emails:${accountId}`;
    
    const channel = this.client
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'emails',
        filter: `account_id=eq.${accountId}`,
      }, (payload) => {
        callback(this.mapEmail(payload.new));
      })
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      this.client.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  subscribeToResponses(userId: string, callback: SubscriptionCallback<AIResponse>): UnsubscribeFunction {
    const channelName = `responses:${userId}`;
    
    const channel = this.client
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'ai_responses',
      }, async (payload) => {
        // Check if this response belongs to the user
        const response = this.mapAIResponse(payload.new);
        const email = await this.getEmail(response.email_id);
        if (email) {
          const account = await this.getEmailAccount(email.account_id);
          if (account && account.user_id === userId) {
            callback(response);
          }
        }
      })
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      this.client.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  subscribeToNotifications(userId: string, callback: SubscriptionCallback<NotificationLog>): UnsubscribeFunction {
    const channelName = `notifications:${userId}`;
    
    const channel = this.client
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'notification_logs',
        filter: `user_id=eq.${userId}`,
      }, (payload) => {
        if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
          callback(this.mapNotification(payload.new));
        }
      })
      .subscribe();

    this.channels.set(channelName, channel);

    return () => {
      this.client.removeChannel(channel);
      this.channels.delete(channelName);
    };
  }

  // Transaction Support

  async transaction<T>(callback: (trx: DatabaseAdapter) => Promise<T>): Promise<T> {
    // Note: Supabase doesn't have built-in transaction support in the JS client
    // We'll use RPC functions for critical operations that need transactions
    // For now, we'll execute the callback with the current adapter
    try {
      const result = await callback(this);
      return result;
    } catch (error) {
      logger.error('Transaction failed', { error });
      throw new TransactionError('Transaction failed', error, false);
    }
  }

  // Utility Operations

  async rawQuery<T = any>(query: string, params?: any[]): Promise<T[]> {
    return withErrorHandling(async () => {
      const { data, error } = await this.db.rpc('execute_sql', {
        query,
        params: params || [],
      });

      if (error) throw error;

      return data as T[];
    }, 'raw query');
  }

  async getStats(): Promise<{
    totalUsers: number;
    totalEmails: number;
    totalResponses: number;
    activeConnections: number;
    databaseSize: number;
  }> {
    return withErrorHandling(async () => {
      const [users, emails, responses] = await Promise.all([
        this.db.from('users').select('*', { count: 'exact', head: true }),
        this.db.from('emails').select('*', { count: 'exact', head: true }),
        this.db.from('ai_responses').select('*', { count: 'exact', head: true }),
      ]);

      return {
        totalUsers: users.count || 0,
        totalEmails: emails.count || 0,
        totalResponses: responses.count || 0,
        activeConnections: this.channels.size,
        databaseSize: 0, // Would need admin access to get actual size
      };
    }, 'get stats');
  }

  async cleanup(olderThan: Date): Promise<number> {
    return withErrorHandling(async () => {
      let deletedCount = 0;

      // Delete old notifications
      const { count: notificationCount } = await this.db
        .from('notification_logs')
        .delete()
        .lt('created_at', olderThan.toISOString())
        .select() as any;
      // @ts-ignore - Workaround for Supabase delete().select() type issue
      
      deletedCount += notificationCount || 0;

      // Delete old processed emails (keep unprocessed)
      const { count: emailCount } = await this.db
        .from('emails')
        .delete()
        .lt('created_at', olderThan.toISOString())
        .not('processed_at', 'is', null)
        .select() as any;
      // @ts-ignore - Workaround for Supabase delete().select() type issue
      
      deletedCount += emailCount || 0;

      logger.info('Cleanup completed', { deletedCount, olderThan });
      return deletedCount;
    }, 'cleanup');
  }

  // Mapping functions

  private mapUser(data: any): User {
    return {
      id: data.id,
      email: data.email,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
      settings: data.settings || {},
      subscription_tier: data.subscription_tier,
    };
  }

  private mapEmailAccount(data: any): EmailAccount {
    return {
      id: data.id,
      user_id: data.user_id,
      email_address: data.email_address,
      provider: data.provider,
      encrypted_credentials: data.encrypted_credentials,
      settings: data.settings || {},
      last_sync: data.last_sync ? new Date(data.last_sync) : null,
      is_active: data.is_active,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  private mapEmail(data: any): Email {
    return {
      id: data.id,
      account_id: data.account_id,
      message_id: data.message_id,
      thread_id: data.thread_id,
      subject: data.subject,
      from_address: data.from_address,
      to_addresses: data.to_addresses,
      cc_addresses: data.cc_addresses,
      bcc_addresses: data.bcc_addresses,
      body_text: data.body_text,
      body_html: data.body_html,
      attachments: data.attachments || [],
      received_at: new Date(data.received_at),
      processed_at: data.processed_at ? new Date(data.processed_at) : undefined,
      metadata: data.metadata || {},
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  private mapAIResponse(data: any): AIResponse {
    return {
      id: data.id,
      email_id: data.email_id,
      response_text: data.response_text,
      model_used: data.model_used,
      confidence_score: data.confidence_score,
      tokens_used: data.tokens_used,
      response_time_ms: data.response_time_ms,
      template_id: data.template_id,
      user_edited: data.user_edited,
      sent_at: data.sent_at ? new Date(data.sent_at) : undefined,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  private mapTemplate(data: any): ResponseTemplate {
    return {
      id: data.id,
      user_id: data.user_id,
      name: data.name,
      description: data.description,
      template_text: data.template_text,
      variables: data.variables || [],
      category: data.category,
      usage_count: data.usage_count,
      is_active: data.is_active,
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }

  private mapNotification(data: any): NotificationLog {
    return {
      id: data.id,
      user_id: data.user_id,
      email_id: data.email_id,
      notification_type: data.notification_type,
      channel: data.channel,
      recipient: data.recipient,
      subject: data.subject,
      content: data.content,
      status: data.status,
      error_message: data.error_message,
      metadata: data.metadata,
      sent_at: data.sent_at ? new Date(data.sent_at) : undefined,
      delivered_at: data.delivered_at ? new Date(data.delivered_at) : undefined,
      created_at: new Date(data.created_at),
    };
  }

  private mapUsageMetric(data: any): UsageMetric {
    return {
      id: data.id,
      user_id: data.user_id,
      metric_type: data.metric_type,
      count: data.count,
      period_start: new Date(data.period_start),
      period_end: new Date(data.period_end),
      created_at: new Date(data.created_at),
      updated_at: new Date(data.updated_at),
    };
  }
}